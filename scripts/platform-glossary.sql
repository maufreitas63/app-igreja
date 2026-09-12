-- Dicionário de termos da plataforma (igual em todas as igrejas).
-- Exibição: is_enabled (mestre) + is_active por termo.
-- Manutenção: apenas Super Administrador. Gestor não vê nem edita.
-- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
-- Execute: npx supabase db query --linked -f scripts/platform-glossary.sql

begin;

create table if not exists public.platform_glossary_settings (
  id smallint primary key default 1 check (id = 1),
  is_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.platform_glossary_settings (id, is_enabled)
values (1, true)
on conflict (id) do nothing;

create table if not exists public.platform_glossary_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  description text not null,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_glossary_terms_term_chk check (length(btrim(term)) >= 2),
  constraint platform_glossary_terms_desc_chk check (length(btrim(description)) >= 8)
);

create unique index if not exists platform_glossary_terms_term_uidx
  on public.platform_glossary_terms (lower(btrim(term)));

create index if not exists platform_glossary_terms_active_idx
  on public.platform_glossary_terms (is_active, sort_order);

alter table public.platform_glossary_settings enable row level security;
alter table public.platform_glossary_terms enable row level security;

revoke all on table public.platform_glossary_settings from public, anon, authenticated;
revoke all on table public.platform_glossary_terms from public, anon, authenticated;

create or replace function public.assert_platform_glossary_super_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := public.current_session_profile_id();
begin
  -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  if v_me is null or not public.is_super_admin_profile(v_me) then
    raise exception 'Apenas o Super Administrador gerencia o dicionário de termos.';
  end if;
  return v_me;
end;
$$;

create or replace function public.list_platform_glossary_public()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_enabled boolean := true;
  v_terms jsonb;
begin
  select s.is_enabled into v_enabled
    from public.platform_glossary_settings s
   where s.id = 1;

  v_enabled := coalesce(v_enabled, true);

  if not v_enabled then
    return jsonb_build_object('success', true, 'enabled', false, 'terms', '[]'::jsonb);
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'term', t.term,
        'description', t.description
      )
      order by t.sort_order, t.term
    ),
    '[]'::jsonb
  )
    into v_terms
    from public.platform_glossary_terms t
   where t.is_active = true;

  return jsonb_build_object('success', true, 'enabled', true, 'terms', coalesce(v_terms, '[]'::jsonb));
end;
$$;

create or replace function public.list_platform_glossary_admin()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_enabled boolean := true;
  v_terms jsonb;
begin
  perform public.assert_platform_glossary_super_admin();

  select s.is_enabled into v_enabled
    from public.platform_glossary_settings s
   where s.id = 1;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'term', t.term,
        'description', t.description,
        'is_active', t.is_active,
        'sort_order', t.sort_order
      )
      order by t.sort_order, t.term
    ),
    '[]'::jsonb
  )
    into v_terms
    from public.platform_glossary_terms t;

  return jsonb_build_object(
    'success', true,
    'enabled', coalesce(v_enabled, true),
    'terms', coalesce(v_terms, '[]'::jsonb)
  );
end;
$$;

create or replace function public.set_platform_glossary_enabled(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_glossary_super_admin();

  insert into public.platform_glossary_settings (id, is_enabled, updated_at)
  values (1, coalesce(p_enabled, true), now())
  on conflict (id) do update
    set is_enabled = excluded.is_enabled,
        updated_at = now();

  return jsonb_build_object('success', true, 'enabled', coalesce(p_enabled, true));
end;
$$;

create or replace function public.set_platform_glossary_term_active(
  p_id uuid,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_term text;
begin
  perform public.assert_platform_glossary_super_admin();

  update public.platform_glossary_terms
     set is_active = coalesce(p_is_active, true),
         updated_at = now()
   where id = p_id
   returning term into v_term;

  if v_term is null then
    return jsonb_build_object('success', false, 'message', 'Termo não encontrado.');
  end if;

  return jsonb_build_object('success', true, 'term', v_term, 'is_active', coalesce(p_is_active, true));
end;
$$;

revoke all on function public.assert_platform_glossary_super_admin() from public, anon, authenticated;
revoke all on function public.list_platform_glossary_public() from public, anon, authenticated;
revoke all on function public.list_platform_glossary_admin() from public, anon, authenticated;
revoke all on function public.set_platform_glossary_enabled(boolean) from public, anon, authenticated;
revoke all on function public.set_platform_glossary_term_active(uuid, boolean) from public, anon, authenticated;

grant execute on function public.list_platform_glossary_public() to anon, authenticated;
grant execute on function public.list_platform_glossary_admin() to anon, authenticated;
grant execute on function public.set_platform_glossary_enabled(boolean) to anon, authenticated;
grant execute on function public.set_platform_glossary_term_active(uuid, boolean) to anon, authenticated;

-- Seed: todos ativos. Reexecução atualiza só a descrição/ordem (preserva o checkbox).
insert into public.platform_glossary_terms (term, description, is_active, sort_order)
select x.term, x.description, true, x.sort_order
from jsonb_to_recordset($terms$[
  {"term":"PWA","description":"Progressive Web App: o Conecta+ roda no navegador como um aplicativo, com ícone na tela inicial, sem loja obrigatória.","sort_order":10},
  {"term":"ACL","description":"Access Control List: lista de permissões que diz, por papel, quais telas e ações cada pessoa pode ver ou alterar.","sort_order":20},
  {"term":"RPC","description":"Remote Procedure Call: função no banco (Supabase) que o aplicativo chama para ler ou gravar dados com as regras de segurança.","sort_order":30},
  {"term":"RLS","description":"Row Level Security: trava do Postgres que impede uma igreja de ler linha de outra igreja, mesmo que a consulta esteja errada no cliente.","sort_order":40},
  {"term":"SQL","description":"Linguagem das consultas e funções no banco de dados. Mudanças estruturais do Conecta+ entram como scripts SQL versionados.","sort_order":50},
  {"term":"API","description":"Interface de programação: contrato pelo qual o aplicativo pede e envia dados (Supabase, Stripe, mapas).","sort_order":60},
  {"term":"JSON","description":"Formato de texto estruturado usado nas respostas das RPCs e em configurações (listas, objetos, verdadeiro/falso).","sort_order":70},
  {"term":"UUID","description":"Identificador único (id) de pessoas, vagas, artigos e igrejas. Não é um número sequencial visível ao usuário.","sort_order":80},
  {"term":"PIN","description":"Senha curta, em geral de 4 dígitos, usada no login do membro e em alguns fluxos de totem.","sort_order":90},
  {"term":"QR Code","description":"Código de barras quadrado lido pela câmera (totem, carteirinha, ISBN). Substitui digitação no check-in.","sort_order":100},
  {"term":"LGPD","description":"Lei Geral de Proteção de Dados. O cadastro e o uso de dados pessoais no Conecta+ seguem o termo aceito na igreja.","sort_order":110},
  {"term":"PIX","description":"Pagamento instantâneo brasileiro. No app, dízimos, ofertas e campanhas geram cópia do código Pix identificado.","sort_order":120},
  {"term":"WhatsApp","description":"Canal de mensagem usado para avisar líder, pastoral, troca de escala e candidatura a vaga. Abre o aplicativo do telefone.","sort_order":130},
  {"term":"Modo Ghost","description":"Modo auditor: o Super Administrador opera o app como outra pessoa (identidade efetiva), sem misturar a visão do operador.","sort_order":140},
  {"term":"Identidade efetiva","description":"Perfil usado para listas, telas e permissões. Com Ghost ativo é o alvo; sem Ghost é quem entrou no aparelho.","sort_order":150},
  {"term":"Super Administrador","description":"Papel máximo da plataforma. Vê Governança e TI (igrejas, dicionário, Aliança, base de conhecimento de plataforma). O Gestor de acesso não o vê.","sort_order":160},
  {"term":"Gestor de acesso","description":"Papel que administra permissões da igreja, sem visibilidade do Super Administrador, PIN ou logs desse perfil.","sort_order":170},
  {"term":"Instância","description":"Ambiente de uma igreja no Conecta+ (código tipo IBS). Dados, logo e parâmetros não se misturam entre instâncias.","sort_order":180},
  {"term":"Tenant","description":"Mesmo conceito de instância no banco: cada igreja tem um tenant_id. Isola cadastros, financeiro e vagas.","sort_order":190},
  {"term":"Engrenagem","description":"Menu de manutenção (ícone de configurações no Menu). Reúne operação, pessoas, culto, finanças e governança conforme o papel.","sort_order":200},
  {"term":"Como faço","description":"Catálogo de ajuda in-app. Há um para o dia a dia do membro e outro para as telas da engrenagem.","sort_order":210},
  {"term":"Base de conhecimento","description":"Artigos de ajuda ligados a cada tela (ícone i). Editáveis na engrenagem; visíveis só ao papel certo.","sort_order":220},
  {"term":"Fail-closed","description":"Se a permissão não puder ser confirmada, o acesso é negado. O app não abre a tela “por garantia”.","sort_order":230},
  {"term":"Sessão","description":"Estado de quem está autenticado neste aparelho: telefone, perfil, igreja ativa e, se houver, alvo do Modo Ghost.","sort_order":240},
  {"term":"Cache","description":"Cópia temporária em memória para não repetir a mesma consulta. Expira em minutos; hard refresh força dado novo.","sort_order":250},
  {"term":"Hard refresh","description":"Recarregar a PWA ignorando cache do navegador (Ctrl+F5 ou equivalente) depois de um deploy.","sort_order":260},
  {"term":"Deploy","description":"Publicação da versão nova no Cloudflare Pages a partir do git push na branch main.","sort_order":270},
  {"term":"Cloudflare","description":"Infraestrutura que serve a PWA (Pages). O build de produção gera a pasta dist.","sort_order":280},
  {"term":"Supabase","description":"Banco Postgres, autenticação de API e storage de arquivos usados pelo Conecta+.","sort_order":290},
  {"term":"SECURITY DEFINER","description":"Função SQL que roda com privilégio do dono, aplicando as regras de sessão por dentro (padrão das RPCs do app).","sort_order":300},
  {"term":"Header de sessão","description":"Informações enviadas em cada chamada (perfil, igreja, Ghost) para o banco saber quem está operando.","sort_order":310},
  {"term":"Stripe","description":"Meio de cobrança das assinaturas da igreja (planos e webhook de pagamento).","sort_order":320},
  {"term":"Webhook","description":"Aviso automático de um serviço externo (ex.: Stripe) para o Conecta+ registrar pagamento ou evento.","sort_order":330},
  {"term":"Bucket","description":"Pasta no storage do Supabase para arquivos (logo, anexos, PDF, selfie).","sort_order":340},
  {"term":"Storage","description":"Armazenamento de arquivos (imagens, PDFs) separado das tabelas de cadastro.","sort_order":350},
  {"term":"Expo","description":"Ferramenta que empacota o Conecta+ para web (PWA) e, se preciso, para lojas.","sort_order":360},
  {"term":"React Native","description":"Tecnologia da interface: o mesmo código desenha a PWA no navegador e o app nativo.","sort_order":370},
  {"term":"Grant","description":"Concessão pontual de um recurso (tela, card, coluna) a um papel na matriz de Controle de Acesso.","sort_order":380},
  {"term":"Recurso","description":"Chave de permissão (screen, table, column) consultada pela ACL, por exemplo maintenance.card.events.","sort_order":390},
  {"term":"Papel","description":"Função da pessoa na igreja (membro, tesoureiro, pastoral, gestor, Super Administrador). Define o menu e a ACL.","sort_order":400},
  {"term":"Controle de Acesso","description":"Tela da engrenagem que monta a matriz de papéis, usuários e o que cada um pode ver ou editar.","sort_order":410},
  {"term":"Mudança de Papéis","description":"Painel para trocar o papel de um cadastro nesta instância, com rastro e sem expor o Super Administrador ao Gestor.","sort_order":420},
  {"term":"Trilha de Discipulado","description":"Percurso de lições e reconhecimentos. Não é pré-requisito para se candidatar no Mural de Oportunidades.","sort_order":430},
  {"term":"Perfil Ministerial","description":"Questionário de dons (Lição 5.1). Quando preenchido, destaca vagas combinadas; a candidatura funciona sem ele.","sort_order":440},
  {"term":"Lição 5.1","description":"Passo Descobrindo meus Dons da Trilha, que gera o Perfil Ministerial usado no match de voluntariado.","sort_order":450},
  {"term":"Mural de Oportunidades","description":"Vagas de serviço da igreja. Qualquer membro autorizado se candidata; o avaliador caminha com a pessoa na Trilha.","sort_order":460},
  {"term":"Mural de Generosidade","description":"Doações, pedidos e empréstimos entre irmãos, com moderação na engrenagem.","sort_order":470},
  {"term":"Coração Aberto","description":"Pedidos de oração e cuidado pastoral feitos pelo membro à equipe.","sort_order":480},
  {"term":"Agenda da Família","description":"Confirmação da família no culto (pré-check-in) a partir do evento na home.","sort_order":490},
  {"term":"Totem","description":"Kiosk de check-in no hall, com QR da família e credencial por instância.","sort_order":500},
  {"term":"Check-in","description":"Confirmação de presença no culto ou evento (Agenda da Família, totem ou lista de quórum).","sort_order":510},
  {"term":"Quórum","description":"Lista de presença exigida em alguns eventos; alimenta relatórios e o totem.","sort_order":520},
  {"term":"Pequeno Grupo","description":"Célula do membro: horário, líder, roteiro da semana e pedido para participar.","sort_order":530},
  {"term":"Célula","description":"Nome de uso comum do Pequeno Grupo — reunião semanal de discipulado e comunhão.","sort_order":540},
  {"term":"Escala","description":"Programação de quem serve (louvor, recepção, kids etc.), com tipos, voluntários e trocas.","sort_order":550},
  {"term":"Relatório de Despesas","description":"RD: formulário e conciliação de gastos da igreja, ligado ao módulo financeiro.","sort_order":560},
  {"term":"Prímicias","description":"Campanha de itens em espécie (cesta). O membro se compromete com um item na tela dedicada.","sort_order":570},
  {"term":"Dízimos e Ofertas","description":"Contribuição financeira com valor, centavos e Pix copiável, no fluxo Eu quero… Contribuir.","sort_order":580},
  {"term":"Campanhas","description":"Projetos com meta e Pix identificado, separados do dízimo avulso.","sort_order":590},
  {"term":"Aliança Conecta Reino","description":"Rede de indicação de novas igrejas, passivo de 40% e baixa das ofertas — só Super Administrador.","sort_order":600},
  {"term":"Assinaturas","description":"Planos e cobrança da instância (Stripe). Sem assinatura válida o acesso da igreja pode ser bloqueado.","sort_order":610},
  {"term":"App ativo","description":"Chave da instância: se desligada, o uso comum para. Super Administrador ainda entra para reativar.","sort_order":620},
  {"term":"Geolocalização","description":"Mapa de cadastros por CEP/coordenada, com pin e opções de privacidade do Super Administrador.","sort_order":630},
  {"term":"CEP","description":"Código postal usado no endereço da família e para posicionar o pin no mapa.","sort_order":640},
  {"term":"Selfie biométrica","description":"Foto de confirmação de identidade em fluxos cadastrais, quando a igreja exige.","sort_order":650},
  {"term":"Match","description":"Cruzamento entre dons do Perfil Ministerial e os dons pedidos na vaga. Só destaca; não bloqueia candidatura.","sort_order":660},
  {"term":"Busca ativa","description":"Lista, no Mural de Voluntários, de pessoas compatíveis ou que já se candidataram à vaga.","sort_order":670},
  {"term":"Eu quero","description":"Atalhos da home para contribuir (Pix) e fazer pedido de oração, sem passar pelo menu completo.","sort_order":680},
  {"term":"Home","description":"Início do membro: eventos, avisos, Agenda da Família e Eu quero… Depois do login, é o índice da PWA.","sort_order":690},
  {"term":"Congregado","description":"Papel de quem frequenta mas ainda não é membro. Vê um recorte menor de telas, definido na ACL.","sort_order":700},
  {"term":"Visitante","description":"Papel inicial de quem chegou à igreja. Cadastro e acolhimento; menus bem restritos.","sort_order":710},
  {"term":"Tesoureiro","description":"Papel financeiro: lançamentos, relatórios, Pix e, conforme a ACL, Relatório de Despesas.","sort_order":720},
  {"term":"Secretaria","description":"Papel de cadastros e apoio operacional; pode editar artigos de conhecimento da igreja.","sort_order":730},
  {"term":"Pastoral","description":"Papel de cuidado: Coração Aberto, histórico de pedidos e, se houver grant, Cuidado Pastoral na engrenagem.","sort_order":740},
  {"term":"Membro","description":"Papel padrão de quem tem vínculo ativo na instância. Acessa o menu do dia a dia filtrado pela ACL.","sort_order":750},
  {"term":"Conecta+","description":"Nome da plataforma (PWA) usada pelas igrejas da rede. Cada instância vê a própria identidade (logo, dados, ACL).","sort_order":760},
  {"term":"Como usar","description":"Ajuda rápida da tela em que você está (diálogo com o passo a passo). O botão Fechar fica no próprio cartão.","sort_order":770},
  {"term":"Matriz de acessos","description":"Grade de papéis × recursos no Controle de Acesso. Cada célula é um grant (ver ou editar) da ACL.","sort_order":780},
  {"term":"Service Worker","description":"Script do navegador que apoia a PWA (cache e atualização). Depois de um deploy, use hard refresh se a tela parecer antiga.","sort_order":790},
  {"term":"Manifest","description":"Arquivo da PWA com nome, ícone e cores para «Adicionar à tela inicial».","sort_order":800},
  {"term":"Kiosk","description":"Modo totem: aparelho fixo no hall, sem sessão de membro, só check-in por QR Code.","sort_order":810},
  {"term":"WebView","description":"Navegador embutido (APK) que abre a mesma PWA servida no Cloudflare.","sort_order":820},
  {"term":"ISBN","description":"Código do livro doado. A câmera lê o código de barras para não precisar digitar.","sort_order":830},
  {"term":"JWT","description":"Token assinado usado na API. No Conecta+ a sessão do membro vai também nos headers para as RPCs.","sort_order":840},
  {"term":"CDN","description":"Rede de distribuição que entrega a PWA e os estáticos mais perto de quem acessa (Cloudflare).","sort_order":850},
  {"term":"PostgREST","description":"Camada HTTP do Supabase que expõe tabelas e RPCs. O app não consulta a tabela do dicionário direto: só as funções.","sort_order":860}
]$terms$) as x(term text, description text, sort_order integer)
on conflict ((lower(btrim(term)))) do update
  set description = excluded.description,
      sort_order = excluded.sort_order,
      updated_at = now();

-- Artigo da engrenagem (catálogo de manutenção). Não entra no Como faço do membro.
do $$
declare
  v_id uuid;
begin
  if to_regclass('public.knowledge_articles') is null then
    return;
  end if;

  select id into v_id
    from public.knowledge_articles
   where tenant_id is null
     and lower(slug) = 'dicionario-termos';

  if v_id is null then
    insert into public.knowledge_articles (
      slug, title, question, body, route_key, tenant_id, is_published, sort_order
    )
    values (
      'dicionario-termos',
      'Dicionário de termos',
      'Como ligo ou desligo a identificação dos termos?',
      $body$## Quem vê
Só o Super Administrador, em Governança e TI. O Gestor de acesso não vê esta tela.

## Exibir termos
O interruptor do topo liga ou desliga o grifo em todo o aplicativo. Desligado, nenhum termo é marcado.

## Por termo
A primeira coluna ativa ou desativa aquele verbete. Desmarcar tira a identificação em todas as telas; marcar de novo a devolve.

## Plataforma
A lista é a mesma em todas as igrejas. Não há dicionário por instância.$body$,
      '/glossario',
      null,
      true,
      265
    )
    returning id into v_id;
  else
    update public.knowledge_articles
       set title = 'Dicionário de termos',
           question = 'Como ligo ou desligo a identificação dos termos?',
           body = $body$## Quem vê
Só o Super Administrador, em Governança e TI. O Gestor de acesso não vê esta tela.

## Exibir termos
O interruptor do topo liga ou desliga o grifo em todo o aplicativo. Desligado, nenhum termo é marcado.

## Por termo
A primeira coluna ativa ou desativa aquele verbete. Desmarcar tira a identificação em todas as telas; marcar de novo a devolve.

## Plataforma
A lista é a mesma em todas as igrejas. Não há dicionário por instância.$body$,
           route_key = '/glossario',
           is_published = true,
           sort_order = 265,
           updated_at = now()
     where id = v_id;
  end if;

  if to_regclass('public.knowledge_article_roles') is not null then
    delete from public.knowledge_article_roles where article_id = v_id;
    insert into public.knowledge_article_roles (article_id, role_code)
    values (v_id, 'super_admin');
  end if;
end;
$$;

commit;

notify pgrst, 'reload schema';
