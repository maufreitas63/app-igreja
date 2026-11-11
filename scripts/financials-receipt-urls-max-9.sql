-- Até 9 comprovantes por lançamento (parser, RPC e normalização).
-- Produção: funções tenant-aware (wave1b).

comment on column public.financials.receipt_urls is
  'Lista de caminhos de comprovantes (máx. 9) no bucket financial-docs.';

create or replace function public.normalize_financial_receipt_urls(p_receipt_urls jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_item jsonb;
  v_url text;
  v_result jsonb := '[]'::jsonb;
  v_seen text[] := array[]::text[];
begin
  if p_receipt_urls is null or jsonb_typeof(p_receipt_urls) <> 'array' then
    return '[]'::jsonb;
  end if;

  for v_item in select value from jsonb_array_elements(p_receipt_urls)
  loop
    v_url := nullif(trim(both from coalesce(v_item #>> '{}', '')), '');

    if v_url is null or v_url = any(v_seen) then
      continue;
    end if;

    v_seen := array_append(v_seen, v_url);
    v_result := v_result || jsonb_build_array(to_jsonb(v_url));

    if jsonb_array_length(v_result) >= 9 then
      exit;
    end if;
  end loop;

  return v_result;
end;
$$;

create or replace function public.anexar_comprovante_lancamento_financeiro(
  p_id uuid,
  p_receipt_path text,
  p_position integer default null,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_row public.financials%rowtype;
  v_urls jsonb;
  v_path text;
  v_pos integer;
  v_len integer;
  v_idx integer;
  v_replaced text;
  v_arr text[] := array[]::text[];
  v_i integer;
begin
  if p_id is null then
    return jsonb_build_object('success', false, 'message', 'Lançamento não informado.');
  end if;

  v_path := nullif(trim(coalesce(p_receipt_path, '')), '');

  if v_path is null then
    return jsonb_build_object('success', false, 'message', 'Caminho do comprovante não informado.');
  end if;

  if not public.session_has_resource_access('table', 'financials', 'update') then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para alterar lançamentos financeiros.');
  end if;

  select *
  into v_row
  from public.financials f
  where f.id = p_id
    and f.tenant_id = v_tenant
  for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Lançamento não encontrado.');
  end if;

  v_urls := public.normalize_financial_receipt_urls(coalesce(v_row.receipt_urls, '[]'::jsonb));
  v_len := jsonb_array_length(v_urls);
  v_pos := coalesce(nullif(p_position, 0), v_len + 1);

  if v_pos < 1 or v_pos > 9 then
    return jsonb_build_object('success', false, 'message', 'Posição de comprovante inválida.');
  end if;

  if v_pos > v_len + 1 then
    return jsonb_build_object(
      'success',
      false,
      'message',
      format('Não é possível anexar na posição %s sem os comprovantes anteriores.', v_pos)
    );
  end if;

  if v_len > 0 then
  select coalesce(array_agg(value), array[]::text[])
  into v_arr
  from jsonb_array_elements_text(v_urls) as value;
  end if;

  v_idx := v_pos;

  if v_idx = coalesce(array_length(v_arr, 1), 0) + 1 then
    if v_len >= 9 and not coalesce(p_force, false) then
      return jsonb_build_object(
        'success',
        false,
        'message',
        'Cada lançamento aceita no máximo 9 comprovantes.',
        'code',
        'max_receipts'
      );
    end if;

    v_arr := array_append(v_arr, v_path);
  elsif v_idx <= coalesce(array_length(v_arr, 1), 0) then
    v_replaced := v_arr[v_idx];

    if v_replaced is not null and not coalesce(p_force, false) then
      return jsonb_build_object(
        'success',
        false,
        'message',
        format('Posição %s já possui comprovante.', v_pos),
        'code',
        'slot_occupied',
        'receipt_urls',
        v_urls,
        'replaced_url',
        v_replaced
      );
    end if;

    v_arr[v_idx] := v_path;
  else
    return jsonb_build_object(
      'success',
      false,
      'message',
      format('Não é possível anexar na posição %s sem os comprovantes anteriores.', v_pos)
    );
  end if;

  select coalesce(jsonb_agg(to_jsonb(url)), '[]'::jsonb)
  into v_urls
  from unnest(v_arr) as url
  where nullif(trim(url), '') is not null;

  v_urls := public.normalize_financial_receipt_urls(v_urls);

  update public.financials f
  set
    receipt_urls = v_urls,
    receipt_url = nullif(trim(coalesce(v_urls->>0, '')), ''),
    updated_at = now()
  where f.id = p_id
    and f.tenant_id = v_tenant;

  return jsonb_build_object(
    'success', true,
    'message',
    case
      when jsonb_array_length(v_urls) = 1 then 'Comprovante anexado.'
      else 'Comprovantes atualizados.'
    end,
    'id', p_id,
    'receipt_url', nullif(trim(coalesce(v_urls->>0, '')), ''),
    'receipt_urls', v_urls,
    'replaced_url', nullif(trim(coalesce(v_replaced, '')), ''),
    'position', v_pos
  );
end;
$$;

grant execute on function public.anexar_comprovante_lancamento_financeiro(uuid, text, integer, boolean)
  to anon, authenticated;

create or replace function public.atualizar_comprovante_lancamento_financeiro(
  p_id uuid,
  p_receipt_urls jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_updated integer;
  v_receipt_urls jsonb;
  v_locked_id uuid;
begin
  if p_id is null then
    return jsonb_build_object('success', false, 'message', 'Lançamento não informado.');
  end if;

  if not public.session_has_resource_access('table', 'financials', 'update') then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para alterar lançamentos financeiros.');
  end if;

  select f.id
  into v_locked_id
  from public.financials f
  where f.id = p_id
    and f.tenant_id = v_tenant
  for update;

  if v_locked_id is null then
    return jsonb_build_object('success', false, 'message', 'Nenhum lançamento foi atualizado.');
  end if;

  v_receipt_urls := public.normalize_financial_receipt_urls(coalesce(p_receipt_urls, '[]'::jsonb));

  if jsonb_array_length(v_receipt_urls) > 9 then
    return jsonb_build_object('success', false, 'message', 'Cada lançamento aceita no máximo 9 comprovantes.');
  end if;

  update public.financials f
  set
    receipt_urls = v_receipt_urls,
    receipt_url = nullif(trim(coalesce(v_receipt_urls->>0, '')), ''),
    updated_at = now()
  where f.id = p_id
    and f.tenant_id = v_tenant;

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    return jsonb_build_object('success', false, 'message', 'Nenhum lançamento foi atualizado.');
  end if;

  return jsonb_build_object(
    'success', true,
    'message',
    case
      when jsonb_array_length(v_receipt_urls) = 0 then 'Comprovante removido.'
      when jsonb_array_length(v_receipt_urls) = 1 then 'Comprovante anexado.'
      else 'Comprovantes atualizados.'
    end,
    'id', p_id,
    'receipt_url', nullif(trim(coalesce(v_receipt_urls->>0, '')), ''),
    'receipt_urls', v_receipt_urls
  );
end;
$$;

grant execute on function public.atualizar_comprovante_lancamento_financeiro(uuid, jsonb)
  to anon, authenticated;
