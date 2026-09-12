-- Varredura completa do manual «O Conecta Revisado.md»:
-- inclui o que ainda faltava (Cantinho, sair, tesouraria, campanhas,
-- eventos +7, escala em bloco, recepção, ACL, relatórios).
-- Não republica telas congeladas (QR/Kids/estacionamento do Painel).
-- Execute: npx supabase db query --linked -f scripts/knowledge-base-lote-4.sql

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
  v_acl text[] := array['super_admin', 'gestor_controle_acesso'];
begin
  perform public._seed_knowledge_article(
    'perfil-identidade',
    'Perfil e Identidade',
    'Como atualizo meus dados, a carteirinha e a família?',
    $body$## Carteirinha digital
Duas faces: dados e foto na frente; QR na outra. Use na recepção e em eventos da igreja.

## Família
Em Gerenciar família inclua cônjuge e filhos (nome, telefone, nascimento, parentesco e foto). O núcleo entra na Agenda da Família e no totem.

## Outros atalhos
Pelo perfil você abre a Trilha de Discipulado, Relatório de Despesas (reembolso) e o Cantinho da Leitura (reserva de livros), se o papel permitir.

## Privacidade
Alguns campos só a Secretaria ou o Pastoral alteram. Se um botão não aparecer, o seu papel não tem essa permissão.$body$,
    '/perfil',
    v_member,
    20
  );

  perform public._seed_knowledge_article(
    'relatorio-despesas',
    'Relatório de Despesas',
    'Como peço reembolso de uma despesa da igreja?',
    $body$## Quando usar
Gasto feito em nome de um ministério. Não é dízimo nem oferta.

## Novo RD
Escolha a competência (mês). Em cada linha: data, descrição, valor e comprovante (galeria ou colar). Adicionar linha agrupa vários recibos no mesmo RD. Submeter envia à tesouraria.

## Status
Acompanhe Pendente, em análise, aprovado ou pago. WhatsApp do tesoureiro pode abrir na submissão, se a igreja cadastrou o contato.$body$,
    '/expense-report',
    v_member,
    24
  );

  perform public._seed_knowledge_article(
    'livros-doados',
    'Cantinho da Leitura',
    'Como reservo um livro ou opero o acervo da igreja?',
    $body$## Membro
Perfil > Cantinho da Leitura. Busque por título ou autor, confira ISBN e prazos (padrão 30 dias) e toque em Reservar livro. Meus títulos mostra Reservado / retirar hoje; cancele se não for buscar.

## Acervo (engrenagem)
Busque pelo ISBN ou cadastre na mão. Empréstimos registram quem levou, renovação e devolução. Reserva do membro aparece para separar o exemplar.

## Mural
Pedido informal de livro entre irmãos pode passar pelo Mural de Generosidade; o acervo formal é esta tela.$body$,
    '/livros-doados',
    v_member,
    26
  );

  perform public._seed_knowledge_article(
    'primicias-membro',
    'Prímicias',
    'Como me comprometo com um item da cesta?',
    $body$## O que é
Doação em espécie, não PIX. Abra Eu quero… > Prímicias, escolha a categoria (alimentos, higiene ou crianças) e toque no item.

## Compromisso
O item sai da lista de pendências. Leve o produto no dia da campanha. Promessa não entregue pode voltar à lista depois do prazo da igreja (em geral dez dias após o evento).

## Lembrete
O aplicativo pode oferecer gravar a data no calendário do celular. Quem cadastra itens e a data da campanha é Prímicias, na engrenagem.$body$,
    '/primicias',
    v_member,
    32
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
    'sair-do-aplicativo',
    'Sair do aplicativo',
    'Como encerro a sessão com segurança?',
    $body$## Onde
No rodapé do menu lateral: Sair do aplicativo.

## Confirmação
Cancelar mantém a sessão. Sair encerra e volta à tela de login (código da instância e celular).

## Por que
Em celular compartilhado, encerre a sessão para o próximo não usar a sua conta.$body$,
    'sair',
    v_member,
    156
  );

  perform public._seed_knowledge_article(
    'configuracao-salas',
    'Configuração de salas',
    'Como nomeio as salas e atribuo membros?',
    $body$## Abas
Salas: turmas permanentes (padrão do sistema e salas especiais). Membros: vincular pessoa à sala. Distribuição: ocupação/quórum por espaço.

## Nova sala
Salas especiais e + Nova Sala criam turma além das nativas. Excluir remove só a personalizada.

## O que esta tela não é
Não é o check-in infantil antigo do Painel. Aqui só se configura o cadastro das salas.$body$,
    '/configuracao-salas',
    v_ops,
    190
  );

  perform public._seed_knowledge_article(
    'recepcao-familiar',
    'Recepção Familiar',
    'Como recebo uma família visitante no culto?',
    $body$## Link rápido
Mostre o QR / URL da instância para o visitante abrir o app no próprio celular.

## Convite WhatsApp
Nome e celular com DDD. O WhatsApp abre mesmo se o número não estiver nos seus contatos.

## Fila pendente
Famílias que preencheram a ficha (totem ou autoatendimento) entram na fila. Confira integrantes e Gravar ou Rejeitar. Isso dispara a Régua de Acolhimento (D+1, D+4, D+8).$body$,
    'maintenance-dashboard?panel=family_reception',
    v_ops,
    280
  );

  perform public._seed_knowledge_article(
    'programacao-eventos',
    'Programação de Eventos',
    'Como crio e publico um culto ou evento?',
    $body$## Publicar
Preencha nome, data, local, capacidade e salas. A chave Publicação deixa o evento visível na home. Rascunho só a liderança vê.

## Totem, quórum e somente membros
Ative Totem para o kiosk no hall, Requer Quórum para lista de presença, Somente membros quando o culto não for aberto a visitantes.

## +7
Duplica o evento para daqui a 7 dias (mesmo horário, local, capacidade e salas). A cópia nasce como rascunho — publique depois.

## Apagar
Remove a programação. Ajuste com cuidado eventos que já têm inscrição.$body$,
    'maintenance-dashboard?panel=events',
    v_ops,
    330
  );

  perform public._seed_knowledge_article(
    'cronograma-eventos',
    'Cronograma de Eventos',
    'Como leio a linha do tempo dos eventos?',
    $body$## Visões
Por dia (grade da semana) ou por mês. Ponto preenchido = publicado (visível no app). Círculo vazado = rascunho.

## Para que serve
Ver choque de horários e a cobertura do período. A criação e o +7 continuam em Programação de Eventos.$body$,
    'maintenance-dashboard?panel=events_gantt',
    v_ops,
    340
  );

  perform public._seed_knowledge_article(
    'programacao-escalas',
    'Programação de Escalas',
    'Como monto quem serve em cada data?',
    $body$## Montar
Escolha o tipo e atribua servos às datas, ou use Escala em bloco: o sistema sugere a equipe e você grava a prévia (ou cancela).

## Intervir
Troca só aquele dia, com servos do mesmo tipo que estejam livres. O ciclo futuro do original não muda. Motivo é opcional.

## Trocas do membro
Se a igreja liberou, o servo pede troca; a liderança confirma aqui ou na caixa de pedidos.$body$,
    'maintenance-dashboard?panel=scales',
    v_ops,
    380
  );

  perform public._seed_knowledge_article(
    'gestao-campanhas',
    'Gestão de Campanhas',
    'Como abro uma campanha de ofertas?',
    $body$## Cadastro
Título, descrição, meta, já arrecadado (valor fora do app), datas e conta Pix. Status: rascunho, ativo ou concluído. Capa é opcional.

## Centavos simbólicos
Defina o sufixo (ex.: ,31). O PIX do membro recebe esses centavos e a conciliação separa o fundo da receita ordinária. Não peça ao membro para alterar os centavos.

## Encerrar
Concluído some da contribuição do membro; o histórico financeiro permanece.$body$,
    'maintenance-dashboard?panel=campaigns_management',
    v_ops,
    400
  );

  perform public._seed_knowledge_article(
    'primicias',
    'Prímicias (manutenção)',
    'Como registro itens em espécie da campanha?',
    $body$## Data
Grave a data do evento de arrecadação. Ela entra na agenda do membro. Itens não entregues voltam à lista após o prazo da igreja.

## Itens
Novo item: quantidade, unidade, nome e peso. Categorias: alimentos, higiene, crianças. Linha tachada = alguém assumiu; Pendente ainda precisa de doador.

## Relação com ofertas
Dinheiro continua em Dízimos e Ofertas / Informações Financeiras.$body$,
    'maintenance-dashboard?panel=primicias_management',
    v_ops,
    410
  );

  perform public._seed_knowledge_article(
    'modelo-preditivo',
    'Modelo Preditivo',
    'O que o modelo preditivo mostra na tesouraria?',
    $body$## Recorte
Projeção de 12 meses: arrecadação, média mensal, membros ativos, entradas/saídas e LTV. Sazonalidade aponta meses acima da média histórica.

## Recalcular
Use depois de carga de extrato ou mudança grande de membresia. Não é lançamento contábil nem orçamento — isso fica em Informações Financeiras.

## Tabelas
Previsão de receita e de membros mês a mês. Fórmulas de membros e LTV explicam o cálculo.$body$,
    'maintenance-dashboard?panel=predictive_insights',
    v_ops,
    420
  );

  perform public._seed_knowledge_article(
    'informacoes-financeiras-manutencao',
    'Informações Financeiras (manutenção)',
    'Como a tesouraria lança extrato, RD e orçamento?',
    $body$## Mês e versão
Escolha o mês e REALIZADO ou PLANEJADO. Esvaziar apaga os lançamentos daquela versão no mês — use só antes de recarregar.

## Contas Pix, CSV e comprovantes
Cadastre chaves (dízimo/oferta/campanha). Carga em lote importa o extrato CSV. Comprovantes em lote vinculam JPG pelo campo referência.

## Lançamentos, RD e atas
O extrato analítico do mês, a fila de Relatórios de Despesas e o repositório de atas (PDF) ficam nesta tela. A Aliança de 40% baixa em Aliança Conecta Reino.$body$,
    'maintenance-dashboard?panel=financials',
    v_ops,
    430
  );

  perform public._seed_knowledge_article(
    'relatorios',
    'Relatórios',
    'Como gero os relatórios da manutenção?',
    $body$## Catálogo
Oito relatórios desta igreja: membresia e tempo de congregação, faixa etária, necessidades pastorais, alertas do ministério infantil, quórum de assembleia, estimativa de estacionamento, sugestões e inscritos por evento.

## Membresia
No relatório 1 dá para ajustar o critério de inatividade (ex.: meses sem movimento) antes de gerar a lista.

## Escopo e tempo
Cada relatório lê só a instância da sessão. Relatórios grandes podem levar alguns segundos; filtre melhor se estourar o tempo.$body$,
    'maintenance-dashboard?panel=relatorios',
    v_ops,
    110
  );

  perform public._seed_knowledge_article(
    'controle-de-acesso',
    'Controle de Acesso',
    'Como libero ou bloqueio telas por papel?',
    $body$## Abas
Perfis atribui papel à pessoa. Papéis edita a matriz: Telas, Tabelas ou Colunas. Busque o recurso pelo nome ou rota.

## Ver e Editar
Azul celeste = produto. Amarelo cobre = manutenção. Toque no recurso para marcar visualização e edição daquele papel.

## App e LGPD
Os interruptores no topo ligam ou desligam o aplicativo e o fluxo LGPD da instância.

## Limite do Gestor
O Gestor de acesso opera esta tela, mas não vê nem altera o Super Administrador, PIN ou senha.$body$,
    'maintenance-dashboard?panel=access_control',
    v_acl,
    140
  );
end;
$$;

drop function if exists public._seed_knowledge_article(text, text, text, text, text, text[], integer);

notify pgrst, 'reload schema';

commit;
