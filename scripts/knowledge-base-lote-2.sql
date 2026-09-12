-- Lote 2 da base de conhecimento: Célula, murais do membro e telas vivas da engrenagem.
-- Não cobre Sala(s) Check-in (tela congelada). Autorização de mídia entra no catálogo,
-- sem segundo «i» (já há ajuda legal LGPD na tela).
-- Execute: npx supabase db query --linked -f scripts/knowledge-base-lote-2.sql

begin;

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
begin
  perform public._seed_knowledge_article(
    'pequeno-grupo',
    'Minha Célula',
    'Como vejo minha célula e falo com o líder?',
    $body$## O que é
A célula (pequeno grupo) da sua jornada na igreja: horário, endereço, líder e anfitrião.

## Se você ainda não tem grupo
A tela explica como pedir inclusão. A liderança confirma o encaixe em Gestão de Pequenos Grupos.

## Falta e roteiro
Avise o líder pelo WhatsApp se não puder ir. Quando houver roteiro da semana, ele aparece aqui.$body$,
    '/pequeno-grupo',
    v_member,
    160
  );

  perform public._seed_knowledge_article(
    'mural-oportunidades',
    'Mural de Oportunidades',
    'Como me candidato a uma vaga de serviço?',
    $body$## O que aparece
Vagas alinhadas ao seu Perfil Ministerial. O resultado da Lição 5.1 da Trilha não é listado aqui — só o cruzamento com as vagas abertas.

## Candidatar-se
Toque na vaga para registrar interesse. O aplicativo avisa o líder da frente e, se houver telefone, abre o WhatsApp.

## Sem vagas
Pode faltar perfil ministerial preenchido ou a igreja ainda não publicou oportunidades.$body$,
    '/mural-oportunidades',
    v_member,
    170
  );

  perform public._seed_knowledge_article(
    'mural-generosidade',
    'Mural de Generosidade',
    'Como peço, doo ou empresto no mural?',
    $body$## Doar ou pedir
Publique um item (doação) ou um pedido. Foto ajuda quem for atender.

## Atender um pedido
Em cada pedido dá para marcar Doar ou Emprestar. A outra pessoa vê o interesse; a conclusão do anúncio é de quem publicou ou da moderação.

## Moderação
Anúncios impróprios são tratados pela liderança em Moderação do Mural, na engrenagem.$body$,
    '/mural-generosidade',
    v_member,
    180
  );

  perform public._seed_knowledge_article(
    'configuracao-salas',
    'Configuração de salas',
    'Como nomeio as salas e atribuo membros?',
    $body$## Nomes afetivos
Cada sala do culto ganha o nome que a igreja usa no dia a dia. Isso alimenta check-in e totem.

## Atribuição
Membros podem ser ligados a uma sala. Quem não tem sala continua na lista geral.

## O que esta tela não é
Não é o check-in infantil antigo do Painel. Aqui só se configura o cadastro das salas.$body$,
    '/configuracao-salas',
    v_ops,
    190
  );

  perform public._seed_knowledge_article(
    'autorizacao-midia',
    'Autorização de imagem e voz',
    'Como a igreja registra o termo LGPD de imagem e voz?',
    $body$## Para que serve
Registra o consentimento de uso de imagem e voz nas transmissões e fotos da igreja, com confirmação por e-mail quando o fluxo LGPD está ligado.

## O ícone desta tela
O «i» ao lado do título abre o texto jurídico do termo — não é o catálogo «Como faço…?».

## Quem opera
Secretaria e liderança acompanham quem já autorizou. Sem autorização, o cadastro de mídia fica pendente.$body$,
    '/autorizacao-midia',
    v_ops,
    200
  );

  perform public._seed_knowledge_article(
    'lista-membros',
    'Lista de Membros',
    'Como busco a comunidade e vejo visitantes?',
    $body$## Filtros
Alterne entre membros, congregados, visitantes e inativos. A busca filtra a lista visível.

## Família e mapa
Pelas linhas dá para abrir a família. O atalho de mapa mostra o recorte geográfico, se o seu papel tiver essa tela.

## Privacidade
Telefone e endereço seguem a ACL. O Gestor de acesso não vê o Super Administrador.$body$,
    '/membros',
    v_ops,
    210
  );

  perform public._seed_knowledge_article(
    'mapa-geolocalizacao',
    'Mapa de geolocalização',
    'Como leio os pins das famílias no mapa?',
    $body$## O que os pins são
Cada pin é uma família com endereço/CEP válido nesta igreja. Células também podem aparecer.

## Visualizar vs detalhe
Alguns papéis só veem o mapa. Abrir o endereço de outra família exige permissão extra.

## Quem não entra no mapa
Cadastro sem CEP geocodificado fica na lista de pendências. Corrija o CEP no perfil.$body$,
    '/mapa-geolocalizacao',
    v_ops,
    220
  );

  perform public._seed_knowledge_article(
    'aniversariantes',
    'Aniversariantes',
    'Como vejo os aniversários do mês e mando WhatsApp?',
    $body$## Mês
Escolha o mês no filtro. A lista usa a data de nascimento do cadastro nesta igreja.

## WhatsApp
O ícone abre a conversa com uma saudação pronta, se houver telefone.

## Sem nome na lista
Falta data de nascimento ou o papel da pessoa não entra neste recorte.$body$,
    '/aniversariantes',
    v_ops,
    230
  );

  perform public._seed_knowledge_article(
    'cuidados-pastorais',
    'Cuidados Pastorais',
    'Como a fila pastoral e a agenda de atendimento funcionam?',
    $body$## Pedidos
A aba Pedidos é a fila do Coração Aberto desta igreja: priorize, registre o cuidado e encerre.

## Minha Agenda
Quem agenda atendimento publica horários aqui. O membro escolhe o slot na tela Coração Aberto.

## Sigilo
O conteúdo é pastoral. Não use esta tela como mural público.$body$,
    'maintenance-dashboard?panel=pastoral_care',
    v_ops,
    240
  );

  perform public._seed_knowledge_article(
    'gestao-pequenos-grupos',
    'Gestão de Pequenos Grupos',
    'Como crio células, faço chamada e publico o roteiro?',
    $body$## Cadastro
Crie o grupo, defina líder, anfitrião, dia e endereço. Inclua os membros da célula.

## Chamada
Marque presença por reunião. Visitante entra na fila da célula sem virar membro automaticamente.

## Roteiro
Publique o guia da semana para aparecer na tela Minha Célula dos participantes.$body$,
    'maintenance-dashboard?panel=small_groups_management',
    v_ops,
    250
  );

  perform public._seed_knowledge_article(
    'mural-voluntarios-admin',
    'Mural de Voluntários',
    'Como publico vagas no mural de oportunidades?',
    $body$## Publicar
Cadastre a vaga com frente, descrição e perfil ministerial desejado. Só vagas publicadas aparecem para o membro.

## Interesse
Quando alguém se candidata, o líder da vaga é avisado. Acompanhe pela lista desta tela.

## Relação com a Trilha
O match usa o Perfil Ministerial; a lição 5.1 em si não é uma vaga.$body$,
    'maintenance-dashboard?panel=volunteer_mural',
    v_ops,
    260
  );

  perform public._seed_knowledge_article(
    'moderacao-mural',
    'Moderação do Mural',
    'Como moderar doações e pedidos de generosidade?',
    $body$## O que moderar
Pedidos e doações do Mural de Generosidade. Encerrar, ocultar ou concluir um anúncio que já foi atendido.

## Quando agir
Conteúdo impróprio, item já entregue ou pedido duplicado. A moderação não substitui o combinado entre as pessoas.

## Membro
Quem publica e quem oferece continua usando o mural do menu do membro.$body$,
    'maintenance-dashboard?panel=generosity_moderation',
    v_ops,
    270
  );

  perform public._seed_knowledge_article(
    'recepcao-familiar',
    'Recepção Familiar',
    'Como recebo uma família visitante no culto?',
    $body$## Fluxo
Registre quem chegou, vincule à família e conclua a recepção. Isso dispara a Régua de Acolhimento (D+1, D+4, D+8).

## Totem
Família com pré-check-in no totem chega mais rápido nesta fila.

## Depois da recepção
O acompanhamento WhatsApp / célula / culto fica na Régua de Acolhimento, não nesta tela.$body$,
    'maintenance-dashboard?panel=family_reception',
    v_ops,
    280
  );

  perform public._seed_knowledge_article(
    'regua-acolhimento',
    'Régua de Acolhimento',
    'Como acompanho o visitante depois da recepção?',
    $body$## Prazos
D+1 WhatsApp, D+4 convite à célula, D+8 convite ao culto. Cada passo só faz sentido depois da Recepção Familiar.

## Marcar feito
Registre o contato quando acontecer. Atraso aparece para a liderança priorizar.

## Não misturar
Pedido pastoral continua no Coração Aberto. Esta régua é só acolhimento de visitante.$body$,
    'maintenance-dashboard?panel=visitor_followup',
    v_ops,
    290
  );

  perform public._seed_knowledge_article(
    'cadastro-usuario',
    'Cadastro de Usuário',
    'Como a recepção cadastra um novo usuário?',
    $body$## Quando usar
Visitante ou membro ainda sem login. Preencha nome, telefone e dados mínimos da família.

## Papel inicial
O cadastro entra como visitante ou conforme a regra da igreja. Troca de papel é em Mudança de Papéis.

## Duplicidade
Busque o telefone antes de criar. Dois cadastros com o mesmo celular geram sessão errada.$body$,
    'maintenance-dashboard?panel=profile_cadastro',
    v_ops,
    300
  );

  perform public._seed_knowledge_article(
    'administrativo',
    'Administrativo',
    'Onde ficam atas e atos constitutivos?',
    $body$## Atas
A lista mostra os PDFs das assembleias já enviados. Toque para abrir a via assinada.

## O que não está aqui
Relatório de Despesas e tesouraria ficam no Financeiro. Esta tela é documento institucional, não lançamento.$body$,
    '/administrativo',
    v_ops,
    310
  );

  perform public._seed_knowledge_article(
    'livros-doados',
    'Livros doados',
    'Como cadastro o acervo e os empréstimos?',
    $body$## Acervo
Busque pelo ISBN ou cadastre na mão. Cada livro pertence a esta igreja.

## Empréstimos
A aba de empréstimos registra quem levou e a devolução. Histórico guarda o que já voltou.

## Mural
Pedido de livro entre irmãos pode passar pelo Mural de Generosidade; o acervo formal é esta tela.$body$,
    '/livros-doados',
    v_ops,
    320
  );

  perform public._seed_knowledge_article(
    'programacao-eventos',
    'Programação de Eventos',
    'Como crio e publico um culto ou evento?',
    $body$## Publicar
Preencha nome, data e salas. A chave Publicação deixa o evento visível na home do membro.

## Totem e quórum
Ative Totem ou Requer Quórum quando o culto precisar de check-in no hall ou lista de presença.

## Edição
Evento passado fica limitado. Ajuste com cuidado para não quebrar inscrições já feitas.$body$,
    'maintenance-dashboard?panel=events',
    v_ops,
    330
  );

  perform public._seed_knowledge_article(
    'cronograma-eventos',
    'Cronograma de Eventos',
    'Como leio a linha do tempo dos eventos?',
    $body$## Gantt
A barra mostra duração e sobreposição dos eventos publicados. Toque no bloco para abrir o cadastro.

## Para que serve
Planejar a semana e ver choque de horários. A criação em si continua em Programação de Eventos.$body$,
    'maintenance-dashboard?panel=events_gantt',
    v_ops,
    340
  );

  perform public._seed_knowledge_article(
    'manutencao-avisos',
    'Manutenção de Avisos',
    'Como publico um comunicado na home?',
    $body$## O que o membro vê
Avisos publicados aparecem na segunda página da home (ao lado de Próximos Eventos).

## Publicar
Cadastre o texto, o período e publique. Rascunho não aparece para a congregação.

## Não usar para
Pedido pastoral, vaga de voluntariado ou campanha financeira — cada um tem a tela própria.$body$,
    'maintenance-dashboard?panel=event_orchestration',
    v_ops,
    350
  );

  perform public._seed_knowledge_article(
    'tipos-escala',
    'Tipos de Escala',
    'Como cadastro louvor, recepção e outras frentes?',
    $body$## Tipo
Cada frente (louvor, recepção, intercessão…) é um tipo. O nome aparece na tela Escalas do membro.

## Quem vê
A ACL do tipo controla quem consulta a programação. Sem o tipo, não há escala para preencher.

## Próximo passo
Depois do tipo, cadastre os servos e a programação nas telas seguintes.$body$,
    'maintenance-dashboard?panel=scale_types',
    v_ops,
    360
  );

  perform public._seed_knowledge_article(
    'servos-disponibilidade',
    'Servos em Disponibilidade',
    'Como incluo voluntários em um tipo de escala?',
    $body$## Vincular
Escolha o tipo e adicione o membro. Só quem está nesta lista entra na programação.

## Remover
Tirar o servo do tipo não apaga o cadastro da pessoa na igreja.

## Programação
Datas e horários saem em Programação de Escalas.$body$,
    'maintenance-dashboard?panel=scale_volunteers',
    v_ops,
    370
  );

  perform public._seed_knowledge_article(
    'programacao-escalas',
    'Programação de Escalas',
    'Como monto quem serve em cada data?',
    $body$## Montar
Escolha o tipo e atribua servos às datas. O membro vê o próprio recorte na tela Escalas.

## Trocas
Se a igreja liberou, o servo pede troca; a liderança confirma por aqui ou na caixa de pedidos.

## Estacionamento
Tipo de recepção/estacionamento pode pedir identificação de veículo — isso não reabre o card antigo do Painel.$body$,
    'maintenance-dashboard?panel=scales',
    v_ops,
    380
  );

  perform public._seed_knowledge_article(
    'lista-presenca',
    'Presença',
    'Como confiro quem fez check-in no culto?',
    $body$## Origem
A lista junta Totem e Quórum do evento de hoje (ou do evento escolhido). Sem Totem/Quórum no cadastro do evento, a lista fica vazia.

## Família
O check-in é por família com pré-inscrição. QR duplicado avisa que já confirmou.

## Não é escala
Quem serve no culto aparece em Escalas, não necessariamente nesta lista.$body$,
    'maintenance-dashboard?panel=quorum_presence',
    v_ops,
    390
  );

  perform public._seed_knowledge_article(
    'gestao-campanhas',
    'Gestão de Campanhas',
    'Como abro uma campanha de ofertas?',
    $body$## Campanha
Defina título, período e meta. O membro contribui pela tela Dízimos e Ofertas / Eu quero.

## Prímicias
Itens em espécie ficam na tela Prímicias, ligada a esta campanha.

## Encerrar
Campanha encerrada some da contribuição do membro, mas o histórico financeiro permanece.$body$,
    'maintenance-dashboard?panel=campaigns_management',
    v_ops,
    400
  );

  perform public._seed_knowledge_article(
    'primicias',
    'Prímicias',
    'Como registro itens em espécie da campanha?',
    $body$## O que é
Doação em item (cesta, bem), não PIX. Cada linha pertence a uma campanha.

## Baixa
Marque quando o item foi entregue. Isso não lança tesouraria automaticamente.

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
Projeção e alertas da tesouraria desta igreja, com base nos lançamentos já feitos.

## Não é orçamento
Orçamento e realizado continuam em Informações Financeiras. O modelo só antecipa tendência.

## Leitura
Use como apoio à decisão pastoral/tesouraria, não como lançamento contábil.$body$,
    'maintenance-dashboard?panel=predictive_insights',
    v_ops,
    420
  );

  perform public._seed_knowledge_article(
    'informacoes-financeiras-manutencao',
    'Informações Financeiras (manutenção)',
    'Como a tesouraria lança extrato, RD e orçamento?',
    $body$## Lançamentos
Extrato, Relatório de Despesas e orçamento do mês escolhido. É a operação da tesouraria, não só a leitura do membro.

## Mês
Tudo filtra pelo mês de referência. Mês só planejado deixa o realizado vazio.

## Aliança
Ofertas de apoio ministerial da Aliança aparecem no recorte da igreja mãe; a baixa dos 40% é na tela Aliança Conecta Reino.$body$,
    'maintenance-dashboard?panel=financials',
    v_ops,
    430
  );

  perform public._seed_knowledge_article(
    'temas-trilha',
    'Temas da Trilha',
    'Como edito textos e vídeos da Trilha de Discipulado?',
    $body$## Conteúdo local
Os temas desta igreja (textos, vídeos, reflexões). O que você publica aparece para quem está na Trilha.

## Passos
Cada passo da jornada tem o seu bloco. Não misture com Resetar Trilha (isso apaga progresso).

## Reconhecimentos
Aluno 100% pronto para certificado fica em Trilha — Reconhecimentos.$body$,
    'maintenance-dashboard?panel=discipleship_themes',
    v_ops,
    440
  );

  perform public._seed_knowledge_article(
    'trilha-reconhecimentos',
    'Trilha — Reconhecimentos',
    'Como vejo quem concluiu a Trilha?',
    $body$## Lista
Alunos com 100% dos passos desta igreja, prontos para certificado.

## Guia do processo
O botão Guia do Processo descreve a cerimônia. O «i» do catálogo resume o painel.

## Reset
Reiniciar um aluno é outra tela (Resetar Trilha), só Super Administrador.$body$,
    'maintenance-dashboard?panel=discipleship_alerts',
    v_ops,
    450
  );

  perform public._seed_knowledge_article(
    'resetar-trilha',
    'Resetar Trilha',
    'Como reinicio a Trilha de um usuário nesta igreja?',
    $body$## Efeito
O progresso da Trilha daquele usuário nesta instância volta ao início. Ele pode refazer os passos.

## Quem pode
Somente Super Administrador. Não use para «corrigir» um passo — edite o tema ou oriente o aluno.

## Auditoria
A ação fica registrada. Confirme o nome certo antes de resetar.$body$,
    'maintenance-dashboard?panel=discipleship_reset',
    v_sa,
    460
  );

  perform public._seed_knowledge_article(
    'transferencia-membro',
    'Transferência de Membro',
    'Como transfiro alguém para outra igreja do Conecta+?',
    $body$## Destino
Escolha a igreja de destino na rede. A origem deixa de ser a instância ativa daquela pessoa.

## O que vai junto
Cadastro básico. Histórico pastoral e financeiro da origem não vira livro da igreja nova.

## Conferência
Confirme telefone e nome. Transferência errada exige Super Administrador para desfazer.$body$,
    'maintenance-dashboard?panel=transferencia_igreja',
    v_ops,
    470
  );

  perform public._seed_knowledge_article(
    'acesso-usuarios',
    'Acesso Usuários',
    'Como vejo quem já entrou no aplicativo?',
    $body$## Recorte
Painel do Super Administrador: só quem já teve pelo menos um login nesta aplicação.

## Busca
Nome, telefone ou código. Não lista o Gestor como se fosse Super Administrador.

## Não é ACL
Para liberar telas, use Controle de Acesso. Esta tela é auditoria de quem de fato entrou.$body$,
    'maintenance-dashboard?panel=profile_access_insights',
    v_sa,
    480
  );
end;
$$;

drop function if exists public._seed_knowledge_article(text, text, text, text, text, text[], integer);

notify pgrst, 'reload schema';

commit;
