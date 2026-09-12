-- Base de conhecimento in-app (catálogo «Como faço…?» + ícone i por rota).
-- Isolamento: artigo de plataforma (tenant_id nulo) ou da igreja da sessão.
-- Visibilidade: publicado AND (plataforma OU tenant da sessão) AND interseção de papéis.
-- Identidade: current_session_profile_id() (Modo Ghost = alvo efetivo).
-- Edição: Super Admin (plataforma + igreja); Secretaria (só artigos da igreja).
-- Gestor de acesso não edita. Proteção aplicada: Gestor não tem visibilidade do Super Administrador.
-- Execute: npx supabase db query --linked -f scripts/knowledge-base.sql
-- Depois do bootstrap, aplicar na ordem os lotes 2–5 (textos operacionais
-- mais densos). O lote 5 é a fonte da profundidade da engrenagem.

begin;

create table if not exists public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  question text not null default '',
  body text not null,
  route_key text not null,
  tenant_id uuid null references public.igrejas (id) on delete cascade,
  is_published boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid null references public.profiles (id) on delete set null,
  updated_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_articles_slug_chk check (length(btrim(slug)) >= 2),
  constraint knowledge_articles_title_chk check (length(btrim(title)) >= 2),
  constraint knowledge_articles_route_chk check (length(btrim(route_key)) >= 1)
);

create unique index if not exists knowledge_articles_platform_slug_uidx
  on public.knowledge_articles (lower(slug))
  where tenant_id is null;

create unique index if not exists knowledge_articles_tenant_slug_uidx
  on public.knowledge_articles (tenant_id, lower(slug))
  where tenant_id is not null;

create index if not exists knowledge_articles_route_published_idx
  on public.knowledge_articles (route_key, is_published);

create index if not exists knowledge_articles_tenant_idx
  on public.knowledge_articles (tenant_id);

create table if not exists public.knowledge_article_roles (
  article_id uuid not null references public.knowledge_articles (id) on delete cascade,
  role_code text not null,
  primary key (article_id, role_code)
);

create index if not exists knowledge_article_roles_code_idx
  on public.knowledge_article_roles (role_code);

alter table public.knowledge_articles enable row level security;
alter table public.knowledge_article_roles enable row level security;

revoke all on table public.knowledge_articles from public, anon, authenticated;
revoke all on table public.knowledge_article_roles from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.knowledge_actor_role_codes(p_profile_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct code), array[]::text[])
  from (
    select ar.code
      from public.profile_access_roles par
      join public.access_roles ar on ar.id = par.role_id
     where par.profile_id = p_profile_id
    union
    select public.resolve_basic_role_code_for_profile(p_profile_id)
  ) s
  where code is not null and btrim(code) <> '';
$$;

create or replace function public.knowledge_article_visible_to_actor(
  p_article_id uuid,
  p_profile_id uuid,
  p_tenant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.knowledge_articles a
     where a.id = p_article_id
       and a.is_published = true
       and (a.tenant_id is null or a.tenant_id = p_tenant_id)
       and exists (
         select 1
           from public.knowledge_article_roles r
          where r.article_id = a.id
            and r.role_code = any (public.knowledge_actor_role_codes(p_profile_id))
       )
  );
$$;

create or replace function public.knowledge_article_to_json(p_article_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', a.id,
    'slug', a.slug,
    'title', a.title,
    'question', a.question,
    'body', a.body,
    'route_key', a.route_key,
    'tenant_id', a.tenant_id,
    'is_published', a.is_published,
    'sort_order', a.sort_order,
    'role_codes', coalesce((
      select jsonb_agg(r.role_code order by r.role_code)
        from public.knowledge_article_roles r
       where r.article_id = a.id
    ), '[]'::jsonb)
  )
  from public.knowledge_articles a
  where a.id = p_article_id;
$$;

create or replace function public.can_edit_knowledge_articles()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile uuid := public.current_session_profile_id();
  v_super boolean := false;
  v_secretaria boolean := false;
begin
  if v_profile is null then
    return jsonb_build_object(
      'success', false,
      'can_edit', false,
      'can_edit_platform', false,
      'can_edit_tenant', false
    );
  end if;

  v_super := public.profile_has_super_admin_role(v_profile);
  v_secretaria := public.profile_has_role_code(v_profile, 'secretaria');

  -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  return jsonb_build_object(
    'success', true,
    'can_edit', v_super or v_secretaria,
    'can_edit_platform', v_super,
    'can_edit_tenant', v_super or v_secretaria
  );
end;
$$;

create or replace function public.assert_knowledge_editor(p_platform boolean)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile uuid := public.current_session_profile_id();
begin
  if v_profile is null then
    raise exception 'Sessão inválida.';
  end if;

  if public.profile_has_super_admin_role(v_profile) then
    return v_profile;
  end if;

  if p_platform then
    raise exception 'Somente o Super Administrador edita artigos da plataforma.';
  end if;

  if public.profile_has_role_code(v_profile, 'secretaria') then
    return v_profile;
  end if;

  raise exception 'Sem permissão para editar a base de conhecimento.';
end;
$$;

-- ---------------------------------------------------------------------------
-- Leitura (membro / liderança / Ghost efetivo)
-- ---------------------------------------------------------------------------

create or replace function public.get_knowledge_article_for_route(p_route_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile uuid := public.current_session_profile_id();
  v_tenant uuid;
  v_article_id uuid;
begin
  if v_profile is null then
    return jsonb_build_object('success', false, 'article', null);
  end if;

  v_tenant := public.require_session_tenant_id();

  select a.id
    into v_article_id
    from public.knowledge_articles a
   where a.is_published = true
     and a.route_key = btrim(p_route_key)
     and (a.tenant_id is null or a.tenant_id = v_tenant)
     and exists (
       select 1
         from public.knowledge_article_roles r
        where r.article_id = a.id
          and r.role_code = any (public.knowledge_actor_role_codes(v_profile))
     )
   order by (a.tenant_id is not null) desc, a.sort_order, a.title
   limit 1;

  if v_article_id is null then
    return jsonb_build_object('success', true, 'article', null);
  end if;

  return jsonb_build_object(
    'success', true,
    'article', public.knowledge_article_to_json(v_article_id)
  );
end;
$$;

drop function if exists public.list_knowledge_articles(text);

create or replace function public.list_knowledge_articles(
  p_query text default null,
  p_catalog text default 'member'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile uuid := public.current_session_profile_id();
  v_tenant uuid;
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
  v_catalog text := lower(btrim(coalesce(p_catalog, 'member')));
  v_member_keys text[] := array[
    'home',
    'login',
    'sair',
    '/perfil',
    '/ofertas',
    '/pastoral',
    '/escalas',
    '/financial',
    '/pequeno-grupo',
    '/mural-oportunidades',
    '/mural-generosidade',
    '/suggestions-improvements',
    '/avisos',
    '/primicias',
    '/trilha-discipulado',
    '/expense-report',
    '/redes-sociais',
    '/sobre-conecta',
    '/livros-doados'
  ];
  v_rows jsonb;
begin
  if v_profile is null then
    return jsonb_build_object('success', false, 'articles', '[]'::jsonb);
  end if;

  if v_catalog not in ('member', 'maintenance') then
    v_catalog := 'member';
  end if;

  v_tenant := public.require_session_tenant_id();

  select coalesce(jsonb_agg(public.knowledge_article_to_json(x.id) order by x.sort_order, x.title), '[]'::jsonb)
    into v_rows
    from (
      select distinct on (a.slug)
             a.id, a.sort_order, a.title, a.slug
        from public.knowledge_articles a
       where a.is_published = true
         and a.slug is distinct from 'modo-ghost'
         and (a.tenant_id is null or a.tenant_id = v_tenant)
         and exists (
           select 1
             from public.knowledge_article_roles r
            where r.article_id = a.id
              and r.role_code = any (public.knowledge_actor_role_codes(v_profile))
         )
         and (
           (v_catalog = 'member' and a.route_key = any (v_member_keys))
           or (v_catalog = 'maintenance' and a.route_key <> all (v_member_keys))
         )
         and (
           v_q is null
           or a.title ilike '%' || v_q || '%'
           or a.question ilike '%' || v_q || '%'
           or a.body ilike '%' || v_q || '%'
           or a.slug ilike '%' || v_q || '%'
         )
       order by a.slug, (a.tenant_id is not null) desc, a.sort_order
    ) x;

  return jsonb_build_object('success', true, 'articles', v_rows);
end;
$$;

create or replace function public.list_knowledge_articles_admin(p_query text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile uuid;
  v_tenant uuid;
  v_super boolean;
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
  v_rows jsonb;
begin
  v_profile := public.assert_knowledge_editor(false);
  v_tenant := public.require_session_tenant_id();
  v_super := public.profile_has_super_admin_role(v_profile);

  select coalesce(jsonb_agg(public.knowledge_article_to_json(a.id) order by a.sort_order, a.title), '[]'::jsonb)
    into v_rows
    from public.knowledge_articles a
   where (
           (v_super and (a.tenant_id is null or a.tenant_id = v_tenant))
           or (not v_super and a.tenant_id = v_tenant)
         )
     and (
       v_q is null
       or a.title ilike '%' || v_q || '%'
       or a.question ilike '%' || v_q || '%'
       or a.body ilike '%' || v_q || '%'
       or a.slug ilike '%' || v_q || '%'
       or a.route_key ilike '%' || v_q || '%'
     );

  return jsonb_build_object('success', true, 'articles', v_rows);
end;
$$;

create or replace function public.upsert_knowledge_article(
  p_id uuid,
  p_slug text,
  p_title text,
  p_question text,
  p_body text,
  p_route_key text,
  p_is_platform boolean,
  p_is_published boolean,
  p_sort_order integer,
  p_role_codes text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid;
  v_tenant uuid;
  v_id uuid;
  v_platform boolean := coalesce(p_is_platform, false);
  v_roles text[];
begin
  v_profile := public.assert_knowledge_editor(v_platform);
  v_tenant := public.require_session_tenant_id();

  if p_id is not null then
    select tenant_id is null
      into v_platform
      from public.knowledge_articles
     where id = p_id;

    if not found then
      return jsonb_build_object('success', false, 'message', 'Artigo não encontrado.');
    end if;

    v_profile := public.assert_knowledge_editor(v_platform);
  end if;

  v_roles := (
    select coalesce(array_agg(distinct btrim(code)), array[]::text[])
      from unnest(coalesce(p_role_codes, array[]::text[])) as code
     where btrim(code) <> ''
  );

  if coalesce(array_length(v_roles, 1), 0) = 0 then
    return jsonb_build_object('success', false, 'message', 'Informe ao menos um papel.');
  end if;

  if v_platform then
    insert into public.knowledge_articles (
      id, slug, title, question, body, route_key, tenant_id, is_published, sort_order,
      created_by, updated_by, created_at, updated_at
    )
    values (
      coalesce(p_id, gen_random_uuid()),
      btrim(p_slug),
      btrim(p_title),
      btrim(coalesce(p_question, '')),
      btrim(p_body),
      btrim(p_route_key),
      null,
      coalesce(p_is_published, true),
      coalesce(p_sort_order, 100),
      v_profile,
      v_profile,
      now(),
      now()
    )
    on conflict (id) do update
      set slug = excluded.slug,
          title = excluded.title,
          question = excluded.question,
          body = excluded.body,
          route_key = excluded.route_key,
          tenant_id = null,
          is_published = excluded.is_published,
          sort_order = excluded.sort_order,
          updated_by = v_profile,
          updated_at = now()
    returning id into v_id;
  else
    insert into public.knowledge_articles (
      id, slug, title, question, body, route_key, tenant_id, is_published, sort_order,
      created_by, updated_by, created_at, updated_at
    )
    values (
      coalesce(p_id, gen_random_uuid()),
      btrim(p_slug),
      btrim(p_title),
      btrim(coalesce(p_question, '')),
      btrim(p_body),
      btrim(p_route_key),
      v_tenant,
      coalesce(p_is_published, true),
      coalesce(p_sort_order, 100),
      v_profile,
      v_profile,
      now(),
      now()
    )
    on conflict (id) do update
      set slug = excluded.slug,
          title = excluded.title,
          question = excluded.question,
          body = excluded.body,
          route_key = excluded.route_key,
          tenant_id = v_tenant,
          is_published = excluded.is_published,
          sort_order = excluded.sort_order,
          updated_by = v_profile,
          updated_at = now()
    returning id into v_id;
  end if;

  delete from public.knowledge_article_roles where article_id = v_id;
  insert into public.knowledge_article_roles (article_id, role_code)
  select v_id, code from unnest(v_roles) as code;

  return jsonb_build_object(
    'success', true,
    'message', 'Artigo salvo.',
    'article', public.knowledge_article_to_json(v_id)
  );
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'message', 'Já existe um artigo com este slug.');
end;
$$;

create or replace function public.unpublish_knowledge_article(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_platform boolean;
  v_tenant uuid;
  v_article_tenant uuid;
begin
  select tenant_id is null, tenant_id
    into v_platform, v_article_tenant
    from public.knowledge_articles
   where id = p_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Artigo não encontrado.');
  end if;

  perform public.assert_knowledge_editor(v_platform);
  v_tenant := public.require_session_tenant_id();

  if not v_platform and v_article_tenant is distinct from v_tenant then
    return jsonb_build_object('success', false, 'message', 'Artigo de outra igreja.');
  end if;

  update public.knowledge_articles
     set is_published = false,
         updated_at = now(),
         updated_by = public.current_session_profile_id()
   where id = p_id;

  return jsonb_build_object('success', true, 'message', 'Artigo arquivado.');
end;
$$;

revoke all on function public.knowledge_actor_role_codes(uuid) from public, anon, authenticated;
revoke all on function public.knowledge_article_visible_to_actor(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.knowledge_article_to_json(uuid) from public, anon, authenticated;
revoke all on function public.assert_knowledge_editor(boolean) from public, anon, authenticated;

grant execute on function public.can_edit_knowledge_articles() to anon, authenticated;
grant execute on function public.get_knowledge_article_for_route(text) to anon, authenticated;
grant execute on function public.list_knowledge_articles(text, text) to anon, authenticated;
grant execute on function public.list_knowledge_articles_admin(text) to anon, authenticated;
grant execute on function public.upsert_knowledge_article(uuid, text, text, text, text, text, boolean, boolean, integer, text[]) to anon, authenticated;
grant execute on function public.unpublish_knowledge_article(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed do primeiro lote (plataforma). Idempotente por slug.
-- ---------------------------------------------------------------------------

create or replace function public._seed_knowledge_article(
  p_slug text,
  p_title text,
  p_question text,
  p_body text,
  p_route_key text,
  p_roles text[],
  p_sort_order integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id
    from public.knowledge_articles
   where tenant_id is null
     and lower(slug) = lower(p_slug);

  if v_id is null then
    insert into public.knowledge_articles (
      slug, title, question, body, route_key, tenant_id, is_published, sort_order
    )
    values (
      p_slug, p_title, p_question, p_body, p_route_key, null, true, p_sort_order
    )
    returning id into v_id;
  else
    update public.knowledge_articles
       set title = p_title,
           question = p_question,
           body = p_body,
           route_key = p_route_key,
           is_published = true,
           sort_order = p_sort_order,
           updated_at = now()
     where id = v_id;
  end if;

  delete from public.knowledge_article_roles where article_id = v_id;
  insert into public.knowledge_article_roles (article_id, role_code)
  select v_id, code from unnest(p_roles) as code;
end;
$$;

do $$
declare
  v_member text[] := array[
    'member', 'congregado', 'visitante', 'visitantes',
    'pastoral', 'tesoureiro', 'secretaria', 'events_admin',
    'gestor_controle_acesso', 'super_admin'
  ];
  v_ops text[] := array[
    'pastoral', 'tesoureiro', 'secretaria', 'events_admin',
    'gestor_controle_acesso', 'super_admin'
  ];
  v_sa text[] := array['super_admin'];
  v_acl text[] := array['super_admin', 'gestor_controle_acesso'];
begin
  perform public._seed_knowledge_article(
    'proximos-eventos',
    'Próximos Eventos',
    'Como vejo os cultos, faço pré-check-in e uso Eu quero…?',
    $body$## Agenda da Família
Toque no evento para marcar quem do núcleo vai ao culto e confirmar o pré-check-in. Isso reserva vaga, alimenta o quórum esperado e agiliza o totem no hall.

## Calendário do celular
Depois de confirmar, o aplicativo pode oferecer gravar o compromisso no calendário do aparelho. Pode recusar.

## Eu quero…
No rodapé da home: Dízimos e Ofertas, Campanhas e Projetos, Prímicias e pedido de oração — sem abrir o menu.

## Avisos
Deslize para a página de Avisos. Comunicados oficiais saem da Manutenção de Avisos, na engrenagem.

## Lista vazia
Ainda não há evento publicado na janela visível, ou ele não está marcado como visível para a congregação.$body$,
    'home',
    v_member,
    10
  );

  perform public._seed_knowledge_article(
    'perfil-identidade',
    'Perfil e Identidade',
    'Como atualizo meus dados, a carteirinha e a família?',
    $body$## Carteirinha digital
Duas faces: dados e foto na frente; QR na outra. Use na recepção e em eventos da igreja.

## Família
Em Gerenciar família inclua cônjuge e filhos (nome, telefone, nascimento, parentesco e foto). O núcleo entra na Agenda da Família e no totem.

## Outros atalhos
Pelo perfil você abre a Trilha de Discipulado e, se o papel permitir, Relatório de Despesas (reembolso).

## Privacidade
Alguns campos só a Secretaria ou o Pastoral alteram. Se um botão não aparecer, o seu papel não tem essa permissão.$body$,
    '/perfil',
    v_member,
    20
  );

  perform public._seed_knowledge_article(
    'dizimos-ofertas',
    'Dízimos e Ofertas',
    'Como contribuo com dízimo, oferta ou campanha?',
    $body$## PIX Copia e Cola
Confira o recebedor da sua igreja. Digite o valor com centavos, copie a chave e cole no Pix Copia e Cola do banco. Guarde o comprovante no aplicativo do banco.

## Campanhas
Em Eu quero… > Campanhas e Projetos, escolha o fundo. O valor pode ganhar centavos identificadores (por exemplo R$ 50,31). Não altere esses centavos no banco — eles marcam a campanha na conciliação.

## Prímicias
Doação em item (cesta, higiene) fica em Eu quero… > Prímicias, não nesta tela de PIX.$body$,
    '/ofertas',
    v_member,
    30
  );

  perform public._seed_knowledge_article(
    'coracao-aberto',
    'Coração Aberto',
    'Como faço um pedido pastoral ou agendo atendimento?',
    $body$## Pedido
Escolha motivo e, se houver, submotivo. Diga se é para você, familiar ou terceiros. Sigilo pastoral fica só com quem tem permissão; Intercessão entra na fila de oração.

## Agendar atendimento
Na outra aba escolha presencial ou online, o horário publicado pelo Pastoral e confirme. Sem horário na agenda, o pedido de oração continua disponível.

## Histórico
O relógio abre Meus pedidos (Novo, em atendimento, concluído). Dá para excluir o que ainda não foi tratado.

## Não misturar
Sugestão de produto e mural de generosidade têm telas próprias.$body$,
    '/pastoral',
    v_member,
    40
  );

  perform public._seed_knowledge_article(
    'escalas',
    'Escalas',
    'Como vejo se estou escalado e peço troca?',
    $body$## Minha escala
No topo, as suas datas futuras. Abaixo, escolha o tipo (louvor, acolhimento, infantil…).

## Pedido de troca
Se a igreja liberou, toque em Solicitar troca nesta data. A outra aba lista convites que você recebeu.

## Veículo
Alguns tipos de acolhimento/estacionamento pedem identificação do carro. Isso não reabre o card antigo do Painel.$body$,
    '/escalas',
    v_member,
    50
  );

  perform public._seed_knowledge_article(
    'informacoes-financeiras',
    'Informações financeiras',
    'Como leio o resultado, o comparativo e o orçamento da igreja?',
    $body$## Mês de referência
Tudo nesta tela usa o mês escolhido no topo. Expanda cada cartão (resumo, resultado, comparativo, 12 meses, orçamento, saldo) conforme a ACL do seu papel.

## Tesouraria
Quem lança extrato, RD e orçamento usa Informações Financeiras na engrenagem. Aqui é a leitura de prestação de contas.

## Aliança
Se a igreja é mãe no programa Aliança Conecta Reino, a seção Aliança mostra o recorte das ofertas de apoio — ela não efetiva o pagamento.$body$,
    '/financial',
    v_ops,
    60
  );

  perform public._seed_knowledge_article(
    'alianca-conecta-reino',
    'Aliança Conecta Reino',
    'Como funciona a premiação por indicação de novas igrejas?',
    $body$## O que é a Aliança Conecta Reino
É o programa de indicação entre instâncias do Conecta+. Quando uma igreja (igreja mãe) indica outra igreja (igreja filha) e essa filha contrata e paga a assinatura da plataforma, nasce um direito de oferta de apoio ministerial para a mãe. Esse valor não entra no livro caixa do culto: é passivo da operação Conecta+, separado do dízimo e das ofertas da congregação.

## Como a indicação é registrada
Somente o Super Administrador vincula a igreja mãe em Instâncias, no campo «Igreja mãe (indicação Aliança)». Uma igreja não pode indicar a si mesma nem fechar um ciclo na árvore (A indica B, B indica A). Cada igreja filha tem no máximo uma parceria ativa. Remover a indicação só é permitido se não houver oferta Aliança em aberto.

## Quando nasce o direito à premiação
O direito não nasce no cadastro da igreja, e sim no pagamento real da fatura Stripe da igreja filha (evento invoice.paid). Cada fatura paga, nas condições abaixo, gera uma oferta de 40% sobre o valor efetivamente pago. Fatura com valor zero não gera oferta. A mesma fatura não gera duas ofertas (o sistema é idempotente).

## O valor da oferta (40%)
A oferta é sempre 40% do valor pago naquela fatura da assinatura Conecta+ da igreja filha. Exemplo: se a filha paga R$ 1.000,00 no trimestre, a mãe tem direito a R$ 400,00 de oferta de apoio ministerial. O vencimento dessa oferta é 30 dias após a data em que a fatura foi paga.

## Até 4 ciclos, em até 12 meses
A parceria vale por 12 meses a partir do início e por no máximo quatro ofertas quitadas. Cada baixa manual («Pago / Oferta efetivada») avança um ciclo (1/4, 2/4, 3/4). No quarto pagamento, a parceria é encerrada. Depois disso, novas faturas da filha não geram mais passivo para aquela mãe. Se a fatura chegar depois do prazo de 12 meses, a parceria também encerra sem gerar nova oferta.

## Adimplência das duas igrejas
Mãe e filha precisam estar ativas e adimplentes na assinatura. Se a filha falhar no pagamento (invoice.payment_failed) ou qualquer uma das duas estiver inadimplente, a parceria fica suspensa e aquela fatura não gera oferta. Quando ambas voltam a ficar em dia, a parceria pode reativar nas próximas faturas, desde que ainda caiba no prazo de 12 meses e nos 4 ciclos.

## A baixa é manual — o Stripe não paga a mãe
O cartão da igreja filha quita a assinatura Conecta+ automaticamente. Os 40% da Aliança não são transferidos pelo Stripe. O Super Administrador, nesta tela, confirma a oferta de apoio ministerial («Marcar como paga»). Sem essa baixa, o passivo permanece em «A pagar» e a igreja mãe não recebe. A igreja mãe acompanha o recorte no Financeiro (seção Aliança), mas não efetiva a oferta.

## O que aparece neste demonstrativo
Receitas brutas: o que as igrejas pagaram de assinatura. A pagar (passivo): 40% ainda não quitados. Ofertas efetivadas: o que já foi marcado como pago. Saldo líquido (realizado): receita bruta menos o que já foi efetivado. O saldo «se todas as ofertas em aberto forem pagas» antecipa o efeito de quitar o passivo restante.

## Encerramento
A parceria encerra no 4º ciclo quitado, ao vencer o prazo de 12 meses, ou se a indicação for removida sem ciclos pagos e sem ofertas já pagas. Enquanto houver oferta em aberto, a mãe não pode ser desvinculada: é preciso quitar ou manter o vínculo.$body$,
    '/alianca-conecta-reino',
    v_sa,
    70
  );

  perform public._seed_knowledge_article(
    'instancias-igrejas',
    'Instâncias (igrejas)',
    'Como crio ou alterno o ambiente de uma igreja?',
    $body$## Para que serve
Cada instância é uma igreja no Conecta+. O Super Administrador cria, ativa, inativa e alterna o ambiente sem trocar de celular.

## Igreja ativa
O checkbox marcado é a instância em uso. Desmarcada, os membros daquela igreja não entram; o Super Administrador continua podendo acessar.

## Aliança
O campo Igreja mãe (indicação Aliança) liga a filha à mãe. Não indique a própria igreja nem feche um ciclo na árvore.

## Totem e PIX
Telefone/senha do totem e chaves PIX são por igreja. Alterar aqui não muda as outras instâncias.$body$,
    '/igrejas',
    v_sa,
    80
  );

  perform public._seed_knowledge_article(
    'totem-checkin',
    'Totem de check-in',
    'Como o totem confirma a família no culto?',
    $body$## Quem usa
Kiosk no hall. Aponte a câmera para o QR da família. Só confirma quem já fez pré-check-in no evento de hoje.

## Evento de hoje
O totem lista evento publicado, com data de hoje e Totem ou Quórum ativo na Programação de Eventos. «Nenhum totem aberto hoje» significa data errada ou chave Totem desligada.

## Já confirmado
Se o QR já passou, a mensagem avisa. Não é preciso escanear de novo.$body$,
    '/totem-checkin',
    v_ops,
    90
  );

  perform public._seed_knowledge_article(
    'assinaturas',
    'Assinaturas',
    'Como a igreja assina ou renova o Conecta+?',
    $body$## Planos
Os planos cobram pela quantidade de usuários ativos da instância. Se o número atual estourar o limite, escolha um plano maior antes de assinar.

## Pagamento
A cobrança é no Stripe (cartão). O checkout abre fora do aplicativo. Fatura paga libera o período; fatura falha deixa a igreja inadimplente.

## Contrato
Renovar ou rescindir usa os botões desta tela. Rescisão no fim do período não gera estorno automático.$body$,
    '/billing',
    v_sa,
    100
  );

  perform public._seed_knowledge_article(
    'relatorios',
    'Relatórios',
    'Como gero os relatórios da manutenção?',
    $body$## Escopo
Cada relatório lê só a igreja da sessão. Não mistura membros nem eventos de outra instância.

## Tempo
Relatórios grandes podem levar alguns segundos. Se estourar o tempo, filtre melhor ou tente de novo; o total não deve mudar.

## Papéis
Quem abre esta tela vê as linhas permitidas ao seu papel. Não é exportação irrestrita da plataforma.$body$,
    'maintenance-dashboard?panel=relatorios',
    v_ops,
    110
  );

  perform public._seed_knowledge_article(
    'mudanca-papeis',
    'Mudança de papéis',
    'Como altero o papel de um usuário?',
    $body$## Quando usar
Troca o papel básico (membro, congregado, visitante) ou concede papéis de liderança conforme a ACL. Não use isto para simular outro usuário — isso é Modo Ghost.

## Quem não aparece
O Gestor de acesso não lista nem edita o Super Administrador. PIN e senha nunca aparecem nesta tela.

## Efeito
A mudança vale na hora para menus, cards e telas. Peça ao usuário um hard refresh se o menu antigo continuar na tela.$body$,
    'maintenance-dashboard?panel=mudanca_papeis',
    v_ops,
    120
  );

  perform public._seed_knowledge_article(
    'modo-ghost',
    'Modo Ghost',
    'Como simulo a sessão de outro usuário para auditar permissões?',
    $body$## O que é
Você vê o aplicativo com as permissões do alvo. As ações ficam no nome dele, com auditoria do operador real.

## Como ativar
Busque nome, telefone ou código de um usuário ativo desta igreja e confirme. Para sair, use Encerrar Ghost no banner.

## Cuidado
Não use Ghost para «consertar» cadastro no lugar da pessoa sem necessidade. Tudo fica no log.$body$,
    'maintenance-dashboard?panel=auditor',
    v_sa,
    130
  );

  perform public._seed_knowledge_article(
    'controle-de-acesso',
    'Controle de Acesso',
    'Como libero ou bloqueio telas por papel?',
    $body$## Telas e papéis
Azul celeste são telas do produto. Amarelo cobre são telas de manutenção. Toque no recurso para marcar visualização e edição por papel.

## App e LGPD
Os interruptores no topo ligam ou desligam o aplicativo e o fluxo LGPD da instância. Isso vale para todos os usuários da igreja.

## Limite do Gestor
O Gestor de acesso opera esta tela, mas não vê nem altera o Super Administrador, PIN ou senha.$body$,
    'maintenance-dashboard?panel=access_control',
    v_acl,
    140
  );

  perform public._seed_knowledge_article(
    'sugestoes',
    'Sugestões',
    'Como envio uma sugestão ou vejo as que já enviei?',
    $body$## Enviar
Nova: escolha o tipo de registro, descreva a melhoria ou a dúvida. A equipe da igreja recebe o chamado.

## Acompanhar
Atualizar recarrega o andamento e a resposta. Não é canal pastoral — pedidos de oração ficam em Coração Aberto.$body$,
    '/suggestions-improvements',
    v_member,
    150
  );
end;
$$;

drop function if exists public._seed_knowledge_article(text, text, text, text, text, text[], integer);

notify pgrst, 'reload schema';

commit;
