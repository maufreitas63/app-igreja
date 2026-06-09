-- Troca um numero de celular em todas as colunas textuais de telefone
-- encontradas no schema `public`.
--
-- Uso mais simples:
--   select public.change_phone_everywhere('(19) 99999-1111', '(19) 98888-2222');
--
-- Uso com colunas adicionais:
--   select public.change_phone_everywhere(
--     '(19) 99999-1111',
--     '(19) 98888-2222',
--     array['phone', 'whatsapp_phone', 'mobile_phone']
--   );
--
-- Recomendacao:
-- - Execute primeiro no SQL Editor do Supabase.
-- - Revise o retorno JSON para conferir quais tabelas/colunas foram afetadas.
-- - Se quiser expor isso ao app no futuro, decida conscientemente os GRANTs.

create or replace function public.normalize_phone_for_sync(p_value text)
returns text
language sql
immutable
security definer
set search_path = public
as $$
  select regexp_replace(coalesce(p_value, ''), '\D', '', 'g');
$$;

drop function if exists public.change_phone_everywhere(text, text, text[]);

create or replace function public.change_phone_everywhere(
  p_old_phone text,
  p_new_phone text,
  p_column_names text[] default array['phone', 'cell_phone', 'mobile_phone', 'whatsapp_phone']
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_phone text := nullif(trim(coalesce(p_old_phone, '')), '');
  v_new_phone text := nullif(trim(coalesce(p_new_phone, '')), '');
  v_old_phone_normalized text;
  v_new_phone_normalized text;
  v_column_names text[] := coalesce(p_column_names, array['phone', 'cell_phone', 'mobile_phone', 'whatsapp_phone']);
  v_sql text;
  v_rows integer;
  v_total_rows integer := 0;
  v_changes jsonb := '[]'::jsonb;
  v_target record;
begin
  if v_old_phone is null then
    raise exception 'Telefone de origem nao informado.';
  end if;

  if v_new_phone is null then
    raise exception 'Telefone de destino nao informado.';
  end if;

  v_old_phone_normalized := public.normalize_phone_for_sync(v_old_phone);
  v_new_phone_normalized := public.normalize_phone_for_sync(v_new_phone);

  if v_old_phone_normalized = '' then
    raise exception 'Telefone de origem invalido.';
  end if;

  if v_new_phone_normalized = '' then
    raise exception 'Telefone de destino invalido.';
  end if;

  if v_old_phone_normalized = v_new_phone_normalized then
    return jsonb_build_object(
      'success', true,
      'message', 'Os numeros informado de origem e destino sao equivalentes apos normalizacao.',
      'old_phone', v_old_phone,
      'new_phone', v_new_phone,
      'updated_rows', 0,
      'changes', '[]'::jsonb
    );
  end if;

  for v_target in
    select
      c.table_schema,
      c.table_name,
      c.column_name,
      exists (
        select 1
        from information_schema.columns c2
        where c2.table_schema = c.table_schema
          and c2.table_name = c.table_name
          and c2.column_name = 'updated_at'
      ) as has_updated_at
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = any(v_column_names)
      and c.data_type in ('text', 'character varying', 'character')
    order by
      case c.table_name
        when 'profiles' then 0
        when 'members' then 1
        else 2
      end,
      c.table_name,
      c.column_name
  loop
    if v_target.has_updated_at then
      v_sql := format(
        'update %I.%I
            set %I = $1,
                updated_at = now()
          where %I = $2
             or public.normalize_phone_for_sync(%I) = $3',
        v_target.table_schema,
        v_target.table_name,
        v_target.column_name,
        v_target.column_name,
        v_target.column_name
      );
    else
      v_sql := format(
        'update %I.%I
            set %I = $1
          where %I = $2
             or public.normalize_phone_for_sync(%I) = $3',
        v_target.table_schema,
        v_target.table_name,
        v_target.column_name,
        v_target.column_name,
        v_target.column_name
      );
    end if;

    execute v_sql
    using v_new_phone, v_old_phone, v_old_phone_normalized;

    get diagnostics v_rows = row_count;

    if v_rows > 0 then
      v_total_rows := v_total_rows + v_rows;
      v_changes := v_changes || jsonb_build_array(
        jsonb_build_object(
          'table', format('%s.%s', v_target.table_schema, v_target.table_name),
          'column', v_target.column_name,
          'updated_rows', v_rows
        )
      );
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'old_phone', v_old_phone,
    'new_phone', v_new_phone,
    'old_phone_normalized', v_old_phone_normalized,
    'new_phone_normalized', v_new_phone_normalized,
    'updated_rows', v_total_rows,
    'changes', v_changes
  );
end;
$$;

comment on function public.change_phone_everywhere(text, text, text[]) is
  'Troca um numero de telefone em todas as colunas textuais configuradas do schema public e retorna um resumo JSON das tabelas afetadas.';

grant execute on function public.normalize_phone_for_sync(text) to anon;
grant execute on function public.normalize_phone_for_sync(text) to authenticated;
grant execute on function public.change_phone_everywhere(text, text, text[]) to anon;
grant execute on function public.change_phone_everywhere(text, text, text[]) to authenticated;
