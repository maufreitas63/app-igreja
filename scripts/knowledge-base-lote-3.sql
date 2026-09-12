-- Amplia a base de conhecimento com o que o manual «O Conecta Revisado»
-- descreve e ainda não estava no catálogo (membro + engrenagem).
-- Não republica telas congeladas (QR/Kids/estacionamento do Painel antigo).
-- Execute: npx supabase db query --linked -f scripts/knowledge-base-lote-3.sql

begin;

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

grant execute on function public.list_knowledge_articles(text, text) to anon, authenticated;

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
begin
  perform public._seed_knowledge_article(
    'entrar-no-conecta',
    'Entrar no Conecta+',
    'Como entro no aplicativo da minha igreja?',
    $body$## Código e celular
Na tela inicial informe o código da instância da sua igreja e o celular com DDD. Continuar avança para o PIN.

## Primeiro acesso
Se o celular ainda não validou o e-mail, o aplicativo pede o endereço duas vezes, envia um código e só então libera o cadastro do PIN de 4 dígitos (em Dados cadastrais, depois do primeiro login).

## PIN
Quem já tem cadastro digita a senha de 4 dígitos; no quarto número a sessão abre sozinha. Esqueci minha senha reenvia o fluxo por e-mail — o PIN não é visível para a liderança.

## Se o código não chega
Confira spam e se o e-mail é o mesmo do cadastro na secretaria.$body$,
    'login',
    v_member,
    5
  );

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
    'avisos',
    'Avisos',
    'Como leio os comunicados oficiais da igreja?',
    $body$## O que aparece
Recados pastorais, convocações e lembretes publicados pela liderança. Não é pedido de oração nem mural de oportunidades.

## Como chegar
Na home, deslize da lista de eventos para Avisos. Voltar retorna aos Próximos Eventos.

## Sem avisos
Ainda não há comunicado no período, ou o aviso expirou. Quem publica é a Manutenção de Avisos, na engrenagem.$body$,
    '/avisos',
    v_member,
    12
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
    'trilha-discipulado',
    'Trilha de Discipulado',
    'Como faço as lições da Trilha?',
    $body$## Onde abrir
Perfil > Trilha de Discipulado. As lições abrem na ordem: só o passo disponível fica clicável.

## Como avançar
Assista, leia e responda o que a lição pede. A barra de progresso sobe a cada passo. Ao concluir, a liderança vê o aluno em Trilha — Reconhecimentos.

## Conteúdo da igreja
Textos e vídeos vêm de Temas da Trilha, na engrenagem. Resetar a jornada de alguém é outra tela, só Super Administrador.$body$,
    '/trilha-discipulado',
    v_member,
    22
  );

  perform public._seed_knowledge_article(
    'relatorio-despesas',
    'Relatório de Despesas',
    'Como peço reembolso de uma despesa da igreja?',
    $body$## Quando usar
Gasto feito em nome de um ministério (material, evento, suprimento). Não é dízimo nem oferta.

## Como enviar
Perfil > Reembolsos (ou esta tela). Novo RD: justificativa, valor e foto da nota. A tesouraria vê o pedido em Informações Financeiras.

## Status
Acompanhe Pendente, em análise, aprovado ou pago nesta lista. WhatsApp do tesoureiro pode abrir na submissão, se a igreja cadastrou o contato.$body$,
    '/expense-report',
    v_member,
    24
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
    'primicias-membro',
    'Prímicias',
    'Como me comprometo com um item da cesta?',
    $body$## O que é
Doação em espécie, não PIX. Abra Eu quero… > Prímicias, escolha a categoria e toque no item que você leva.

## Compromisso
O item sai da lista de pendências. Leve o produto no dia da campanha. Promessa não entregue pode voltar à lista depois do prazo da igreja.

## Lembrete
O aplicativo pode oferecer gravar a data no calendário do celular.

## Quem cadastra os itens
A liderança monta categorias e produtos em Prímicias, na engrenagem.$body$,
    '/primicias',
    v_member,
    32
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

  perform public._seed_knowledge_article(
    'redes-sociais',
    'Redes Sociais',
    'Como abro o site, o Instagram ou o YouTube da igreja?',
    $body$## O que aparece
Os links oficiais cadastrados para esta instância (site, Instagram, YouTube). O toque abre o canal no navegador ou no aplicativo correspondente.

## Sem links
A igreja ainda não preencheu as URLs no cadastro da instância. Aguarde a equipe de comunicação.

## Não é aviso
Comunicados internos ficam em Avisos. Esta tela é só mídia externa.$body$,
    '/redes-sociais',
    v_member,
    152
  );

  perform public._seed_knowledge_article(
    'sobre-conecta',
    'Sobre o Conecta+',
    'Onde vejo a versão do app e a declaração de privacidade?',
    $body$## O que é
Apresentação da plataforma, versão/revisão em uso e o botão da Declaração de Privacidade (LGPD).

## LGPD
O texto jurídico do termo de privacidade abre nesta tela. Autorização de imagem e voz é outro fluxo, na engrenagem.

## Versão
Confira se a revisão bate com o que a igreja publicou. Depois de um deploy, use hard refresh.$body$,
    '/sobre-conecta',
    v_member,
    154
  );

  perform public._seed_knowledge_article(
    'pequeno-grupo',
    'Minha Célula',
    'Como vejo minha célula ou peço para participar?',
    $body$## Se você já tem grupo
Horário, endereço, líder e anfitrião. Avise falta pelo WhatsApp. O roteiro da semana, quando publicado, aparece aqui.

## Sem grupo
A lista sugere células próximas do seu endereço. Quero participar dispara o pedido; o líder confirma em Gestão de Pequenos Grupos.

## Sair
Há confirmação para desvincular. Depois disso a tela volta a sugerir grupos da região.$body$,
    '/pequeno-grupo',
    v_member,
    160
  );

  perform public._seed_knowledge_article(
    'mural-oportunidades',
    'Mural de Oportunidades',
    'Como me candidato a uma vaga de serviço?',
    $body$## O que aparece
Vagas alinhadas ao Perfil Ministerial (Trilha). A lição 5.1 em si não é uma vaga.

## Candidatar-se
Toque na vaga para registrar interesse. O aplicativo avisa o líder e, se houver telefone, pode abrir o WhatsApp.

## Sem vagas
Falta perfil ministerial ou a igreja ainda não publicou oportunidades em Mural de Voluntários (engrenagem).$body$,
    '/mural-oportunidades',
    v_member,
    170
  );

  perform public._seed_knowledge_article(
    'mural-generosidade',
    'Mural de Generosidade',
    'Como peço, doo ou empresto no mural?',
    $body$## Publicar
Nova publicação: doação ou pedido, com foto se possível. A liderança pode moderar antes de aparecer para todos.

## Atender
Em cada pedido dá para marcar Doar ou Emprestar. Quem publicou (ou a moderação) conclui o anúncio.

## Moderação
Anúncios impróprios ou já atendidos são tratados em Moderação do Mural, na engrenagem.$body$,
    '/mural-generosidade',
    v_member,
    180
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
end;
$$;

drop function if exists public._seed_knowledge_article(text, text, text, text, text, text[], integer);

notify pgrst, 'reload schema';

commit;
