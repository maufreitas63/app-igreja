-- =============================================================================
-- Trilha de Discipulado — multi-tenant (tenant_id = igreja / church_id)
-- =============================================================================
-- Tabelas: discipleship_modules, discipleship_lessons, user_discipleship_progress
-- RLS: isolamento por igreja via session_tenant_matches(tenant_id)
-- Seed: material inicial padrão ao cadastrar nova igreja (AFTER INSERT em igrejas)
--
-- Pré-requisitos:
--   scripts/multi-tenant-01-schema.sql (igrejas, session_tenant_matches, …)
--   access-control (is_super_admin_profile / profile_has_role_code)
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) Tabelas
-- ---------------------------------------------------------------------------

create table if not exists public.discipleship_modules (
  id uuid primary key default gen_random_uuid(),
  -- tenant_id = church_id na arquitetura multi-tenant deste app (public.igrejas.id)
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  title text not null,
  description text null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discipleship_modules_title_check check (length(trim(title)) >= 1)
);

create index if not exists discipleship_modules_tenant_idx
  on public.discipleship_modules (tenant_id);

create index if not exists discipleship_modules_tenant_order_idx
  on public.discipleship_modules (tenant_id, sort_order);

comment on table public.discipleship_modules is
  'Módulos da Trilha de Discipulado por igreja (tenant_id = church_id).';
comment on column public.discipleship_modules.tenant_id is
  'FK da igreja (church_id). Isolamento multi-tenant.';
comment on column public.discipleship_modules.is_seed is
  'true = material inicial gerado automaticamente; pastores podem editar.';

create table if not exists public.discipleship_lessons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  module_id uuid not null references public.discipleship_modules (id) on delete cascade,
  title text not null,
  content text null,
  video_url text null,
  reflection_question text null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discipleship_lessons_title_check check (length(trim(title)) >= 1)
);

create index if not exists discipleship_lessons_tenant_idx
  on public.discipleship_lessons (tenant_id);

create index if not exists discipleship_lessons_module_idx
  on public.discipleship_lessons (module_id);

create index if not exists discipleship_lessons_module_order_idx
  on public.discipleship_lessons (module_id, sort_order);

comment on table public.discipleship_lessons is
  'Lições da Trilha de Discipulado (por módulo / igreja).';
comment on column public.discipleship_lessons.tenant_id is
  'FK da igreja (church_id). Redundante com module.tenant_id para RLS e queries.';
comment on column public.discipleship_lessons.video_url is
  'URL opcional de vídeo (YouTube/Vimeo/arquivo).';
comment on column public.discipleship_lessons.reflection_question is
  'Pergunta de reflexão opcional para o discípulo.';

create table if not exists public.user_discipleship_progress (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.discipleship_lessons (id) on delete cascade,
  status text not null default 'not_started',
  reflection_answer text null,
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_discipleship_progress_status_check
    check (status in ('not_started', 'in_progress', 'completed')),
  constraint user_discipleship_progress_unique
    unique (tenant_id, profile_id, lesson_id)
);

create index if not exists user_discipleship_progress_tenant_idx
  on public.user_discipleship_progress (tenant_id);

create index if not exists user_discipleship_progress_profile_idx
  on public.user_discipleship_progress (profile_id);

create index if not exists user_discipleship_progress_lesson_idx
  on public.user_discipleship_progress (lesson_id);

comment on table public.user_discipleship_progress is
  'Progresso do membro nas lições da Trilha de Discipulado (por igreja).';

-- ---------------------------------------------------------------------------
-- 2) updated_at + tenant_id automático no INSERT
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at_discipleship()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_discipleship_modules_updated_at on public.discipleship_modules;
create trigger trg_discipleship_modules_updated_at
  before update on public.discipleship_modules
  for each row
  execute function public.set_updated_at_discipleship();

drop trigger if exists trg_discipleship_lessons_updated_at on public.discipleship_lessons;
create trigger trg_discipleship_lessons_updated_at
  before update on public.discipleship_lessons
  for each row
  execute function public.set_updated_at_discipleship();

drop trigger if exists trg_user_discipleship_progress_updated_at on public.user_discipleship_progress;
create trigger trg_user_discipleship_progress_updated_at
  before update on public.user_discipleship_progress
  for each row
  execute function public.set_updated_at_discipleship();

do $$
begin
  if exists (
    select 1 from pg_proc where proname = 'tg_set_tenant_id_from_session'
  ) then
    drop trigger if exists trg_discipleship_modules_tenant on public.discipleship_modules;
    create trigger trg_discipleship_modules_tenant
      before insert on public.discipleship_modules
      for each row
      execute function public.tg_set_tenant_id_from_session();

    drop trigger if exists trg_discipleship_lessons_tenant on public.discipleship_lessons;
    create trigger trg_discipleship_lessons_tenant
      before insert on public.discipleship_lessons
      for each row
      execute function public.tg_set_tenant_id_from_session();

    drop trigger if exists trg_user_discipleship_progress_tenant on public.user_discipleship_progress;
    create trigger trg_user_discipleship_progress_tenant
      before insert on public.user_discipleship_progress
      for each row
      execute function public.tg_set_tenant_id_from_session();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Helper: líder pastoral / editor da trilha
-- ---------------------------------------------------------------------------

create or replace function public.can_manage_discipleship_trail(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_profile_id is not null
    and (
      public.is_super_admin_profile(p_profile_id)
      or public.profile_has_role_code(p_profile_id, 'pastoral')
      or public.profile_has_role_code(p_profile_id, 'lider')
      or public.profile_has_role_code(p_profile_id, 'lider_geral')
      or public.profile_has_role_code(p_profile_id, 'events_admin')
    );
$$;

comment on function public.can_manage_discipleship_trail(uuid) is
  'Pastores/líderes/super_admin podem editar módulos e lições da trilha.';

grant execute on function public.can_manage_discipleship_trail(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) RLS
-- ---------------------------------------------------------------------------

alter table public.discipleship_modules enable row level security;
alter table public.discipleship_lessons enable row level security;
alter table public.user_discipleship_progress enable row level security;

-- Módulos: leitura na própria igreja; escrita só líderes/pastores
drop policy if exists discipleship_modules_select_tenant on public.discipleship_modules;
create policy discipleship_modules_select_tenant
  on public.discipleship_modules
  for select
  using (
    public.session_tenant_matches(tenant_id)
    or public.is_super_admin_profile(public.current_session_profile_id())
  );

drop policy if exists discipleship_modules_insert_manage on public.discipleship_modules;
create policy discipleship_modules_insert_manage
  on public.discipleship_modules
  for insert
  with check (
    (
      public.session_tenant_matches(tenant_id)
      or public.is_super_admin_profile(public.current_session_profile_id())
    )
    and public.can_manage_discipleship_trail(public.current_session_profile_id())
  );

drop policy if exists discipleship_modules_update_manage on public.discipleship_modules;
create policy discipleship_modules_update_manage
  on public.discipleship_modules
  for update
  using (
    (
      public.session_tenant_matches(tenant_id)
      or public.is_super_admin_profile(public.current_session_profile_id())
    )
    and public.can_manage_discipleship_trail(public.current_session_profile_id())
  )
  with check (
    (
      public.session_tenant_matches(tenant_id)
      or public.is_super_admin_profile(public.current_session_profile_id())
    )
    and public.can_manage_discipleship_trail(public.current_session_profile_id())
  );

drop policy if exists discipleship_modules_delete_manage on public.discipleship_modules;
create policy discipleship_modules_delete_manage
  on public.discipleship_modules
  for delete
  using (
    (
      public.session_tenant_matches(tenant_id)
      or public.is_super_admin_profile(public.current_session_profile_id())
    )
    and public.can_manage_discipleship_trail(public.current_session_profile_id())
  );

-- Lições: mesma regra
drop policy if exists discipleship_lessons_select_tenant on public.discipleship_lessons;
create policy discipleship_lessons_select_tenant
  on public.discipleship_lessons
  for select
  using (
    public.session_tenant_matches(tenant_id)
    or public.is_super_admin_profile(public.current_session_profile_id())
  );

drop policy if exists discipleship_lessons_insert_manage on public.discipleship_lessons;
create policy discipleship_lessons_insert_manage
  on public.discipleship_lessons
  for insert
  with check (
    (
      public.session_tenant_matches(tenant_id)
      or public.is_super_admin_profile(public.current_session_profile_id())
    )
    and public.can_manage_discipleship_trail(public.current_session_profile_id())
  );

drop policy if exists discipleship_lessons_update_manage on public.discipleship_lessons;
create policy discipleship_lessons_update_manage
  on public.discipleship_lessons
  for update
  using (
    (
      public.session_tenant_matches(tenant_id)
      or public.is_super_admin_profile(public.current_session_profile_id())
    )
    and public.can_manage_discipleship_trail(public.current_session_profile_id())
  )
  with check (
    (
      public.session_tenant_matches(tenant_id)
      or public.is_super_admin_profile(public.current_session_profile_id())
    )
    and public.can_manage_discipleship_trail(public.current_session_profile_id())
  );

drop policy if exists discipleship_lessons_delete_manage on public.discipleship_lessons;
create policy discipleship_lessons_delete_manage
  on public.discipleship_lessons
  for delete
  using (
    (
      public.session_tenant_matches(tenant_id)
      or public.is_super_admin_profile(public.current_session_profile_id())
    )
    and public.can_manage_discipleship_trail(public.current_session_profile_id())
  );

-- Progresso: membro vê/edita o próprio; líderes veem da igreja
drop policy if exists user_discipleship_progress_select on public.user_discipleship_progress;
create policy user_discipleship_progress_select
  on public.user_discipleship_progress
  for select
  using (
    (
      public.session_tenant_matches(tenant_id)
      or public.is_super_admin_profile(public.current_session_profile_id())
    )
    and (
      profile_id = public.current_session_profile_id()
      or public.can_manage_discipleship_trail(public.current_session_profile_id())
    )
  );

drop policy if exists user_discipleship_progress_insert_own on public.user_discipleship_progress;
create policy user_discipleship_progress_insert_own
  on public.user_discipleship_progress
  for insert
  with check (
    public.session_tenant_matches(tenant_id)
    and (
      profile_id = public.current_session_profile_id()
      or public.can_manage_discipleship_trail(public.current_session_profile_id())
    )
  );

drop policy if exists user_discipleship_progress_update_own on public.user_discipleship_progress;
create policy user_discipleship_progress_update_own
  on public.user_discipleship_progress
  for update
  using (
    public.session_tenant_matches(tenant_id)
    and (
      profile_id = public.current_session_profile_id()
      or public.can_manage_discipleship_trail(public.current_session_profile_id())
    )
  )
  with check (
    public.session_tenant_matches(tenant_id)
    and (
      profile_id = public.current_session_profile_id()
      or public.can_manage_discipleship_trail(public.current_session_profile_id())
    )
  );

drop policy if exists user_discipleship_progress_delete_own on public.user_discipleship_progress;
create policy user_discipleship_progress_delete_own
  on public.user_discipleship_progress
  for delete
  using (
    public.session_tenant_matches(tenant_id)
    and (
      profile_id = public.current_session_profile_id()
      or public.can_manage_discipleship_trail(public.current_session_profile_id())
    )
  );

-- ---------------------------------------------------------------------------
-- 5) Seed automático do material inicial padrão
-- ---------------------------------------------------------------------------

create or replace function public.seed_default_discipleship_trail(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_mod1 uuid;
  v_mod2 uuid;
  v_mod3 uuid;
  v_mod4 uuid;
  v_mod5 uuid;
begin
  if p_tenant_id is null then
    raise exception 'seed_default_discipleship_trail: tenant_id obrigatório';
  end if;

  if not exists (select 1 from public.igrejas i where i.id = p_tenant_id) then
    raise exception 'seed_default_discipleship_trail: igreja % não encontrada', p_tenant_id;
  end if;

  -- Idempotente: se já houver qualquer módulo seed nesta igreja, não recria
  if exists (
    select 1
      from public.discipleship_modules m
     where m.tenant_id = p_tenant_id
       and m.is_seed = true
  ) then
    return;
  end if;

  perform set_config('app.bypass_tenant_guard', 'on', true);

  -- Módulo 1
  insert into public.discipleship_modules (
    tenant_id, title, description, sort_order, is_active, is_seed
  ) values (
    p_tenant_id,
    'Boas-Vindas e Identidade da Igreja',
    'Conheça a família, a história, a missão e o sacerdócio de todos os crentes.',
    1,
    true,
    true
  )
  returning id into v_mod1;

  insert into public.discipleship_lessons (
    tenant_id, module_id, title, content, video_url, reflection_question, sort_order, is_active, is_seed
  ) values
    (
      p_tenant_id, v_mod1,
      'Bem-vindo à Família',
      'Assista à mensagem de boas-vindas e conheça o coração da nossa família de fé. (Lição em vídeo — preencha video_url.)',
      null,
      null,
      1, true, true
    ),
    (
      p_tenant_id, v_mod1,
      'Nossa História e Missão',
      'Conheça a história da igreja e a missão que nos une: conduzir pessoas à cruz de Cristo.',
      null,
      null,
      2, true, true
    ),
    (
      p_tenant_id, v_mod1,
      'O Sacerdócio de Todos os Crentes',
      'Todo crente é chamado a servir. Reflita sobre o papel de cada um na comunidade.',
      null,
      'O que mais te chamou a atenção na nossa comunidade até agora?',
      3, true, true
    );

  -- Módulo 2
  insert into public.discipleship_modules (
    tenant_id, title, description, sort_order, is_active, is_seed
  ) values (
    p_tenant_id,
    'O Fundamento da Fé (A Graça e a Palavra)',
    'A Bíblia, a salvação pela graça e o arrependimento que gera nova vida.',
    2,
    true,
    true
  )
  returning id into v_mod2;

  insert into public.discipleship_lessons (
    tenant_id, module_id, title, content, video_url, reflection_question, sort_order, is_active, is_seed
  ) values
    (
      p_tenant_id, v_mod2,
      'A Bíblia como Regra de Fé',
      'A Escritura é a regra de fé e prática para a vida cristã.',
      null, null, 1, true, true
    ),
    (
      p_tenant_id, v_mod2,
      'A Salvação pela Graça',
      'Somos salvos pela graça, mediante a fé — não por obras, para que ninguém se glorie.',
      null, null, 2, true, true
    ),
    (
      p_tenant_id, v_mod2,
      'O Arrependimento e a Nova Vida',
      'O arrependimento abre caminho para uma nova vida em Cristo.',
      null,
      'Em suas próprias palavras, o que significa receber a graça de Deus?',
      3, true, true
    );

  -- Módulo 3
  insert into public.discipleship_modules (
    tenant_id, title, description, sort_order, is_active, is_seed
  ) values (
    p_tenant_id,
    'O Passo da Fé (O Batismo por Imersão)',
    'Significado do batismo, testemunho público e dúvidas práticas.',
    3,
    true,
    true
  )
  returning id into v_mod3;

  insert into public.discipleship_lessons (
    tenant_id, module_id, title, content, video_url, reflection_question, sort_order, is_active, is_seed
  ) values
    (
      p_tenant_id, v_mod3,
      'Por que Batizamos por Imersão?',
      'Entenda o significado bíblico do batismo por imersão. (Lição em vídeo — preencha video_url.)',
      null, null, 1, true, true
    ),
    (
      p_tenant_id, v_mod3,
      'O Testemunho Público da Fé',
      'O batismo é um testemunho público de fé e identificação com Cristo.',
      null, null, 2, true, true
    ),
    (
      p_tenant_id, v_mod3,
      'Tire Suas Dúvidas Práticas',
      'Esclareça dúvidas sobre o dia, a preparação e o que esperar no batismo.',
      null,
      'Você sente o desejo de dar este passo de fé através do batismo?',
      3, true, true
    );

  -- Módulo 4
  insert into public.discipleship_modules (
    tenant_id, title, description, sort_order, is_active, is_seed
  ) values (
    p_tenant_id,
    'Comunhão e Pertença (A Igreja Local e os Pequenos Grupos)',
    'Compromisso com a igreja local e conexão com pequenos grupos nos lares.',
    4,
    true,
    true
  )
  returning id into v_mod4;

  insert into public.discipleship_lessons (
    tenant_id, module_id, title, content, video_url, reflection_question, sort_order, is_active, is_seed
  ) values
    (
      p_tenant_id, v_mod4,
      'O Que Significa Ser Membro de uma Igreja Local',
      'Ser membro é compromisso de comunhão, cuidado mútuo e missão compartilhada.',
      null, null, 1, true, true
    ),
    (
      p_tenant_id, v_mod4,
      'A Vida em Comunidade',
      'A vida cristã floresce em comunidade — oração, partilha e serviço juntos.',
      null, null, 2, true, true
    ),
    (
      p_tenant_id, v_mod4,
      'Encontre seu Pequeno Grupo',
      'Os pequenos grupos nos lares são espaço de crescimento e cuidado próximo.',
      null,
      'Qual dia da semana funciona melhor para você participar de um grupo nos lares?',
      3, true, true
    );

  -- Módulo 5
  insert into public.discipleship_modules (
    tenant_id, title, description, sort_order, is_active, is_seed
  ) values (
    p_tenant_id,
    'Servindo com Propósito (Ministérios e Mordomia)',
    'Dons, mordomia cristã e integração aos ministérios da igreja.',
    5,
    true,
    true
  )
  returning id into v_mod5;

  insert into public.discipleship_lessons (
    tenant_id, module_id, title, content, video_url, reflection_question, sort_order, is_active, is_seed
  ) values
    (
      p_tenant_id, v_mod5,
      'Descobrindo meus Dons',
      'Nesta etapa você descobre seus dons espirituais preenchendo o Perfil Ministerial. Use o botão «Perfil Ministerial» para responder ao questionário e, em seguida, conclua a lição.',
      null, null, 1, true, true
    ),
    (
      p_tenant_id, v_mod5,
      'Mordomia Cristã',
      'Mordomia é administrar com fidelidade tempo, talentos e recursos para a glória de Deus.',
      null, null, 2, true, true
    ),
    (
      p_tenant_id, v_mod5,
      'Conhecendo os Ministérios da Igreja',
      'Conheça os ministérios e descubra onde pode servir com alegria.',
      null,
      'Em qual área ou ministério você sente maior desejo de servir?',
      3, true, true
    );
end;
$$;

comment on function public.seed_default_discipleship_trail(uuid) is
  'Insere o material inicial padrão (5 módulos × 3 lições) para uma igreja. Idempotente.';

grant execute on function public.seed_default_discipleship_trail(uuid) to service_role;

-- Trigger: toda nova igreja recebe o material inicial
create or replace function public.tg_seed_discipleship_on_igreja_insert()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  perform public.seed_default_discipleship_trail(new.id);
  return new;
exception
  when others then
    -- Não impede o cadastro da igreja se o seed falhar; loga no NOTICE
    raise warning 'seed_default_discipleship_trail falhou para %: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists trg_seed_discipleship_on_igreja_insert on public.igrejas;
create trigger trg_seed_discipleship_on_igreja_insert
  after insert on public.igrejas
  for each row
  execute function public.tg_seed_discipleship_on_igreja_insert();

-- ---------------------------------------------------------------------------
-- 6) Backfill: igrejas já existentes sem material seed
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select i.id
      from public.igrejas i
     where not exists (
       select 1
         from public.discipleship_modules m
        where m.tenant_id = i.id
          and m.is_seed = true
     )
  loop
    perform public.seed_default_discipleship_trail(r.id);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 7) ACL (recursos de tela/tabela — grants por papel ficam no Controle de Acesso)
-- ---------------------------------------------------------------------------

do $$
begin
  insert into public.access_resources (resource_type, resource_key, label, description, is_active)
  values
    (
      'screen',
      '/trilha-discipulado',
      'Trilha de Discipulado',
      'Módulos, lições e progresso do discipulado',
      true
    ),
    (
      'table',
      'discipleship_modules',
      'Módulos da Trilha de Discipulado',
      null,
      true
    ),
    (
      'table',
      'discipleship_lessons',
      'Lições da Trilha de Discipulado',
      null,
      true
    ),
    (
      'table',
      'user_discipleship_progress',
      'Progresso na Trilha de Discipulado',
      null,
      true
    )
  on conflict (resource_type, resource_key) do update
    set label = excluded.label,
        description = excluded.description,
        is_active = true;
exception
  when undefined_table then
    null;
  when others then
    -- Fallback sem unique constraint tipada
    begin
      insert into public.access_resources (resource_type, resource_key, label, description, is_active)
      select v.resource_type, v.resource_key, v.label, v.description, v.is_active
        from (
          values
            ('screen'::text, '/trilha-discipulado'::text, 'Trilha de Discipulado'::text,
             'Módulos, lições e progresso do discipulado'::text, true),
            ('table', 'discipleship_modules', 'Módulos da Trilha de Discipulado', null::text, true),
            ('table', 'discipleship_lessons', 'Lições da Trilha de Discipulado', null::text, true),
            ('table', 'user_discipleship_progress', 'Progresso na Trilha de Discipulado', null::text, true)
        ) as v(resource_type, resource_key, label, description, is_active)
       where not exists (
         select 1
           from public.access_resources ar
          where ar.resource_type = v.resource_type
            and ar.resource_key = v.resource_key
       );
    exception
      when others then
        raise warning 'ACL access_resources: %', sqlerrm;
    end;
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 8) Grants (PostgREST / cliente anon)
-- ---------------------------------------------------------------------------

grant select on public.discipleship_modules to anon, authenticated;
grant insert, update, delete on public.discipleship_modules to anon, authenticated;

grant select on public.discipleship_lessons to anon, authenticated;
grant insert, update, delete on public.discipleship_lessons to anon, authenticated;

grant select on public.user_discipleship_progress to anon, authenticated;
grant insert, update, delete on public.user_discipleship_progress to anon, authenticated;

-- seed_default_discipleship_trail: apenas trigger / service_role (já concedido acima
-- não expor a anon para evitar seed manual indevido.

commit;
