-- Manutenção de tipos de escala (tabela tipos_escala).
-- Execute após scripts/vigilancia-escalas.sql e scripts/escalas-multi-vagas.sql

drop function if exists public.listar_tipos_escala_manutencao();

create or replace function public.listar_tipos_escala_manutencao()
returns table (
  id uuid,
  codigo text,
  nome text,
  is_ativa boolean,
  vagas_por_servico integer,
  modo_ciclo text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    te.id,
    te.codigo,
    te.nome,
    te.is_ativa,
    coalesce(te.vagas_por_servico, 1),
    coalesce(te.modo_ciclo, 'individual'),
    te.created_at,
    te.updated_at
  from public.tipos_escala te
  order by te.is_ativa desc, te.nome asc;
$$;

drop function if exists public.cadastrar_tipo_escala(text, text);
drop function if exists public.cadastrar_tipo_escala(text, text, integer, text);

create or replace function public.cadastrar_tipo_escala(
  p_codigo text,
  p_nome text,
  p_vagas_por_servico integer default 1,
  p_modo_ciclo text default 'individual'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text;
  v_nome text;
  v_vagas integer;
  v_modo text;
  v_id uuid;
begin
  v_codigo := lower(trim(regexp_replace(coalesce(p_codigo, ''), '\s+', '_', 'g')));
  v_nome := trim(coalesce(p_nome, ''));
  v_vagas := greatest(1, least(coalesce(p_vagas_por_servico, 1), 50));
  v_modo := lower(trim(coalesce(p_modo_ciclo, 'individual')));

  if v_modo not in ('individual', 'equipe') then
    return jsonb_build_object('success', false, 'message', 'Modo de ciclo inválido. Use individual ou equipe.');
  end if;

  if v_codigo = '' then
    return jsonb_build_object('success', false, 'message', 'Informe o código da escala.');
  end if;

  if v_nome = '' then
    return jsonb_build_object('success', false, 'message', 'Informe o nome da escala.');
  end if;

  if exists (select 1 from public.tipos_escala te where te.codigo = v_codigo) then
    return jsonb_build_object('success', false, 'message', 'Já existe uma escala com este código.');
  end if;

  insert into public.tipos_escala (codigo, nome, is_ativa, vagas_por_servico, modo_ciclo)
  values (v_codigo, v_nome, true, v_vagas, v_modo)
  returning id into v_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Tipo de escala cadastrado.',
    'id', v_id,
    'codigo', v_codigo,
    'nome', v_nome,
    'vagas_por_servico', v_vagas,
    'modo_ciclo', v_modo
  );
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'message', 'Já existe uma escala com este código.');
end;
$$;

drop function if exists public.atualizar_tipo_escala(uuid, text, text, boolean);
drop function if exists public.atualizar_tipo_escala(uuid, text, text, boolean, integer, text);

create or replace function public.atualizar_tipo_escala(
  p_id uuid,
  p_codigo text,
  p_nome text,
  p_is_ativa boolean default true,
  p_vagas_por_servico integer default null,
  p_modo_ciclo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text;
  v_nome text;
  v_vagas integer;
  v_modo text;
begin
  if p_id is null then
    return jsonb_build_object('success', false, 'message', 'Escala não informada.');
  end if;

  v_codigo := lower(trim(regexp_replace(coalesce(p_codigo, ''), '\s+', '_', 'g')));
  v_nome := trim(coalesce(p_nome, ''));

  if v_codigo = '' then
    return jsonb_build_object('success', false, 'message', 'Informe o código da escala.');
  end if;

  if v_nome = '' then
    return jsonb_build_object('success', false, 'message', 'Informe o nome da escala.');
  end if;

  if exists (
    select 1
    from public.tipos_escala te
    where te.codigo = v_codigo
      and te.id <> p_id
  ) then
    return jsonb_build_object('success', false, 'message', 'Já existe outra escala com este código.');
  end if;

  select coalesce(te.vagas_por_servico, 1), coalesce(te.modo_ciclo, 'individual')
  into v_vagas, v_modo
  from public.tipos_escala te
  where te.id = p_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Tipo de escala não encontrado.');
  end if;

  if p_vagas_por_servico is not null then
    v_vagas := greatest(1, least(p_vagas_por_servico, 50));
  end if;

  if p_modo_ciclo is not null then
    v_modo := lower(trim(p_modo_ciclo));
    if v_modo not in ('individual', 'equipe') then
      return jsonb_build_object('success', false, 'message', 'Modo de ciclo inválido. Use individual ou equipe.');
    end if;
  end if;

  update public.tipos_escala te
  set
    codigo = v_codigo,
    nome = v_nome,
    is_ativa = coalesce(p_is_ativa, true),
    vagas_por_servico = v_vagas,
    modo_ciclo = v_modo,
    updated_at = now()
  where te.id = p_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Tipo de escala não encontrado.');
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Tipo de escala atualizado.',
    'id', p_id,
    'codigo', v_codigo,
    'nome', v_nome,
    'vagas_por_servico', v_vagas,
    'modo_ciclo', v_modo
  );
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'message', 'Já existe outra escala com este código.');
end;
$$;

drop function if exists public.excluir_tipo_escala(uuid);

create or replace function public.excluir_tipo_escala(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
begin
  if p_id is null then
    return jsonb_build_object('success', false, 'message', 'Escala não informada.');
  end if;

  select te.nome
  into v_nome
  from public.tipos_escala te
  where te.id = p_id;

  if v_nome is null then
    return jsonb_build_object('success', false, 'message', 'Tipo de escala não encontrado.');
  end if;

  delete from public.tipos_escala te
  where te.id = p_id;

  return jsonb_build_object(
    'success', true,
    'message', format('Escala «%s» removida.', v_nome)
  );
end;
$$;

grant execute on function public.listar_tipos_escala_manutencao() to anon;
grant execute on function public.listar_tipos_escala_manutencao() to authenticated;
grant execute on function public.cadastrar_tipo_escala(text, text, integer, text) to anon;
grant execute on function public.cadastrar_tipo_escala(text, text, integer, text) to authenticated;
grant execute on function public.atualizar_tipo_escala(uuid, text, text, boolean, integer, text) to anon;
grant execute on function public.atualizar_tipo_escala(uuid, text, text, boolean, integer, text) to authenticated;
grant execute on function public.excluir_tipo_escala(uuid) to anon;
grant execute on function public.excluir_tipo_escala(uuid) to authenticated;

drop policy if exists tipos_escala_insert_policy on public.tipos_escala;
create policy tipos_escala_insert_policy
on public.tipos_escala
for insert
to anon, authenticated
with check (true);

drop policy if exists tipos_escala_update_policy on public.tipos_escala;
create policy tipos_escala_update_policy
on public.tipos_escala
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists tipos_escala_delete_policy on public.tipos_escala;
create policy tipos_escala_delete_policy
on public.tipos_escala
for delete
to anon, authenticated
using (true);

grant insert, update, delete on public.tipos_escala to anon;
grant insert, update, delete on public.tipos_escala to authenticated;

notify pgrst, 'reload schema';
