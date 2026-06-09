-- Cadastro de voluntários em voluntarios_escala (a partir de profiles).
-- Execute após scripts/vigilancia-escalas.sql e scripts/escalas-maintenance-rpc.sql

alter table public.voluntarios_escala
  add column if not exists ordem_sequencial integer;

comment on column public.voluntarios_escala.ordem_sequencial is
  'Ordem do ciclo rotativo de domingos (menor = primeiro na sequência).';

create or replace function public.trg_voluntarios_escala_ordem_sequencial()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.ordem_sequencial is null then
    select coalesce(max(ve.ordem_sequencial), 0) + 1
    into new.ordem_sequencial
    from public.voluntarios_escala ve
    where ve.tipo_escala_id = new.tipo_escala_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_voluntarios_escala_ordem_sequencial on public.voluntarios_escala;
create trigger trg_voluntarios_escala_ordem_sequencial
before insert on public.voluntarios_escala
for each row
execute function public.trg_voluntarios_escala_ordem_sequencial();

create or replace function public.garantir_ordem_sequencial_voluntario(
  p_tipo_escala_id uuid,
  p_voluntario_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ordem integer;
  v_proxima integer;
begin
  if p_tipo_escala_id is null or p_voluntario_id is null then
    return jsonb_build_object('success', false, 'message', 'Parâmetros inválidos.');
  end if;

  select ve.ordem_sequencial
  into v_ordem
  from public.voluntarios_escala ve
  where ve.id = p_voluntario_id
    and ve.tipo_escala_id = p_tipo_escala_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Servo não encontrado.');
  end if;

  if v_ordem is not null then
    return jsonb_build_object(
      'success', true,
      'ordem_sequencial', v_ordem,
      'message', 'Ordem sequencial já definida.'
    );
  end if;

  select coalesce(max(ve.ordem_sequencial), 0) + 1
  into v_proxima
  from public.voluntarios_escala ve
  where ve.tipo_escala_id = p_tipo_escala_id;

  update public.voluntarios_escala ve
  set ordem_sequencial = v_proxima
  where ve.id = p_voluntario_id
    and ve.tipo_escala_id = p_tipo_escala_id;

  return jsonb_build_object(
    'success', true,
    'ordem_sequencial', v_proxima,
    'message', 'Ordem sequencial atribuída.'
  );
end;
$$;

grant execute on function public.garantir_ordem_sequencial_voluntario(uuid, uuid) to anon;
grant execute on function public.garantir_ordem_sequencial_voluntario(uuid, uuid) to authenticated;

create or replace function public.cadastrar_voluntario_escala(
  p_tipo_escala_id uuid,
  p_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_tipo_nome text;
  v_voluntario_id uuid;
  v_proxima_ordem integer;
begin
  if p_tipo_escala_id is null then
    return jsonb_build_object('success', false, 'message', 'Tipo de escala não informado.');
  end if;

  if p_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
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

  select nullif(trim(p.full_name), '')
  into v_nome
  from public.profiles p
  where p.id = p_profile_id
  limit 1;

  if v_nome is null then
    return jsonb_build_object('success', false, 'message', 'Perfil sem nome cadastrado.');
  end if;

  if exists (
    select 1
    from public.voluntarios_escala ve
    where ve.tipo_escala_id = p_tipo_escala_id
      and lower(trim(ve.nome)) = lower(trim(v_nome))
  ) then
    return jsonb_build_object(
      'success', false,
      'message',
      'Este servo já está cadastrado neste tipo de escala.'
    );
  end if;

  select coalesce(max(ve.ordem_sequencial), 0) + 1
  into v_proxima_ordem
  from public.voluntarios_escala ve
  where ve.tipo_escala_id = p_tipo_escala_id;

  insert into public.voluntarios_escala (tipo_escala_id, nome, is_ativo, ordem_sequencial)
  values (p_tipo_escala_id, trim(v_nome), true, v_proxima_ordem)
  returning id into v_voluntario_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Servo associado à escala com sucesso.',
    'voluntario_id', v_voluntario_id,
    'nome', trim(v_nome),
    'ordem_sequencial', v_proxima_ordem,
    'tipo_escala_nome', v_tipo_nome
  );
exception
  when unique_violation then
    return jsonb_build_object(
      'success', false,
      'message', 'Este servo já está cadastrado neste tipo de escala.'
    );
end;
$$;

grant execute on function public.cadastrar_voluntario_escala(uuid, uuid) to anon;
grant execute on function public.cadastrar_voluntario_escala(uuid, uuid) to authenticated;

create or replace function public.remover_voluntario_escala(
  p_tipo_escala_id uuid,
  p_voluntario_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_removed_order integer;
  v_future_escalas_count integer := 0;
  v_message text;
begin
  if p_tipo_escala_id is null then
    return jsonb_build_object('success', false, 'message', 'Tipo de escala não informado.');
  end if;

  if p_voluntario_id is null then
    return jsonb_build_object('success', false, 'message', 'Servo não informado.');
  end if;

  select ve.nome, ve.ordem_sequencial
    into v_nome, v_removed_order
    from public.voluntarios_escala ve
   where ve.id = p_voluntario_id
     and ve.tipo_escala_id = p_tipo_escala_id
   limit 1;

  if v_nome is null then
    return jsonb_build_object('success', false, 'message', 'Servo não encontrado neste tipo de escala.');
  end if;

  select count(*)
    into v_future_escalas_count
    from public.escalas_log el
   where el.tipo_escala_id = p_tipo_escala_id
     and el.voluntario_id = p_voluntario_id
     and el.data_servico >= current_date;

  delete from public.voluntarios_escala ve
   where ve.id = p_voluntario_id
     and ve.tipo_escala_id = p_tipo_escala_id;

  if v_removed_order is not null then
    update public.voluntarios_escala ve
       set ordem_sequencial = ve.ordem_sequencial - 1
     where ve.tipo_escala_id = p_tipo_escala_id
       and ve.is_ativo = true
       and ve.ordem_sequencial > v_removed_order;
  end if;

  v_message := 'Servo removido da lista deste tipo de escala.';

  if coalesce(v_future_escalas_count, 0) > 0 then
    v_message := v_message
      || format(' Atenção: %s escala(s) futura(s) deste servo permanecem em escalas_log.', v_future_escalas_count);
  end if;

  return jsonb_build_object(
    'success', true,
    'message', v_message,
    'nome', trim(v_nome),
    'future_escalas_count', coalesce(v_future_escalas_count, 0),
    'reordered', v_removed_order is not null
  );
end;
$$;

grant execute on function public.remover_voluntario_escala(uuid, uuid) to anon;
grant execute on function public.remover_voluntario_escala(uuid, uuid) to authenticated;

-- Fallback do app: DELETE direto em voluntarios_escala (além da RPC security definer).
drop policy if exists voluntarios_escala_delete_policy on public.voluntarios_escala;
create policy voluntarios_escala_delete_policy
on public.voluntarios_escala
for delete
to anon, authenticated
using (true);

grant delete on public.voluntarios_escala to anon;
grant delete on public.voluntarios_escala to authenticated;
