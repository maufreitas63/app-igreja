-- Manutenção manual de escalas (voluntário + data em escalas_log).
-- Execute após scripts/vigilancia-escalas.sql.

alter table public.voluntarios_escala
  add column if not exists ordem_sequencial integer;

comment on column public.voluntarios_escala.ordem_sequencial is
  'Ordem do ciclo rotativo de domingos (menor = primeiro na sequência).';

with numerados as (
  select
    ve.id,
    row_number() over (
      partition by ve.tipo_escala_id
      order by ve.is_ativo desc, ve.nome asc
    )::integer as ordem
  from public.voluntarios_escala ve
)
update public.voluntarios_escala ve
set ordem_sequencial = numerados.ordem
from numerados
where ve.id = numerados.id
  and ve.ordem_sequencial is null;

drop function if exists public.listar_voluntarios_escala(uuid);

create or replace function public.listar_voluntarios_escala(p_tipo_escala_id uuid)
returns table (
  id uuid,
  nome text,
  is_ativo boolean,
  ultima_data_servico date,
  ordem_sequencial integer
)
language sql
security definer
set search_path = public
as $$
  select
    ve.id,
    ve.nome,
    ve.is_ativo,
    (
      select max(el.data_servico)
      from public.escalas_log el
      where el.tipo_escala_id = ve.tipo_escala_id
        and el.voluntario_id = ve.id
    ) as ultima_data_servico,
    ve.ordem_sequencial
  from public.voluntarios_escala ve
  where ve.tipo_escala_id = p_tipo_escala_id
  order by ve.is_ativo desc, ve.ordem_sequencial asc nulls last, ve.nome asc;
$$;

create or replace function public.registrar_escala_manual(
  p_tipo_escala_id uuid,
  p_voluntario_id uuid,
  p_data_servico date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voluntario_nome text;
  v_tipo_nome text;
  v_existing_voluntario text;
begin
  if p_tipo_escala_id is null then
    return jsonb_build_object('success', false, 'message', 'Tipo de escala não informado.');
  end if;

  if p_voluntario_id is null then
    return jsonb_build_object('success', false, 'message', 'Servo não informado.');
  end if;

  if p_data_servico is null then
    return jsonb_build_object('success', false, 'message', 'Data do serviço não informada.');
  end if;

  if extract(dow from p_data_servico) <> 0 then
    return jsonb_build_object('success', false, 'message', 'A data do serviço deve ser um domingo.');
  end if;

  select te.nome
  into v_tipo_nome
  from public.tipos_escala te
  where te.id = p_tipo_escala_id
    and te.is_ativa = true
  limit 1;

  if v_tipo_nome is null then
    return jsonb_build_object('success', false, 'message', 'Tipo de escala não encontrado ou inativo.');
  end if;

  select ve.nome
  into v_voluntario_nome
  from public.voluntarios_escala ve
  where ve.id = p_voluntario_id
    and ve.tipo_escala_id = p_tipo_escala_id
    and ve.is_ativo = true
  limit 1;

  if v_voluntario_nome is null then
    return jsonb_build_object('success', false, 'message', 'Servo não encontrado ou inativo neste tipo de escala.');
  end if;

  if exists (
    select 1
    from public.escalas_log el
    where el.tipo_escala_id = p_tipo_escala_id
      and el.data_servico = p_data_servico
      and el.voluntario_id <> p_voluntario_id
  ) then
    select ve.nome
      into v_existing_voluntario
      from public.escalas_log el
      join public.voluntarios_escala ve on ve.id = el.voluntario_id
     where el.tipo_escala_id = p_tipo_escala_id
       and el.data_servico = p_data_servico
     limit 1;

    return jsonb_build_object(
      'success', false,
      'message',
      format('Já existe escala para %s neste domingo (%s).', coalesce(v_existing_voluntario, 'outro servo'), p_data_servico)
    );
  end if;

  if exists (
    select 1
    from public.escalas_log el
    where el.tipo_escala_id = p_tipo_escala_id
      and el.voluntario_id = p_voluntario_id
      and el.data_servico = p_data_servico
  ) then
    return jsonb_build_object(
      'success', false,
      'message', 'Este servo já está escalado para esta data.'
    );
  end if;

  insert into public.escalas_log (tipo_escala_id, voluntario_id, data_servico)
  values (p_tipo_escala_id, p_voluntario_id, p_data_servico);

  return jsonb_build_object(
    'success', true,
    'message', 'Escala registrada com sucesso.',
    'voluntario_nome', v_voluntario_nome,
    'tipo_escala_nome', v_tipo_nome,
    'data_servico', p_data_servico
  );
exception
  when unique_violation then
    return jsonb_build_object(
      'success', false,
      'message', 'Já existe escala para este domingo neste tipo de escala.'
    );
end;
$$;

grant execute on function public.listar_voluntarios_escala(uuid) to anon;
grant execute on function public.listar_voluntarios_escala(uuid) to authenticated;
grant execute on function public.registrar_escala_manual(uuid, uuid, date) to anon;
grant execute on function public.registrar_escala_manual(uuid, uuid, date) to authenticated;

drop function if exists public.excluir_escala(uuid);

create or replace function public.excluir_escala(p_escala_log_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data_servico date;
  v_voluntario_nome text;
begin
  if p_escala_log_id is null then
    return jsonb_build_object('success', false, 'message', 'Escala não informada.');
  end if;

  select el.data_servico, ve.nome
  into v_data_servico, v_voluntario_nome
  from public.escalas_log el
  join public.voluntarios_escala ve on ve.id = el.voluntario_id
  where el.id = p_escala_log_id
  limit 1;

  if v_data_servico is null then
    return jsonb_build_object('success', false, 'message', 'Escala não encontrada.');
  end if;

  delete from public.escalas_log
  where id = p_escala_log_id;

  return jsonb_build_object(
    'success', true,
    'message', format('Escala de %s em %s removida.', v_voluntario_nome, v_data_servico)
  );
end;
$$;

grant execute on function public.excluir_escala(uuid) to anon;
grant execute on function public.excluir_escala(uuid) to authenticated;

-- M3: inserção direta em escalas_log bloqueada — use registrar_escala_manual ou aplicar_ciclo_escala.
drop policy if exists escalas_log_insert_policy on public.escalas_log;

drop policy if exists voluntarios_escala_update_policy on public.voluntarios_escala;
create policy voluntarios_escala_update_policy
on public.voluntarios_escala
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists escalas_log_delete_policy on public.escalas_log;
create policy escalas_log_delete_policy
on public.escalas_log
for delete
to anon, authenticated
using (true);

revoke insert on public.escalas_log from anon, authenticated;
grant delete on public.escalas_log to anon;
grant delete on public.escalas_log to authenticated;
grant update on public.voluntarios_escala to anon;
grant update on public.voluntarios_escala to authenticated;
