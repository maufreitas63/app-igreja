-- Padroniza campos de nome completo em todas as tabelas public do Supabase.
-- Regra: nomes/sobrenomes capitalizados; de/do/da/dos/das/e sempre minusculos.

create or replace function public.format_full_name_token_ptbr(p_token text)
returns text
language plpgsql
immutable
as $$
declare
  v_token text := lower(coalesce(p_token, ''));
  v_result text := '';
  v_char text;
  v_index integer;
  v_capitalize_next boolean := true;
begin
  if v_token = '' then
    return '';
  end if;

  for v_index in 1..char_length(v_token) loop
    v_char := substr(v_token, v_index, 1);

    if v_char in ('-', '''', '’') then
      v_result := v_result || v_char;
      v_capitalize_next := true;
    elsif v_capitalize_next then
      v_result := v_result || upper(v_char);
      v_capitalize_next := false;
    else
      v_result := v_result || v_char;
    end if;
  end loop;

  return v_result;
end;
$$;

create or replace function public.format_full_name_ptbr(p_value text)
returns text
language plpgsql
immutable
as $$
declare
  v_text text := trim(regexp_replace(coalesce(p_value, ''), '[[:space:]]+', ' ', 'g'));
  v_word text;
  v_result text[] := array[]::text[];
begin
  if v_text = '' then
    return '';
  end if;

  foreach v_word in array regexp_split_to_array(v_text, ' ') loop
    if lower(v_word) = any (array['de', 'do', 'da', 'dos', 'das', 'e']) then
      v_result := array_append(v_result, lower(v_word));
    else
      v_result := array_append(v_result, public.format_full_name_token_ptbr(v_word));
    end if;
  end loop;

  return array_to_string(v_result, ' ');
end;
$$;

create or replace function public.normalize_full_name_columns_trigger()
returns trigger
language plpgsql
as $$
declare
  v_column text;
  v_value text;
begin
  foreach v_column in array tg_argv loop
    execute format('select to_jsonb($1)->>%L', v_column) using new into v_value;

    if v_value is not null then
      new := jsonb_populate_record(
        new,
        jsonb_build_object(v_column, public.format_full_name_ptbr(v_value))
      );
    end if;
  end loop;

  return new;
end;
$$;

grant execute on function public.format_full_name_token_ptbr(text) to anon, authenticated, service_role;
grant execute on function public.format_full_name_ptbr(text) to anon, authenticated, service_role;

do $$
declare
  v_column record;
  v_updated_count bigint;
begin
  for v_column in
    select table_schema, table_name, column_name
      from information_schema.columns
     where table_schema = 'public'
       and column_name in ('full_name', 'nome_completo')
       and (
         data_type in ('text', 'character varying', 'character')
         or udt_name = 'citext'
       )
     order by table_schema, table_name, column_name
  loop
    execute format(
      'update %I.%I
          set %I = public.format_full_name_ptbr(%I::text)
        where %I is not null
          and trim(%I::text) <> ''''
          and %I::text is distinct from public.format_full_name_ptbr(%I::text)',
      v_column.table_schema,
      v_column.table_name,
      v_column.column_name,
      v_column.column_name,
      v_column.column_name,
      v_column.column_name,
      v_column.column_name,
      v_column.column_name
    );

    get diagnostics v_updated_count = row_count;
    raise notice '%.%: coluna %, % registro(s) atualizado(s)',
      v_column.table_schema,
      v_column.table_name,
      v_column.column_name,
      v_updated_count;
  end loop;
end;
$$;

do $$
declare
  v_table record;
begin
  for v_table in
    select
      table_schema,
      table_name,
      string_agg(format('%I', column_name), ', ' order by column_name) as update_columns,
      string_agg(format('%L', column_name), ', ' order by column_name) as trigger_args
    from information_schema.columns
    where table_schema = 'public'
      and column_name in ('full_name', 'nome_completo')
      and (
        data_type in ('text', 'character varying', 'character')
        or udt_name = 'citext'
      )
    group by table_schema, table_name
    order by table_schema, table_name
  loop
    execute format(
      'drop trigger if exists trg_normalize_full_name_fields on %I.%I',
      v_table.table_schema,
      v_table.table_name
    );

    execute format(
      'create trigger trg_normalize_full_name_fields
         before insert or update of %s on %I.%I
         for each row
         execute function public.normalize_full_name_columns_trigger(%s)',
      v_table.update_columns,
      v_table.table_schema,
      v_table.table_name,
      v_table.trigger_args
    );

    raise notice 'Trigger de nomes instalada em %.%', v_table.table_schema, v_table.table_name;
  end loop;
end;
$$;
