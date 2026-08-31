-- =============================================================================
-- Empréstimos de livros — prazos, avisos e gestão da Secretaria
-- =============================================================================
-- NÃO recria public.livros nem a busca ISBN.
-- Isolamento: tenant_id da sessão. Escritas só por RPC SECURITY DEFINER.
-- Aplica: npx supabase db query --linked -f scripts/emprestimos-livros.sql
-- =============================================================================

create table if not exists public.emprestimos_livros (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  livro_id uuid null references public.livros (id) on delete set null,
  titulo_livro_externo text null,
  user_id uuid null references public.profiles (id) on delete set null,
  nome_retirante_externo text null,
  data_retirada timestamptz not null default now(),
  data_prevista_retirada timestamptz null,
  data_prevista_entrega timestamptz not null default (now() + interval '30 days'),
  data_devolucao_real timestamptz null,
  status text not null default 'ativo'
    check (status in ('ativo', 'devolvido', 'atrasado', 'reservado', 'cancelado')),
  constraint emprestimos_livros_livro_origem_check
    check (
      livro_id is not null
      or length(trim(coalesce(titulo_livro_externo, ''))) >= 1
    ),
  constraint emprestimos_livros_retirante_check
    check (
      user_id is not null
      or length(trim(coalesce(nome_retirante_externo, ''))) >= 1
    )
);

create index if not exists emprestimos_livros_tenant_status_idx
  on public.emprestimos_livros (tenant_id, status, data_prevista_entrega);

create index if not exists emprestimos_livros_tenant_user_idx
  on public.emprestimos_livros (tenant_id, user_id, data_retirada desc);

create unique index if not exists emprestimos_livros_livro_ativo_uidx
  on public.emprestimos_livros (tenant_id, livro_id)
  where status in ('ativo', 'atrasado', 'reservado') and livro_id is not null;

comment on table public.emprestimos_livros is
  'Saídas e reservas do acervo e de livros externos. Isolado por tenant_id.';

alter table public.emprestimos_livros
  add column if not exists data_prevista_retirada timestamptz null;

do $$
declare
  r record;
begin
  for r in
    select c.conname
      from pg_constraint c
     where c.conrelid = 'public.emprestimos_livros'::regclass
       and c.contype = 'c'
       and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format('alter table public.emprestimos_livros drop constraint if exists %I', r.conname);
  end loop;
end $$;

alter table public.emprestimos_livros
  add constraint emprestimos_livros_status_check
  check (status in ('ativo', 'devolvido', 'atrasado', 'reservado', 'cancelado'));

drop index if exists public.emprestimos_livros_livro_ativo_uidx;
create unique index emprestimos_livros_livro_ativo_uidx
  on public.emprestimos_livros (tenant_id, livro_id)
  where status in ('ativo', 'atrasado', 'reservado') and livro_id is not null;

create table if not exists public.emprestimo_livros_notices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  emprestimo_id uuid not null references public.emprestimos_livros (id) on delete cascade,
  marco text not null check (marco in ('10', '5', '2', '0')),
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz null,
  constraint emprestimo_livros_notices_unique unique (emprestimo_id, marco)
);

create index if not exists emprestimo_livros_notices_unread_idx
  on public.emprestimo_livros_notices (tenant_id, profile_id, created_at desc)
  where read_at is null;

alter table public.emprestimos_livros enable row level security;
alter table public.emprestimo_livros_notices enable row level security;

drop policy if exists emprestimos_livros_member_select on public.emprestimos_livros;
create policy emprestimos_livros_member_select
  on public.emprestimos_livros
  for select
  using (
    public.session_tenant_matches(tenant_id)
    and user_id is not null
    and user_id = public.current_session_profile_id()
  );

drop policy if exists emprestimos_livros_staff_select on public.emprestimos_livros;
create policy emprestimos_livros_staff_select
  on public.emprestimos_livros
  for select
  using (
    public.session_tenant_matches(tenant_id)
    and (
      public.is_super_admin_profile(public.current_session_profile_id())
      or public.profile_has_role_code(public.current_session_profile_id(), 'secretaria')
      or public.profile_has_role_code(public.current_session_profile_id(), 'gestor_controle_acesso')
      or public.profile_has_access(
        public.current_session_profile_id(),
        'screen',
        '/livros-doados',
        'view'
      )
    )
    -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
    and (
      user_id is null
      or public.profile_visible_to_access_actor(public.current_session_profile_id(), user_id)
    )
  );

drop policy if exists emprestimos_livros_deny_write on public.emprestimos_livros;
create policy emprestimos_livros_deny_write
  on public.emprestimos_livros
  for insert
  with check (false);

drop policy if exists emprestimos_livros_deny_update on public.emprestimos_livros;
create policy emprestimos_livros_deny_update
  on public.emprestimos_livros
  for update
  using (false)
  with check (false);

drop policy if exists emprestimos_livros_deny_delete on public.emprestimos_livros;
create policy emprestimos_livros_deny_delete
  on public.emprestimos_livros
  for delete
  using (false);

drop policy if exists emprestimo_livros_notices_member_select on public.emprestimo_livros_notices;
create policy emprestimo_livros_notices_member_select
  on public.emprestimo_livros_notices
  for select
  using (
    public.session_tenant_matches(tenant_id)
    and profile_id = public.current_session_profile_id()
  );

drop policy if exists emprestimo_livros_notices_deny_write on public.emprestimo_livros_notices;
create policy emprestimo_livros_notices_deny_write
  on public.emprestimo_livros_notices
  for all
  using (false)
  with check (false);

revoke all on table public.emprestimos_livros from anon, public;
revoke all on table public.emprestimo_livros_notices from anon, public;
grant select on table public.emprestimos_livros to authenticated;
grant select on table public.emprestimo_livros_notices to authenticated;

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  (
    'table',
    'emprestimos_livros',
    'Empréstimos de livros',
    null,
    true
  )
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      is_active = true;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
 cross join public.access_resources res
 where r.code in ('secretaria', 'gestor_controle_acesso', 'super_admin')
   and res.resource_type = 'table'
   and res.resource_key = 'emprestimos_livros'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.assert_secretaria_or_gestor_shield(p_actor uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Mesmo conjunto operacional do acervo: SA, Secretaria, Gestor ou grant da tela.
  perform public.assert_can_manage_livros(p_actor);
end;
$$;

create or replace function public.emprestimo_livro_dias_restantes(p_due timestamptz)
returns integer
language sql
stable
as $$
  select (
    (p_due at time zone 'America/Sao_Paulo')::date
    - (timezone('America/Sao_Paulo', now()))::date
  );
$$;

create or replace function public.emprestimo_livro_status_efetivo(
  p_status text,
  p_devolucao timestamptz,
  p_due timestamptz
)
returns text
language sql
stable
as $$
  select case
    when lower(trim(coalesce(p_status, ''))) = 'cancelado'
      then 'cancelado'
    when p_devolucao is not null or lower(trim(coalesce(p_status, ''))) = 'devolvido'
      then 'devolvido'
    when lower(trim(coalesce(p_status, ''))) = 'reservado'
      then 'reservado'
    when public.emprestimo_livro_dias_restantes(p_due) < 0
      then 'atrasado'
    else 'ativo'
  end;
$$;

create or replace function public.emprestimo_livro_json(p_row public.emprestimos_livros)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_titulo text;
  v_retirante text;
  v_phone text;
  v_desligado boolean := false;
  v_status text;
  v_dias integer;
begin
  v_status := public.emprestimo_livro_status_efetivo(
    p_row.status,
    p_row.data_devolucao_real,
    p_row.data_prevista_entrega
  );
  if v_status = 'reservado' then
    v_dias := public.emprestimo_livro_dias_restantes(
      coalesce(p_row.data_prevista_retirada, p_row.data_retirada)
    );
  else
    v_dias := public.emprestimo_livro_dias_restantes(p_row.data_prevista_entrega);
  end if;

  if p_row.livro_id is not null then
    select l.titulo into v_titulo from public.livros l where l.id = p_row.livro_id;
  end if;
  v_titulo := coalesce(nullif(trim(v_titulo), ''), nullif(trim(p_row.titulo_livro_externo), ''), 'Livro');

  if p_row.user_id is not null then
    select
      p.full_name,
      p.phone,
      (p.membership_out is not null)
      into v_retirante, v_phone, v_desligado
      from public.profiles p
     where p.id = p_row.user_id;
  end if;
  v_retirante := coalesce(
    nullif(trim(v_retirante), ''),
    nullif(trim(p_row.nome_retirante_externo), ''),
    'Retirante'
  );

  return jsonb_build_object(
    'id', p_row.id,
    'tenant_id', p_row.tenant_id,
    'livro_id', p_row.livro_id,
    'titulo', v_titulo,
    'titulo_livro_externo', p_row.titulo_livro_externo,
    'user_id', p_row.user_id,
    'nome_retirante', v_retirante,
    'nome_retirante_externo', p_row.nome_retirante_externo,
    'phone', v_phone,
    'retirante_desligado', coalesce(v_desligado, false),
    'data_retirada', p_row.data_retirada,
    'data_prevista_retirada', p_row.data_prevista_retirada,
    'data_prevista_entrega', p_row.data_prevista_entrega,
    'data_devolucao_real', p_row.data_devolucao_real,
    'status', v_status,
    'dias_restantes', v_dias
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Alertas 10 / 5 / 2 / vencimento (lazy, no read)
-- ---------------------------------------------------------------------------

create or replace function public.dispatch_emprestimo_livros_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  rec record;
  v_dias integer;
  v_marco text;
  v_titulo text;
  v_title text;
  v_body text;
begin
  for rec in
    select e.*
      from public.emprestimos_livros e
     where e.tenant_id = v_tenant
       and e.user_id is not null
       and e.data_devolucao_real is null
       and e.status in ('ativo', 'atrasado')
  loop
    v_dias := public.emprestimo_livro_dias_restantes(rec.data_prevista_entrega);

    if v_dias < 0 and rec.status = 'ativo' then
      update public.emprestimos_livros
         set status = 'atrasado'
       where id = rec.id
         and status = 'ativo';
    end if;

    if v_dias not in (10, 5, 2, 0) then
      continue;
    end if;

    v_marco := v_dias::text;
    v_titulo := coalesce(
      (
        select l.titulo from public.livros l where l.id = rec.livro_id
      ),
      rec.titulo_livro_externo,
      'livro'
    );

    if v_dias = 0 then
      v_title := 'Hoje vence o prazo do livro';
      v_body := format('Hoje é o dia de devolver «%s». Procure a Secretaria.', v_titulo);
    elsif v_dias = 2 then
      v_title := 'Faltam 2 dias para devolver o livro';
      v_body := format('«%s» vence em 2 dias. Combine a devolução com a Secretaria.', v_titulo);
    elsif v_dias = 5 then
      v_title := 'Faltam 5 dias para devolver o livro';
      v_body := format('«%s» vence em 5 dias.', v_titulo);
    else
      v_title := 'Seu livro vence em 10 dias';
      v_body := format('«%s» deve ser devolvido em 10 dias.', v_titulo);
    end if;

    insert into public.emprestimo_livros_notices (
      tenant_id, profile_id, emprestimo_id, marco, title, body
    )
    values (rec.tenant_id, rec.user_id, rec.id, v_marco, v_title, v_body)
    on conflict (emprestimo_id, marco) do nothing;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPCs membro
-- ---------------------------------------------------------------------------

create or replace function public.list_my_emprestimos_livros()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_rows jsonb;
begin
  if v_me is null then
    raise exception 'Sessão inválida. Saia e entre novamente.';
  end if;

  perform public.dispatch_emprestimo_livros_reminders();

  select coalesce(
    jsonb_agg(
      public.emprestimo_livro_json(e)
      order by
        case when e.status = 'reservado' then 0 else 1 end,
        coalesce(e.data_prevista_retirada, e.data_retirada) asc,
        e.data_prevista_entrega asc
    ),
    '[]'::jsonb
  )
    into v_rows
    from public.emprestimos_livros e
   where e.tenant_id = v_tenant
     and e.user_id = v_me
     and e.data_devolucao_real is null
     and e.status in ('ativo', 'atrasado', 'reservado');

  return jsonb_build_object('success', true, 'rows', v_rows);
end;
$$;

create or replace function public.list_unread_emprestimo_livros_notices()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_rows jsonb;
begin
  if v_me is null then
    return jsonb_build_object('success', true, 'notices', '[]'::jsonb);
  end if;

  perform public.dispatch_emprestimo_livros_reminders();

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', n.id,
      'title', n.title,
      'body', n.body,
      'created_at', n.created_at,
      'read_at', n.read_at
    )
    order by n.created_at desc
  ), '[]'::jsonb)
    into v_rows
    from (
      select nn.id, nn.title, nn.body, nn.created_at, nn.read_at
        from public.emprestimo_livros_notices nn
       where nn.tenant_id = v_tenant
         and nn.profile_id = v_me
         and nn.read_at is null
       order by nn.created_at desc
       limit 30
    ) n;

  return jsonb_build_object('success', true, 'notices', v_rows);
end;
$$;

create or replace function public.mark_emprestimo_livros_notices_read()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
begin
  if v_me is null then
    return jsonb_build_object('success', false);
  end if;

  update public.emprestimo_livros_notices
     set read_at = now()
   where tenant_id = v_tenant
     and profile_id = v_me
     and read_at is null;

  return jsonb_build_object('success', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPCs Secretaria
-- ---------------------------------------------------------------------------

create or replace function public.search_profiles_for_emprestimo(p_search text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_q text := lower(trim(coalesce(p_search, '')));
  v_rows jsonb;
begin
  -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  perform public.assert_secretaria_or_gestor_shield(v_actor);

  if length(v_q) < 2 then
    return jsonb_build_object('success', true, 'rows', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'phone', p.phone,
      'codigo_membro', p.codigo_membro,
      'desligado', p.desligado
    )
    order by lower(coalesce(p.full_name, ''))
  ), '[]'::jsonb)
    into v_rows
    from (
      select
        pr.id,
        pr.full_name,
        pr.phone,
        pr.codigo_membro,
        (pr.membership_out is not null) as desligado
        from public.profiles pr
        join public.profile_igreja_vinculos v
          on v.profile_id = pr.id
         and v.tenant_id = v_tenant
       where public.profile_visible_to_access_actor(v_actor, pr.id)
         and (
         lower(coalesce(pr.full_name, '')) like '%' || v_q || '%'
         or (
           length(regexp_replace(v_q, '\D', '', 'g')) >= 2
           and regexp_replace(coalesce(pr.phone, ''), '\D', '', 'g')
               like '%' || regexp_replace(v_q, '\D', '', 'g') || '%'
         )
       )
       order by lower(coalesce(pr.full_name, ''))
       limit 25
    ) p;

  return jsonb_build_object('success', true, 'rows', coalesce(v_rows, '[]'::jsonb));
end;
$$;

create or replace function public.list_emprestimos_livros_staff(p_scope text default 'ativos')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_scope text := lower(trim(coalesce(p_scope, 'ativos')));
  v_rows jsonb;
begin
  perform public.assert_secretaria_or_gestor_shield(v_actor);
  perform public.dispatch_emprestimo_livros_reminders();

  if v_scope = 'historico' then
    select coalesce(jsonb_agg(public.emprestimo_livro_json(e) order by e.data_devolucao_real desc nulls last, e.data_retirada desc), '[]'::jsonb)
      into v_rows
      from public.emprestimos_livros e
     where e.tenant_id = v_tenant
       and (
         e.data_devolucao_real is not null
         or e.status in ('devolvido', 'cancelado')
       )
       and (
         e.user_id is null
         or public.profile_visible_to_access_actor(v_actor, e.user_id)
       );
  else
    select coalesce(jsonb_agg(public.emprestimo_livro_json(e) order by e.data_prevista_entrega asc), '[]'::jsonb)
      into v_rows
      from public.emprestimos_livros e
     where e.tenant_id = v_tenant
       and e.data_devolucao_real is null
       and e.status in ('ativo', 'atrasado', 'reservado')
       and (
         e.user_id is null
         or public.profile_visible_to_access_actor(v_actor, e.user_id)
       );
  end if;

  return jsonb_build_object('success', true, 'rows', coalesce(v_rows, '[]'::jsonb));
end;
$$;

create or replace function public.create_emprestimo_livro(
  p_livro_id uuid default null,
  p_titulo_livro_externo text default null,
  p_user_id uuid default null,
  p_nome_retirante_externo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_titulo_ext text := nullif(trim(coalesce(p_titulo_livro_externo, '')), '');
  v_nome_ext text := nullif(trim(coalesce(p_nome_retirante_externo, '')), '');
  v_livro public.livros;
  v_row public.emprestimos_livros;
begin
  perform public.assert_secretaria_or_gestor_shield(v_actor);

  if p_livro_id is null and v_titulo_ext is null then
    return jsonb_build_object('success', false, 'message', 'Informe um livro do acervo ou o título externo.');
  end if;

  if p_user_id is null and v_nome_ext is null then
    return jsonb_build_object('success', false, 'message', 'Informe o membro ou o nome do retirante externo.');
  end if;

  if p_livro_id is not null then
    select * into v_livro
      from public.livros l
     where l.id = p_livro_id
       and l.tenant_id = v_tenant;

    if v_livro.id is null then
      return jsonb_build_object('success', false, 'message', 'Livro não encontrado no acervo desta igreja.');
    end if;

    if exists (
      select 1
        from public.emprestimos_livros e
       where e.tenant_id = v_tenant
         and e.livro_id = p_livro_id
         and e.data_devolucao_real is null
         and e.status in ('ativo', 'atrasado', 'reservado')
    ) then
      return jsonb_build_object('success', false, 'message', 'Este livro já está emprestado ou reservado.');
    end if;
  end if;

  if p_user_id is not null then
    -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
    if not public.profile_visible_to_access_actor(v_actor, p_user_id) then
      return jsonb_build_object('success', false, 'message', 'Membro não encontrado.');
    end if;

    if not exists (
      select 1
        from public.profile_igreja_vinculos v
       where v.profile_id = p_user_id
         and v.tenant_id = v_tenant
    ) then
      return jsonb_build_object('success', false, 'message', 'Membro não vinculado a esta igreja.');
    end if;
  end if;

  insert into public.emprestimos_livros (
    tenant_id,
    livro_id,
    titulo_livro_externo,
    user_id,
    nome_retirante_externo,
    data_retirada,
    data_prevista_entrega,
    status
  )
  values (
    v_tenant,
    p_livro_id,
    v_titulo_ext,
    p_user_id,
    v_nome_ext,
    now(),
    now() + interval '30 days',
    'ativo'
  )
  returning * into v_row;

  return jsonb_build_object(
    'success', true,
    'message', 'Empréstimo registrado. Prazo de 30 dias.',
    'row', public.emprestimo_livro_json(v_row)
  );
end;
$$;

create or replace function public.devolver_emprestimo_livro(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_row public.emprestimos_livros;
begin
  perform public.assert_secretaria_or_gestor_shield(v_actor);

  select * into v_row
    from public.emprestimos_livros e
   where e.id = p_id
     and e.tenant_id = v_tenant;

  if v_row.id is null then
    return jsonb_build_object('success', false, 'message', 'Empréstimo não encontrado.');
  end if;

  if v_row.data_devolucao_real is not null or v_row.status in ('devolvido', 'cancelado') then
    return jsonb_build_object('success', false, 'message', 'Este empréstimo já foi devolvido.');
  end if;

  if v_row.status = 'reservado' then
    return jsonb_build_object('success', false, 'message', 'Esta é uma reserva. Confirme a retirada ou cancele a reserva.');
  end if;

  update public.emprestimos_livros
     set status = 'devolvido',
         data_devolucao_real = now()
   where id = p_id
     and tenant_id = v_tenant
  returning * into v_row;

  return jsonb_build_object(
    'success', true,
    'message', 'Devolução registrada. O item está disponível.',
    'row', public.emprestimo_livro_json(v_row)
  );
end;
$$;

create or replace function public.renovar_emprestimo_livro(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_row public.emprestimos_livros;
begin
  perform public.assert_secretaria_or_gestor_shield(v_actor);

  select * into v_row
    from public.emprestimos_livros e
   where e.id = p_id
     and e.tenant_id = v_tenant;

  if v_row.id is null then
    return jsonb_build_object('success', false, 'message', 'Empréstimo não encontrado.');
  end if;

  if v_row.data_devolucao_real is not null or v_row.status in ('devolvido', 'cancelado', 'reservado') then
    return jsonb_build_object('success', false, 'message', 'Não é possível renovar uma reserva ou um empréstimo já encerrado.');
  end if;

  update public.emprestimos_livros
     set data_prevista_entrega = coalesce(data_prevista_entrega, now()) + interval '10 days',
         status = 'ativo'
   where id = p_id
     and tenant_id = v_tenant
  returning * into v_row;

  return jsonb_build_object(
    'success', true,
    'message', 'Prazo renovado por mais 10 dias.',
    'row', public.emprestimo_livro_json(v_row)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Reserva pelo membro + confirmação pela Secretaria
-- ---------------------------------------------------------------------------

create or replace function public.emprestimo_ts_from_iso_date(p_date text)
returns timestamptz
language plpgsql
stable
as $$
declare
  v text := nullif(trim(coalesce(p_date, '')), '');
begin
  if v is null or v !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;
  return (v || ' 12:00:00')::timestamp at time zone 'America/Sao_Paulo';
end;
$$;

create or replace function public.list_livros_disponiveis_reserva()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_rows jsonb;
begin
  if v_me is null then
    raise exception 'Sessão inválida. Saia e entre novamente.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by lower(x.titulo)), '[]'::jsonb)
    into v_rows
    from (
      select
        l.id,
        l.tenant_id,
        l.isbn,
        l.titulo,
        l.autor,
        l.editora,
        l.ano,
        l.capa,
        l.criado_em
      from public.livros l
      where l.tenant_id = v_tenant
        and not exists (
          select 1
            from public.emprestimos_livros e
           where e.tenant_id = v_tenant
             and e.livro_id = l.id
             and e.data_devolucao_real is null
             and e.status in ('ativo', 'atrasado', 'reservado')
        )
    ) x;

  return jsonb_build_object('success', true, 'rows', coalesce(v_rows, '[]'::jsonb));
end;
$$;

create or replace function public.reservar_livro_acervo(
  p_livro_id uuid,
  p_data_retirada text,
  p_data_retorno text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_livro public.livros;
  v_pickup timestamptz;
  v_retorno timestamptz;
  v_today date := (timezone('America/Sao_Paulo', now()))::date;
  v_row public.emprestimos_livros;
  v_open integer;
begin
  if v_me is null then
    raise exception 'Sessão inválida. Saia e entre novamente.';
  end if;

  if p_livro_id is null then
    return jsonb_build_object('success', false, 'message', 'Escolha um livro do acervo.');
  end if;

  v_pickup := public.emprestimo_ts_from_iso_date(p_data_retirada);
  if v_pickup is null then
    return jsonb_build_object('success', false, 'message', 'Informe a data prevista de retirada (AAAA-MM-DD).');
  end if;

  if coalesce(nullif(trim(p_data_retorno), ''), '') = '' then
    v_retorno := v_pickup + interval '30 days';
  else
    v_retorno := public.emprestimo_ts_from_iso_date(p_data_retorno);
  end if;

  if v_retorno is null then
    return jsonb_build_object('success', false, 'message', 'Informe a data prevista de devolução (AAAA-MM-DD).');
  end if;

  if (v_pickup at time zone 'America/Sao_Paulo')::date < v_today then
    return jsonb_build_object('success', false, 'message', 'A data de retirada não pode ser anterior a hoje.');
  end if;

  if (v_retorno at time zone 'America/Sao_Paulo')::date <= (v_pickup at time zone 'America/Sao_Paulo')::date then
    return jsonb_build_object('success', false, 'message', 'A data de devolução deve ser depois da retirada.');
  end if;

  if (v_retorno at time zone 'America/Sao_Paulo')::date
     > ((v_pickup at time zone 'America/Sao_Paulo')::date + 90) then
    return jsonb_build_object('success', false, 'message', 'O prazo de devolução não pode passar de 90 dias.');
  end if;

  select * into v_livro
    from public.livros l
   where l.id = p_livro_id
     and l.tenant_id = v_tenant;

  if v_livro.id is null then
    return jsonb_build_object('success', false, 'message', 'Livro não encontrado no acervo desta igreja.');
  end if;

  if exists (
    select 1
      from public.emprestimos_livros e
     where e.tenant_id = v_tenant
       and e.livro_id = p_livro_id
       and e.data_devolucao_real is null
       and e.status in ('ativo', 'atrasado', 'reservado')
  ) then
    return jsonb_build_object('success', false, 'message', 'Este livro já está emprestado ou reservado.');
  end if;

  select count(*)::integer into v_open
    from public.emprestimos_livros e
   where e.tenant_id = v_tenant
     and e.user_id = v_me
     and e.data_devolucao_real is null
     and e.status = 'reservado';

  if coalesce(v_open, 0) >= 3 then
    return jsonb_build_object('success', false, 'message', 'Você já tem 3 reservas ativas. Cancele uma para reservar outro título.');
  end if;

  insert into public.emprestimos_livros (
    tenant_id,
    livro_id,
    user_id,
    data_retirada,
    data_prevista_retirada,
    data_prevista_entrega,
    status
  )
  values (
    v_tenant,
    p_livro_id,
    v_me,
    v_pickup,
    v_pickup,
    v_retorno,
    'reservado'
  )
  returning * into v_row;

  return jsonb_build_object(
    'success', true,
    'message', 'Reserva registrada. Retire o livro na Secretaria na data combinada.',
    'row', public.emprestimo_livro_json(v_row)
  );
end;
$$;

create or replace function public.cancelar_reserva_livro(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_row public.emprestimos_livros;
  v_staff boolean := false;
begin
  if v_me is null then
    raise exception 'Sessão inválida. Saia e entre novamente.';
  end if;

  select * into v_row
    from public.emprestimos_livros e
   where e.id = p_id
     and e.tenant_id = v_tenant;

  if v_row.id is null then
    return jsonb_build_object('success', false, 'message', 'Reserva não encontrada.');
  end if;

  if v_row.status is distinct from 'reservado' then
    return jsonb_build_object('success', false, 'message', 'Só é possível cancelar uma reserva ainda não retirada.');
  end if;

  begin
    perform public.assert_secretaria_or_gestor_shield(v_me);
    v_staff := true;
  exception
    when others then
      v_staff := false;
  end;

  if not v_staff and v_row.user_id is distinct from v_me then
    return jsonb_build_object('success', false, 'message', 'Você só pode cancelar a sua própria reserva.');
  end if;

  update public.emprestimos_livros
     set status = 'cancelado',
         data_devolucao_real = now()
   where id = p_id
     and tenant_id = v_tenant
  returning * into v_row;

  return jsonb_build_object(
    'success', true,
    'message', 'Reserva cancelada. O livro voltou ao acervo.',
    'row', public.emprestimo_livro_json(v_row)
  );
end;
$$;

create or replace function public.confirmar_retirada_reserva(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_row public.emprestimos_livros;
  v_due timestamptz;
begin
  perform public.assert_secretaria_or_gestor_shield(v_actor);

  select * into v_row
    from public.emprestimos_livros e
   where e.id = p_id
     and e.tenant_id = v_tenant;

  if v_row.id is null then
    return jsonb_build_object('success', false, 'message', 'Reserva não encontrada.');
  end if;

  if v_row.status is distinct from 'reservado' then
    return jsonb_build_object('success', false, 'message', 'Este registro não é uma reserva pendente.');
  end if;

  v_due := v_row.data_prevista_entrega;
  if v_due is null or public.emprestimo_livro_dias_restantes(v_due) < 0 then
    v_due := now() + interval '30 days';
  end if;

  update public.emprestimos_livros
     set status = 'ativo',
         data_retirada = now(),
         data_prevista_entrega = v_due
   where id = p_id
     and tenant_id = v_tenant
  returning * into v_row;

  return jsonb_build_object(
    'success', true,
    'message', 'Retirada confirmada. O prazo de devolução permanece o combinado.',
    'row', public.emprestimo_livro_json(v_row)
  );
end;
$$;

revoke all on function public.dispatch_emprestimo_livros_reminders() from public, anon, authenticated;
revoke all on function public.emprestimo_livro_json(public.emprestimos_livros) from public, anon, authenticated;

grant execute on function public.assert_secretaria_or_gestor_shield(uuid) to anon, authenticated;
grant execute on function public.emprestimo_livro_dias_restantes(timestamptz) to anon, authenticated;
grant execute on function public.emprestimo_livro_status_efetivo(text, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.list_my_emprestimos_livros() to anon, authenticated;
grant execute on function public.list_unread_emprestimo_livros_notices() to anon, authenticated;
grant execute on function public.mark_emprestimo_livros_notices_read() to anon, authenticated;
grant execute on function public.search_profiles_for_emprestimo(text) to anon, authenticated;
grant execute on function public.list_emprestimos_livros_staff(text) to anon, authenticated;
grant execute on function public.create_emprestimo_livro(uuid, text, uuid, text) to anon, authenticated;
grant execute on function public.devolver_emprestimo_livro(uuid) to anon, authenticated;
grant execute on function public.renovar_emprestimo_livro(uuid) to anon, authenticated;
grant execute on function public.list_livros_disponiveis_reserva() to anon, authenticated;
grant execute on function public.reservar_livro_acervo(uuid, text, text) to anon, authenticated;
grant execute on function public.cancelar_reserva_livro(uuid) to anon, authenticated;
grant execute on function public.confirmar_retirada_reserva(uuid) to anon, authenticated;
revoke all on function public.emprestimo_ts_from_iso_date(text) from public, anon, authenticated;

notify pgrst, 'reload schema';
