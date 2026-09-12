-- Amplia com maestria os artigos da engrenagem: passo a passo, abas,
-- validações e o que não fazer. Um artigo por tela viva (sem modal extra
-- e sem Sala(s) Check-in / QR / estacionamento congelados).
-- Execute: npx supabase db query --linked -f scripts/knowledge-base-lote-5.sql

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
  v_ops text[] := array[
    'pastoral', 'tesoureiro', 'secretaria', 'events_admin',
    'gestor_controle_acesso', 'super_admin'
  ];
  v_sa text[] := array['super_admin'];
  v_acl text[] := array['super_admin', 'gestor_controle_acesso'];
  v_member text[] := array[
    'member', 'congregado', 'visitante', 'visitantes',
    'pastoral', 'tesoureiro', 'secretaria', 'events_admin',
    'gestor_controle_acesso', 'super_admin'
  ];
begin
  perform public._seed_knowledge_article(
    'totem-checkin',
    'Totem de check-in',
    'Como o totem confirma a família no culto?',
    $body$## Quando usar
Kiosk no hall, no dia do culto. Aponte a câmera para o QR da carteirinha/família.

## O que precisa estar certo
1. Evento publicado com data de hoje.
2. Totem = Sim (e/ou Requer quórum) na Programação de Eventos.
3. A família fez pré-check-in na Agenda da Família.
Sem isso aparece «Nenhum totem aberto hoje». Corrija a data ou a chave Totem e volte.

## Já confirmado
QR duplicado avisa. Não escaneie de novo.

## Sair do kiosk
Use Sair do aplicativo no rodapé do totem. Telefone e senha do totem são por igreja, em Instâncias.$body$,
    '/totem-checkin',
    v_ops,
    90
  );

  perform public._seed_knowledge_article(
    'instancias-igrejas',
    'Instâncias (igrejas)',
    'Como crio ou alterno o ambiente de uma igreja?',
    $body$## Quando usar
Só Super Administrador. Cada linha é uma igreja (multi-tenant): identidade, PIX, totem e dados isolados.

## Alternar
O checkbox marcado é a instância em uso. Desmarcada, os membros daquela igreja não entram; o SA continua podendo acessar.

## Igreja nova
Crie, preencha código, nome e ative. Código da instância é o que o membro digita no login.

## Aliança
Igreja mãe (indicação Aliança) liga a filha à mãe. Não indique a própria igreja nem feche um ciclo na árvore. Remover indicação só se não houver oferta Aliança em aberto.

## Totem e PIX
Telefone/senha do totem e chaves PIX são por igreja. Alterar aqui não muda as outras instâncias.$body$,
    '/igrejas',
    v_sa,
    80
  );

  perform public._seed_knowledge_article(
    'assinaturas',
    'Assinaturas',
    'Como a igreja assina ou renova o Conecta+?',
    $body$## Planos
A cobrança segue a quantidade de usuários ativos. Se o número atual estourar o limite, escolha um plano maior antes de assinar.

## Pagamento
Checkout Stripe (cartão) fora do app. Fatura paga libera o período; falha deixa a igreja inadimplente e pode suspender Aliança.

## Contrato
Renovar ou rescindir usa os botões desta tela. Rescisão no fim do período não gera estorno automático.

## Não misturar
Oferta de 40% da Aliança não é paga pelo Stripe à igreja mãe — a baixa é em Aliança Conecta Reino.$body$,
    '/billing',
    v_sa,
    100
  );

  perform public._seed_knowledge_article(
    'configuracao-salas',
    'Configuração de salas',
    'Como nomeio as salas, atribuo membros e vejo a distribuição?',
    $body$## Quando usar
Antes do culto, para turmas permanentes (infantil, jovens, discipulado, cursos). Não é o check-in Kids antigo do Painel.

## Aba Salas
Padrão do sistema (Infantil, Jovens) não some. Salas especiais e + Nova Sala criam turma extra. Excluir remove só a personalizada. O nome afetivo alimenta totem e listas.

## Aba Membros
Busque a pessoa e vincule à sala. Quem não tem sala fica na lista geral. Trocar de sala aqui não apaga o cadastro.

## Aba Distribuição
Ocupação e quórum por espaço. Use para ver se a capacidade do evento (Programação de Eventos) cabe.

## Ordem
Salas → membros → distribuição. Evento com salas erradas quebra o recorte do culto.$body$,
    '/configuracao-salas',
    v_ops,
    190
  );

  perform public._seed_knowledge_article(
    'autorizacao-midia',
    'Autorização de imagem e voz',
    'Como registro o termo LGPD de imagem e voz?',
    $body$## Quando usar
Antes de transmitir culto ou publicar foto. O membro (ou responsável) confirma o termo; com LGPD ligada, o e-mail de comprovante sai automaticamente.

## Passo a passo
1. Confira nome, e-mail, CPF e telefone.
2. Leia o texto do termo.
3. Marque Li e concordo.
4. Enviar e confirmar por e-mail.

## Ícone «i» desta tela
Abre o texto jurídico do termo — não é o catálogo Como faço.

## Pendência
Sem aceite, o cadastro de mídia fica pendente. App e LGPD da instância ligam/desligam em Controle de Acesso.$body$,
    '/autorizacao-midia',
    v_ops,
    200
  );

  perform public._seed_knowledge_article(
    'lista-membros',
    'Lista de Membros',
    'Como busco a comunidade, a família e os visitantes?',
    $body$## Quando usar
Secretaria e liderança: localizar pessoa, abrir família ou recortar visitantes/congregados/inativos.

## Filtros
Alterne o recorte (membros, congregados, visitantes, inativos). A busca filtra a lista visível. Abra a linha para a ficha/família.

## Mapa
O atalho geográfico só aparece se o papel tiver a tela Mapa. Pin exige CEP geocodificado.

## Papel
Troca de visitante/congregado/membro em lote é Mudança de Papéis. Permissão de tela é Controle de Acesso.

## Privacidade
Telefone e endereço seguem a ACL. O Gestor de acesso não lista nem vê o Super Administrador.$body$,
    '/membros',
    v_ops,
    210
  );

  perform public._seed_knowledge_article(
    'mapa-geolocalizacao',
    'Mapa de geolocalização',
    'Como leio os pins das famílias e das células?',
    $body$## O que aparece
Cada pin é família com CEP válido nesta igreja. Filtros: com papel, visitantes, pequenos grupos.

## Visualizar vs detalhe
Alguns papéis só veem o mapa. Abrir ficha/endereço de outra família exige permissão extra (toque no pin).

## Pendências
Cadastro sem CEP geocodificado não entra. Corrija o CEP no perfil ou no Cadastro de Usuário e recarregue.

## Células
O filtro de pequenos grupos mostra anfitrião/endereço da célula — cadastro em Gestão de Pequenos Grupos.$body$,
    '/mapa-geolocalizacao',
    v_ops,
    220
  );

  perform public._seed_knowledge_article(
    'aniversariantes',
    'Aniversariantes',
    'Como vejo os aniversários do mês e mando WhatsApp?',
    $body$## Quando usar
Secretaria/acolhimento no início do mês (ou da semana) para saudar.

## Passo a passo
1. Escolha o mês.
2. Confira a lista (data de nascimento do cadastro desta igreja).
3. Toque no WhatsApp se houver telefone — abre saudação pronta.

## Nome sumiu
Falta data de nascimento, ou o papel da pessoa não entra neste recorte. Complete o cadastro; não cadastre de novo.$body$,
    '/aniversariantes',
    v_ops,
    230
  );

  perform public._seed_knowledge_article(
    'cuidados-pastorais',
    'Cuidados Pastorais',
    'Como trato a fila do Coração Aberto e publico horários?',
    $body$## Aba Pedidos
Fila desta igreja. Filtre por solicitante. Abra o card para ler o pedido, registrar o cuidado e encerrar. Sigilo pastoral só quem tem ACL; Intercessão vai para a equipe de oração.

## Aba Minha Agenda
Publique slots (data, hora, presencial ou online, atendente). Duração típica ~50 min. O membro escolhe o horário em Coração Aberto; o slot some da lista.

## O que não fazer
Não use como mural público. Sugestão de produto e acolhimento de visitante têm telas próprias. Não apague pedido tratado sem registrar o encaminhamento.$body$,
    'maintenance-dashboard?panel=pastoral_care',
    v_ops,
    240
  );

  perform public._seed_knowledge_article(
    'gestao-pequenos-grupos',
    'Gestão de Pequenos Grupos',
    'Como crio a célula, faço a chamada e publico o roteiro?',
    $body$## Novo grupo
Seletor Novo grupo. Nome, datas no calendário, anfitrião (quem recebe em casa) e líder (quem conduz) — buscas separadas por nome ou celular. Incluir participante só entra na chamada; não substitui anfitrião/líder. Criar grupo.

## Grupo existente
Selecione na lista para editar, fazer chamada, registrar visitante e publicar o roteiro da semana (aparece em Minha Célula).

## Chamada
Marque presença por reunião. Visitante na fila da célula não vira membro sozinho — papel continua em Mudança de Papéis.

## Pedido «Quero participar»
Confirme ou recuse o encaixe. Sair do grupo o membro confirma na própria tela.$body$,
    'maintenance-dashboard?panel=small_groups_management',
    v_ops,
    250
  );

  perform public._seed_knowledge_article(
    'mural-voluntarios-admin',
    'Mural de Voluntários',
    'Como publico uma vaga e acompanho o interesse?',
    $body$## Nova vaga
Título, descrição, ministério (tipo de escala), líder responsável (WhatsApp das candidaturas) e, se quiser, dons da Lição 5.1 para o match. Status: rascunho, aberta, pausada, concluída. Só Aberta aparece para o membro. A Trilha não é pré-requisito para o membro se candidatar.

## Privacidade
O perfil ministerial individual não vai para o mural público — só o cruzamento com a vaga, quando existir.

## Interesse
Candidatura avisa o líder, inclusive de quem ainda não fez a Trilha. Acompanhe a lista e caminhe com o candidato nesse processo. O membro usa Mural de Oportunidades.

## Depois
Sem tipo de escala, a vaga não se encaixa na programação. Cadastre o tipo em Tipos de Escala se a frente for nova.$body$,
    'maintenance-dashboard?panel=volunteer_mural',
    v_ops,
    260
  );

  perform public._seed_knowledge_article(
    'moderacao-mural',
    'Moderação do Mural',
    'Como aprovo, publico e encerro anúncios de generosidade?',
    $body$## Aba Pendentes
Fila do que o membro enviou. Aprove para publicar ou recuse conteúdo impróprio. «Nenhum anúncio nesta fila» = nada aguardando.

## Aba Publicados
Anúncios visíveis. Conclua ou oculte item já entregue / duplicado. A moderação não substitui o combinado entre as pessoas.

## Aba Interesses
Quem marcou Doar ou Emprestar. Libere o contato (WhatsApp) quando fizer sentido.

## Não misturar
Vaga de serviço é Mural de Voluntários. Pedido pastoral é Coração Aberto.$body$,
    'maintenance-dashboard?panel=generosity_moderation',
    v_ops,
    270
  );

  perform public._seed_knowledge_article(
    'recepcao-familiar',
    'Recepção Familiar',
    'Como recebo a família no culto e gravo a fila?',
    $body$## Link rápido
Mostre o QR ou a URL da instância. O visitante abre o app no próprio celular (código da igreja já vai na URL).

## Convite WhatsApp
Nome de quem recebe + celular com DDD. O WhatsApp abre mesmo se o número não estiver nos seus contatos. Atualizar limpa os campos para o próximo.

## Fila pendente
Famílias da ficha (totem/autoatendimento) entram aqui. Confira representantes, cônjuge e filhos (código novo vs vínculo existente). Gravar efetiva; Rejeitar descarta. Gravar dispara a Régua (D+1, D+4, D+8).

## Não fazer
Não crie segundo cadastro com o mesmo celular — busque antes em Cadastro de Usuário.$body$,
    'maintenance-dashboard?panel=family_reception',
    v_ops,
    280
  );

  perform public._seed_knowledge_article(
    'regua-acolhimento',
    'Régua de Acolhimento',
    'Como executo D+1, D+4 e D+8 depois da recepção?',
    $body$## Quem entra
Só quem a Recepção Familiar gravou. Não há inclusão manual nesta tela. Atualizar recarrega o dia.

## PARA FAZER AGORA
- D+1 WhatsApp: abra o modelo, envie, Concluir.
- D+4 Célula: convite ao pequeno grupo perto do CEP.
- D+8 Culto: se não houver check-in, priorize o alerta pastoral.

## Atalho
Abrir Recepção Familiar volta à fila de cadastro.

## Não misturar
Pedido de oração continua no Coração Aberto. Esta régua é só visitante recém-recebido.$body$,
    'maintenance-dashboard?panel=visitor_followup',
    v_ops,
    290
  );

  perform public._seed_knowledge_article(
    'cadastro-usuario',
    'Cadastro de Usuário',
    'Como busco ou crio um cadastro sem duplicar o celular?',
    $body$## Busca primeiro
Digite ao menos 2 letras. O resultado mostra nome, telefone e código. Toque para abrir a ficha.

## Novo
Só se a busca vazia. Nome, telefone e dados mínimos da família. Papel inicial em geral é visitante; promoção é Mudança de Papéis.

## Duplicidade
Dois cadastros com o mesmo celular geram sessão errada. Se achar o telefone, edite a ficha — não crie outra.

## Depois
Família completa em Gerenciar família / Recepção. Permissões de tela em Controle de Acesso.$body$,
    'maintenance-dashboard?panel=profile_cadastro',
    v_ops,
    300
  );

  perform public._seed_knowledge_article(
    'administrativo',
    'Administrativo',
    'Onde publico atas e atos constitutivos?',
    $body$## O que é
PDFs institucionais (estatuto, atas, regimento). Filtro Atos constitutivos → Ver documentos publicados.

## Publicar
O envio/renomeação das atas também pode passar pelo card Atas de assembleias em Informações Financeiras. Esta tela é consulta do documento, não lançamento de caixa.

## RD
Relatório de Despesas do membro fica em Perfil / tela de RD. Tesouraria aprova em Informações Financeiras.$body$,
    '/administrativo',
    v_ops,
    310
  );

  perform public._seed_knowledge_article(
    'livros-doados',
    'Cantinho da Leitura',
    'Como o membro reserva e como a biblioteca opera o acervo?',
    $body$## Membro (Cantinho)
Perfil > Cantinho da Leitura. Busca por título/autor, ficha (ISBN), prazos (retirada e devolução; padrão 30 dias), Reservar livro. Meus títulos: Reservado / retirar hoje. Cancelar libera o exemplar.

## Acervo (engrenagem)
ISBN ou cadastro manual. Cada livro é desta igreja. Aba de empréstimos: quem levou, renovação, devolução. Reserva do membro entra para separar na estante (carteirinha na retirada). Histórico guarda o que já voltou.

## Não misturar
Pedido informal entre irmãos pode ir ao Mural de Generosidade. Exclusão de exemplar no acervo é irreversível — confira o título.$body$,
    '/livros-doados',
    v_member,
    26
  );

  perform public._seed_knowledge_article(
    'programacao-eventos',
    'Programação de Eventos',
    'Como crio, publico, duplico (+7) e apago um culto?',
    $body$## Novo evento
Nome, data/hora, local, capacidade, salas/recursos. Salvar.

## Chaves
- Publicação: visível na home (senão fica rascunho).
- Totem: kiosk no hall.
- Requer quórum: lista de presença.
- Somente membros: culto fechado a visitantes.

## +7
Cópia para daqui a 7 dias (mesmo horário, local, capacidade e salas). Nasce rascunho — publique depois.

## Editar / apagar
Toque no card. Evento com inscrição: mude com cuidado. Apagar remove a programação.

## Lista vazia no totem/presença
Volte aqui e confira data de hoje + Totem/Quórum = Sim.$body$,
    'maintenance-dashboard?panel=events',
    v_ops,
    330
  );

  perform public._seed_knowledge_article(
    'cronograma-eventos',
    'Cronograma de Eventos',
    'Como leio publicado vs rascunho no calendário?',
    $body$## Visões
Por dia (grade da semana) ou por mês. Ponto preenchido = publicado (membro vê). Círculo vazado = rascunho (só liderança).

## Para que serve
Choque de horários e cobertura do período (totais no topo). Toque no bloco para abrir o cadastro.

## Criar e +7
Continuam em Programação de Eventos. O cronograma não substitui o formulário.$body$,
    'maintenance-dashboard?panel=events_gantt',
    v_ops,
    340
  );

  perform public._seed_knowledge_article(
    'manutencao-avisos',
    'Manutenção de Avisos',
    'Como publico um comunicado na home com o público certo?',
    $body$## Onde o membro vê
Página Avisos da home (ao lado de Próximos Eventos), só se Publicado estiver ligado.

## Publicar
Título opcional, texto, chave Publicado. Opcional: só líderes de células; só perfil ministerial compatível. Salvar aviso.

## Lista
Avisos cadastrados: Editar ou Excluir. Excluir tira da home na hora.

## Não usar para
Pedido pastoral, vaga de voluntariado, campanha financeira ou régua de visitante — cada um tem tela própria.$body$,
    'maintenance-dashboard?panel=event_orchestration',
    v_ops,
    350
  );

  perform public._seed_knowledge_article(
    'tipos-escala',
    'Tipos de Escala',
    'Como cadastro uma frente (vagas, ciclo e troca autônoma)?',
    $body$## Novo tipo
Nome (o que o servo vê), código gerado, vagas por domingo, modo do ciclo: Individual (um servo por data) ou Equipe (até N no mesmo domingo). Permita troca autônoma se o escalado puder pedir substituto do mesmo tipo. Cadastrar.

## Escalas cadastradas
Lista com código, vagas e modo. Lápis edita; lixeira remove o tipo (não apaga o membro).

## Ordem da operação
1) Tipo → 2) Servos em Disponibilidade → 3) Programação de Escalas.

## Sem tipo
Não há o que programar nem vaga no Mural de Voluntários ligada à frente.$body$,
    'maintenance-dashboard?panel=scale_types',
    v_ops,
    360
  );

  perform public._seed_knowledge_article(
    'servos-disponibilidade',
    'Servos em Disponibilidade',
    'Como vinculo voluntários a um tipo de escala?',
    $body$## Tipo primeiro
Escolha o tipo no filtro. Sem tipo cadastrado, a lista não faz sentido.

## Associar
Busque pelo nome completo e confirme. Só quem está em Já associados entra na programação e na troca autônoma.

## Remover
Lixeira tira o vínculo daquele tipo. O cadastro da pessoa na igreja permanece.

## Atualizar
Recarrega a lista depois de incluir vários nomes. Datas saem em Programação de Escalas.$body$,
    'maintenance-dashboard?panel=scale_volunteers',
    v_ops,
    370
  );

  perform public._seed_knowledge_article(
    'programacao-escalas',
    'Programação de Escalas',
    'Como monto a escala, gravo em bloco e intervenho num dia?',
    $body$## Tipo e histórico
Filtre o tipo. + Nova escala inclui data/pessoa pontual. Escala em bloco gera a prévia (N escalas em X domingos, modo individual/equipe). Confira a tabela → Gravar bloco ou Cancelar.

## Intervir
Só aquele dia, com servos do mesmo tipo livres. Ciclo futuro do original não muda. Motivo opcional. WhatsApp no candidato se precisar alinhar antes de Substituir.

## Lixeira
Tira a pessoa daquela data. Pedido de troca do membro, se a igreja liberou, chega para a liderança confirmar.

## Veículo
Acolhimento/estacionamento pode pedir identificação do carro — não reabre o card antigo do Painel.$body$,
    'maintenance-dashboard?panel=scales',
    v_ops,
    380
  );

  perform public._seed_knowledge_article(
    'lista-presenca',
    'Presença',
    'Como gero a lista de check-in do culto?',
    $body$## Condição
Precisa de evento com Totem e/ou Requer quórum = Sim. Se a tela disser que não há evento com quórum, edite o culto em Programação de Eventos, ligue a chave e Salvar.

## O que a lista junta
Pré-check-in da Agenda da Família + confirmação no totem (e quórum). QR duplicado = já confirmou.

## Não é escala
Quem serve aparece em Programação de Escalas. Visitante sem pré-check-in não entra pelo totem.

## Assembleia
Quórum estatutário de votantes é o relatório Quórum oficial, em Relatórios — não esta lista.$body$,
    'maintenance-dashboard?panel=quorum_presence',
    v_ops,
    390
  );

  perform public._seed_knowledge_article(
    'informacoes-financeiras-manutencao',
    'Informações Financeiras (manutenção)',
    'Como concilio o mês: Pix, CSV, comprovantes, RD e atas?',
    $body$## Mês e versão
Escolha o mês. REALIZADO = caixa; PLANEJADO = orçamento. Esvaziar apaga aquela versão no mês — só antes de recarregar o CSV.

## Contas Pix
Chaves ilimitadas: padrão de dízimos/ofertas e chave por campanha. Conferir titular e CNPJ antes de publicar no app do membro.

## Carga e comprovantes
CSV do banco no card Carga em lote (versão do mês). Comprovantes em lote: JPG pelo campo referência. Lançamentos: extrato analítico.

## RD e atas
Fila de Relatórios de Despesas do mês (aprovar/pagar). Atas: publicar/renomear PDF (também visível em Administrativo).

## Aliança
Os 40% não baixam aqui — tela Aliança Conecta Reino.$body$,
    'maintenance-dashboard?panel=financials',
    v_ops,
    430
  );

  perform public._seed_knowledge_article(
    'gestao-campanhas',
    'Gestão de Campanhas',
    'Como crio a campanha, os centavos simbólicos e publico?',
    $body$## Nova campanha
Título, descrição, meta, já arrecadado (fora do app — entra no % da meta), datas, conta Pix. Capa opcional. Salvar.

## Centavos simbólicos
Sufixo (ex. 31 → ,31). O PIX Copia e Cola do membro já sai com esses centavos; a conciliação separa o fundo da receita ordinária. Oriente: não alterar os centavos no banco.

## Status
Rascunho = membro não vê. Ativo = Eu quero… / Campanhas. Concluído = some da contribuição; histórico permanece.

## Desempenho
Ao reabrir a campanha: % da meta, doadores, velocidade/dia, sufixo e banco. Ajuste meta ou data final se precisar.$body$,
    'maintenance-dashboard?panel=campaigns_management',
    v_ops,
    400
  );

  perform public._seed_knowledge_article(
    'primicias',
    'Prímicias (manutenção)',
    'Como marco a data da cesta e cadastro os itens?',
    $body$## Data da campanha
Informe o dia da arrecadação presencial e Gravar data do evento. Entra na agenda do membro. Itens não entregues voltam à lista após o prazo (em geral dez dias).

## Novo item
Quantidade, unidade (pacote, lata…), nome, peso. Cadastrar item. Categorias: alimentos, higiene, crianças.

## Leitura da lista
Pendente = ainda precisa de doador. Tachado com nome = alguém assumiu no app. Lixeira remove item cadastrado errado.

## Não é PIX
Dinheiro continua em Dízimos e Ofertas / Informações Financeiras.$body$,
    'maintenance-dashboard?panel=primicias_management',
    v_ops,
    410
  );

  perform public._seed_knowledge_article(
    'modelo-preditivo',
    'Modelo Preditivo',
    'Como leio a projeção de 12 meses e quando recalculo?',
    $body$## Resumo
Arrecadação projetada, média mensal, membros no fim do ciclo, entradas/saídas, LTV. Sazonalidade: meses acima da média histórica.

## Tabelas
Previsão de receita e de membros mês a mês. Fórmula membros / Fórmula LTV explicam o cálculo.

## Recalcular modelo
Depois de carga de CSV ou mudança grande de membresia. Não é lançamento nem orçamento — isso fica em Informações Financeiras.

## Uso
Apoio a tesouraria e conselho. Número zerado costuma ser base curta ou mês sem realizado.$body$,
    'maintenance-dashboard?panel=predictive_insights',
    v_ops,
    420
  );

  perform public._seed_knowledge_article(
    'temas-trilha',
    'Temas da Trilha',
    'Como edito textos, vídeos e a ordem das lições?',
    $body$## Conteúdo desta igreja
Cada passo tem bloco (texto, vídeo, reflexão). O que você publica é o que o aluno vê em Perfil > Trilha.

## Ordem
Não pule o passo disponível. Não use Resetar Trilha para «corrigir» um texto — edite o tema.

## Próximo
Aluno 100% aparece em Trilha — Reconhecimentos. Reset de progresso é outra tela, só Super Administrador.$body$,
    'maintenance-dashboard?panel=discipleship_themes',
    v_ops,
    440
  );

  perform public._seed_knowledge_article(
    'trilha-reconhecimentos',
    'Trilha — Reconhecimentos',
    'Como homologo quem concluiu a Trilha?',
    $body$## Lista
Alunos com 100% dos passos nesta igreja, prontos para certificado / cerimônia.

## Guia do Processo
Descreve o rito pastoral (batismo, recepção, formatura). O «i» do catálogo resume o painel; o guia é o passo a passo da liderança.

## Não resetar daqui
Reiniciar um aluno é Resetar Trilha (SA). Daqui só se reconhece quem terminou.$body$,
    'maintenance-dashboard?panel=discipleship_alerts',
    v_ops,
    450
  );

  perform public._seed_knowledge_article(
    'resetar-trilha',
    'Resetar Trilha',
    'Como reinicio a Trilha de um usuário nesta igreja?',
    $body$## Efeito
O progresso daquele usuário nesta instância volta ao início. Ele refaz os passos. A ação fica no log.

## Quem pode
Somente Super Administrador. Confirme nome e telefone. Não use para corrigir uma lição — edite Temas da Trilha.

## Depois
O aluno some de Reconhecimentos até concluir de novo.$body$,
    'maintenance-dashboard?panel=discipleship_reset',
    v_sa,
    460
  );

  perform public._seed_knowledge_article(
    'relatorios',
    'Relatórios',
    'Como escolho e gero os oito relatórios da igreja?',
    $body$## Catálogo (esta instância)
1. Membresia (ativos, inativos, congregados, tempo) — dá para ajustar meses sem movimento.
2. Faixa etária.
3. Necessidades pastorais.
4. Alertas do ministério infantil (saúde/alergia) — relatório, não a tela Kids congelada.
5. Quórum oficial de assembleia.
6. Estimativa de estacionamento por evento — relatório, não o card antigo.
7. Sugestões e melhorias.
8. Inscritos por evento.

## Como gerar
Abra o acordeão, preencha o filtro (quando houver) e execute. Relatório grande pode levar alguns segundos; se estourar, afine o filtro.

## Isolamento
Não mistura outra igreja da sessão.$body$,
    'maintenance-dashboard?panel=relatorios',
    v_ops,
    110
  );

  perform public._seed_knowledge_article(
    'controle-de-acesso',
    'Controle de Acesso',
    'Como libero telas, tabelas e colunas por papel?',
    $body$## Abas
Perfis: papel da pessoa. Papéis: matriz. Pessoas: consulta. Em Papéis, sub-abas Telas, Tabelas e Colunas. Buscar recurso por nome ou rota.

## Telas
Azul celeste = produto. Amarelo cobre = manutenção. Ver e Editar por papel. App Ativo / LGPD no topo valem para a instância inteira.

## Colunas
profiles.* controla Dados cadastrais. PIN (access_pin) não se vê nem se edita — e o Gestor nunca vê Super Administrador, PIN ou senha.

## Não misturar
Atribuição em lote visitante/congregado/membro é Mudança de Papéis. Quem de fato logou é Acesso Usuários.$body$,
    'maintenance-dashboard?panel=access_control',
    v_acl,
    140
  );

  perform public._seed_knowledge_article(
    'mudanca-papeis',
    'Mudança de papéis',
    'Como altero visitante, congregado ou membro em lote?',
    $body$## Quando usar
Secretaria/recepção: reclassificar o papel básico na tabela (radio Visitante / Congregado / Membro). Filtre por nome, telefone ou código. Recarregar lista depois de várias trocas.

## Efeito
Vale na hora para menus e telas. Peça hard refresh se o menu antigo permanecer.

## O que esta tela não faz
Não concede tesoureiro/pastoral/gestor — isso é Controle de Acesso (Perfis). Não simula outro usuário (Modo Ghost).

## Quem não aparece
O Gestor de acesso não lista nem edita o Super Administrador. PIN e senha nunca aparecem.$body$,
    'maintenance-dashboard?panel=mudanca_papeis',
    v_ops,
    120
  );

  perform public._seed_knowledge_article(
    'transferencia-membro',
    'Transferência de Membro',
    'Como transfiro o cadastro para outra igreja da rede?',
    $body$## Destino
Igreja da rede Conecta+. A origem deixa de ser a instância ativa da pessoa.

## O que vai
Cadastro básico. Histórico pastoral e financeiro da origem não vira livro da igreja nova.

## Como usar
Siga o popup Como usar da tela: localize pelo telefone/código, confira a origem e confirme. Transferência errada exige Super Administrador para desfazer.

## Antes
Não transfira visitante sem cadastro estável. Duplicidade de celular na destino impede o movimento.$body$,
    'maintenance-dashboard?panel=transferencia_igreja',
    v_ops,
    470
  );

  perform public._seed_knowledge_article(
    'acesso-usuarios',
    'Acesso Usuários',
    'Como vejo quem já entrou e quais telas visitou?',
    $body$## Recorte
Super Administrador: quem já teve ao menos um login nesta aplicação. Busca: nome, telefone ou código.

## Telas visitadas
O popup lista a navegação daquele usuário. Não é matriz de permissão.

## Não é ACL
Para liberar tela, use Controle de Acesso. Para mudar visitante/membro, Mudança de Papéis. O Gestor não aparece como se fosse Super Administrador.$body$,
    'maintenance-dashboard?panel=profile_access_insights',
    v_sa,
    480
  );

  perform public._seed_knowledge_article(
    'modo-ghost',
    'Modo Ghost',
    'Como simulo a sessão de outro usuário para auditar permissões?',
    $body$## O que é
Você vê o app com as permissões do alvo. As ações ficam no nome dele, com auditoria do operador real. Só administradores autorizados.

## Ativar
Busque nome, telefone ou código de usuário ativo desta igreja → Ativar. O estado persiste na navegação até Encerrar Ghost no banner, sair do app ou logout.

## Cuidado
Não use para «consertar» cadastro no lugar da pessoa sem necessidade. Tudo fica no log. Não peça a senha do alvo.$body$,
    'maintenance-dashboard?panel=auditor',
    v_sa,
    130
  );
end;
$$;

drop function if exists public._seed_knowledge_article(text, text, text, text, text, text[], integer);

notify pgrst, 'reload schema';

commit;
