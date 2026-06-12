-- Funções de importação CSV (incluídas automaticamente em financials-import.sql).
-- Pode executar este arquivo sozinho (uma vez) ou usar financials-import.sql completo.

drop function if exists public.importar_lancamentos_financeiros_de_arquivo(text, boolean);
drop function if exists public.importar_lancamentos_financeiros_csv(text, boolean);

create or replace function public.parse_financial_csv_date(p_value text)
returns date
language plpgsql
immutable
as $$
declare
  v text;
  m text[];
  v_day integer;
  v_month integer;
  v_year integer;
begin
  v := btrim(coalesce(p_value, ''));

  if v = '' then
    return null;
  end if;

  m := regexp_match(v, '^(\d{4})/(\d{1,2})/(\d{1,2})$');

  if m is not null then
    return make_date(m[1]::integer, m[2]::integer, m[3]::integer);
  end if;

  m := regexp_match(v, '^(\d{1,2})/(\d{1,2})/(\d{4})$');

  if m is not null then
    return make_date(m[3]::integer, m[2]::integer, m[1]::integer);
  end if;

  m := regexp_match(v, '^(\d{1,2})/(\d{1,2})/(\d{2})$');

  if m is null then
    return null;
  end if;

  v_day := m[1]::integer;
  v_month := m[2]::integer;
  v_year := m[3]::integer;
  v_year := case when v_year >= 70 then 1900 + v_year else 2000 + v_year end;

  return make_date(v_year, v_month, v_day);
exception
  when others then
    return null;
end;
$$;

create or replace function public.parse_financial_csv_amount(p_value text)
returns numeric
language plpgsql
immutable
as $$
declare
  v text;
  v_amount numeric;
begin
  v := btrim(coalesce(p_value, ''));
  v := regexp_replace(v, '\s', '', 'g');
  v := replace(v, ',', '.');

  if v = '' or v !~ '^-?[0-9]+(\.[0-9]+)?$' then
    return null;
  end if;

  v_amount := v::numeric;

  return v_amount;
exception
  when others then
    return null;
end;
$$;

create or replace function public.financial_csv_trim_parts(p_line text)
returns text[]
language sql
immutable
as $$
  select coalesce(
    array_agg(btrim(part) order by ordinality),
    '{}'::text[]
  )
  from unnest(string_to_array(coalesce(p_line, ''), ';')) with ordinality as parts(part, ordinality);
$$;

create or replace function public.financial_csv_detect_layout(p_parts text[])
returns text
language plpgsql
immutable
as $$
declare
  v_len integer;
begin
  v_len := coalesce(array_length(p_parts, 1), 0);

  if v_len >= 8 then
    if public.parse_financial_csv_amount(p_parts[7]) is not null
       and public.parse_financial_csv_amount(p_parts[8]) is null then
      return 'legacy_comments_last';
    end if;

    return 'standard';
  end if;

  if v_len = 7 then
    if public.parse_financial_csv_amount(p_parts[7]) is not null then
      return 'standard';
    end if;

    if public.parse_financial_csv_amount(p_parts[3]) is not null then
      return 'valor_third';
    end if;
  end if;

  return 'standard';
end;
$$;

create or replace function public.importar_lancamentos_financeiros_csv(
  p_csv_conteudo text,
  p_substituir boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line text;
  v_parts text[];
  v_layout text;
  v_source_row integer := 0;
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_date_raw text;
  v_account text;
  v_ministry text;
  v_transaction_kind text;
  v_movement text;
  v_budget_version text;
  v_comments text;
  v_amount_raw text;
  v_transaction_date date;
  v_amount numeric;
begin
  if p_csv_conteudo is null or btrim(p_csv_conteudo) = '' then
    return jsonb_build_object('success', false, 'message', 'CSV vazio.');
  end if;

  if coalesce(p_substituir, false) then
    return jsonb_build_object(
      'success', false,
      'message', 'Substituição não suportada nesta importação. Use scripts/financials-reset-all.sql antes, se necessário.'
    );
  end if;

  for v_line in
    select btrim(line)
    from regexp_split_to_table(
      regexp_replace(coalesce(p_csv_conteudo, ''), '^\xEF\xBB\xBF', ''),
      E'\\r?\\n'
    ) as line
  loop
    v_source_row := v_source_row + 1;

    if v_line = '' then
      continue;
    end if;

    v_parts := public.financial_csv_trim_parts(v_line);

    if coalesce(array_length(v_parts, 1), 0) < 7 then
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_array(
        jsonb_build_object('line', v_source_row, 'message', 'Menos de 7 colunas.')
      );
      continue;
    end if;

    if coalesce(array_length(v_parts, 1), 0) > 8 then
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_array(
        jsonb_build_object('line', v_source_row, 'message', 'Mais de 8 colunas.')
      );
      continue;
    end if;

    v_date_raw := v_parts[1];

    if v_date_raw ~* '^(data|date)$' then
      continue;
    end if;

    if v_date_raw ~ '^0{1,2}/0{1,2}/1900$'
       and not exists (
         select 1
         from unnest(v_parts[2:array_length(v_parts, 1)]) as tail(value)
         where btrim(coalesce(tail.value, '')) <> ''
       ) then
      continue;
    end if;

    v_layout := public.financial_csv_detect_layout(v_parts);

    if v_layout = 'valor_third' then
      v_account := v_parts[2];
      v_amount_raw := v_parts[3];
      v_ministry := v_parts[4];
      v_transaction_kind := v_parts[5];
      v_movement := v_parts[6];
      v_budget_version := v_parts[7];
      v_comments := case when coalesce(array_length(v_parts, 1), 0) >= 8 then v_parts[8] else null end;
    elsif v_layout = 'legacy_comments_last' then
      v_account := v_parts[2];
      v_ministry := v_parts[3];
      v_transaction_kind := v_parts[4];
      v_movement := v_parts[5];
      v_budget_version := v_parts[6];
      v_amount_raw := v_parts[7];
      v_comments := case when coalesce(array_length(v_parts, 1), 0) >= 8 then v_parts[8] else null end;
    else
      v_account := v_parts[2];
      v_ministry := v_parts[3];
      v_transaction_kind := v_parts[4];
      v_movement := v_parts[5];
      v_budget_version := v_parts[6];
      v_amount_raw := v_parts[array_length(v_parts, 1)];
      v_comments := case when coalesce(array_length(v_parts, 1), 0) >= 8 then v_parts[7] else null end;
    end if;

    v_transaction_date := public.parse_financial_csv_date(v_date_raw);
    v_amount := public.parse_financial_csv_amount(v_amount_raw);

    if v_comments ~* '^(comentarios?|comments?|observacoes?|observação)$' then
      v_comments := null;
    end if;

    v_comments := nullif(btrim(coalesce(v_comments, '')), '');

    if v_transaction_date is null
       or v_amount is null
       or btrim(coalesce(v_account, '')) = ''
       or btrim(coalesce(v_ministry, '')) = ''
       or btrim(coalesce(v_transaction_kind, '')) = ''
       or btrim(coalesce(v_movement, '')) = ''
       or btrim(coalesce(v_budget_version, '')) = '' then
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_array(
        jsonb_build_object('line', v_source_row, 'message', 'Dados inválidos na linha.')
      );
      continue;
    end if;

    insert into public.financials (
      transaction_date,
      account,
      amount,
      ministry,
      transaction_kind,
      movement,
      budget_version,
      comments,
      source_row
    )
    values (
      v_transaction_date,
      btrim(v_account),
      v_amount,
      btrim(v_ministry),
      btrim(v_transaction_kind),
      btrim(v_movement),
      btrim(v_budget_version),
      v_comments,
      v_source_row
    );

    v_inserted := v_inserted + 1;
  end loop;

  if v_inserted = 0 then
    return jsonb_build_object(
      'success', false,
      'message', 'Nenhum lançamento importado.',
      'inserted_count', 0,
      'skipped_count', v_skipped,
      'errors', v_errors
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message', format('%s lançamento(s) importado(s).', v_inserted),
    'inserted_count', v_inserted,
    'skipped_count', v_skipped,
    'errors', v_errors
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'message', format('Falha na importação: %s', sqlerrm)
    );
end;
$$;

create or replace function public.importar_lancamentos_financeiros_de_arquivo(
  p_caminho_arquivo text,
  p_substituir boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text;
  v_content text;
begin
  v_path := btrim(coalesce(p_caminho_arquivo, ''));

  if v_path = '' then
    return jsonb_build_object('success', false, 'message', 'Informe o caminho do arquivo CSV.');
  end if;

  begin
    v_content := pg_read_file(v_path);
  exception
    when others then
      return jsonb_build_object(
        'success', false,
        'message',
        format(
          'Não foi possível ler "%s" no servidor Postgres. No Supabase hospedado, rode: node scripts/run-financials-import.mjs %s',
          v_path,
          v_path
        )
      );
  end;

  return public.importar_lancamentos_financeiros_csv(v_content, p_substituir);
end;
$$;

grant execute on function public.parse_financial_csv_date(text) to anon, authenticated, service_role;
grant execute on function public.parse_financial_csv_amount(text) to anon, authenticated, service_role;
grant execute on function public.financial_csv_trim_parts(text) to anon, authenticated, service_role;
grant execute on function public.financial_csv_detect_layout(text[]) to anon, authenticated, service_role;
grant execute on function public.importar_lancamentos_financeiros_csv(text, boolean) to anon, authenticated, service_role;
grant execute on function public.importar_lancamentos_financeiros_de_arquivo(text, boolean) to anon, authenticated, service_role;
