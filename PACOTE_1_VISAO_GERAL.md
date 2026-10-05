# Pacote 1 — Visão Geral

Documentação **autocontida** para diretoria, membros, famílias e voluntários.

**Atualizado em:** 05/10/2026

Conteúdo integrado: Funcionalidades · Manual de Treinamento · FAQ

Navegação publicada: **Início + menu lateral + Eu quero… + Perfil + engrenagem**.

---

# Parte 1 — Funcionalidades do Conecta+

---

# Funcionalidades do Conecta+

Referência funcional completa do **Conecta+ / app-igreja**, organizada pela experiência publicada e pelos públicos que operam o produto.

Itens marcados como **gestão** dependem de papel e grant no Controle de Acesso. O conteúdo exibido também respeita a igreja ativa, a identidade efetiva da sessão e as políticas do banco.

> **Estado do produto em 05/10/2026.** A experiência principal não é o antigo carrossel do Painel. O caminho publicado é **Início + menu lateral + Eu quero… + engrenagem de manutenção**. Os cards listados em `FROZEN_DASHBOARD_CARD_CONTENTS` permanecem congelados, fora da publicação e não devem ser usados como mapa funcional.

**Documentação relacionada:** [`INDICE_DOCUMENTACAO.md`](INDICE_DOCUMENTACAO.md) · [`MANUAL_ENTREGA.md`](MANUAL_ENTREGA.md) · [`PACOTE_1_VISAO_GERAL.md`](PACOTE_1_VISAO_GERAL.md) · [`MANUAL_TREINAMENTO.md`](MANUAL_TREINAMENTO.md) · [`MANUAL_CONTROLE_ACESSO.md`](MANUAL_CONTROLE_ACESSO.md) · [`CONTROLE_ACESSO.md`](CONTROLE_ACESSO.md) · [`BLUEPRINT.md`](BLUEPRINT.md) · [`DEPLOY_CLOUDFLARE.md`](DEPLOY_CLOUDFLARE.md)

**Atualizado em:** 05/10/2026

---

## 1. Visão geral e navegação publicada

O Conecta+ é uma plataforma PWA multi-tenant para membros, famílias, visitantes, liderança, secretaria, pastoral, tesouraria, voluntários e administração de múltiplas igrejas. Reúne relacionamento comunitário, eventos, contribuições, cuidado pastoral, escalas, finanças, documentos, governança e operação.

### 1.1 Estrutura principal

| Área | Papel na experiência atual |
|------|-----------------------------|
| **Início** | Caixa de entrada de próximos eventos e avisos, agenda familiar, bolo de aniversários do dia, sticker de novos membros, Abigail e bloco **Eu quero…** |
| **Menu lateral** | Autonomia cotidiana do membro: Perfil, Financeiro, Documentos oficiais, Minha Célula, Escalas, murais, Apoio Mútuo, Sugestões, ajuda, redes e informações do produto |
| **Eu quero…** | Ações diretas: contribuir com dízimos/ofertas, campanhas/projetos e Prímicias; solicitar Cuidado Pastoral |
| **Engrenagem** | Operação, pessoas, culto/eventos, finanças/inteligência, governança e TI; cada item é filtrado pela ACL |

### 1.2 O antigo Painel

- `/(tabs)/dashboard` não é o produto publicado; redireciona para a experiência viva.
- `/(tabs)/explore` e `/explore` estão congelados.
- Os cards antigos de agenda, QR, salas, ofertas, pastoral, lista de membros, aniversariantes, financeiro, escalas, estacionamento, perfil, administrativo e campanhas não formam mais um carrossel operacional.
- Deep links antigos são resolvidos para a rota dedicada equivalente quando ela existe; caso contrário, voltam ao Início.
- **Minha Célula** e **Mural de Oportunidades** continuam vivos em rotas dedicadas.

---

## 2. Multi-tenant, instâncias e identidade da igreja

- Uma instalação atende **múltiplas igrejas/instâncias**.
- A sessão mantém uma igreja ativa (`tenant_id`); consultas, RPCs, RLS, parâmetros, arquivos e operações usam esse tenant.
- Um usuário vinculado a mais de uma igreja escolhe onde operar em **Selecionar igreja**.
- A troca de instância atualiza identidade visual, nome/código, parâmetros, permissões, conteúdo, cobrança e caches dependentes do tenant.
- Perfis, famílias, eventos, avisos, contribuições, cuidado pastoral, escalas, documentos e registros de acesso são isolados por igreja.
- Formulários públicos carregam o tenant explicitamente para impedir que um cadastro entre na igreja errada.
- O Super Administrador gerencia instâncias em **Instâncias (Igrejas)**: identificação, estado ativo, identidade visual, contatos, redes, site, PIX e credenciais de totem.
- A opção **Ao sair** é configurada por instância. Com o switch ligado e uma URL oficial válida, o logout encerra a sessão e abre o site da igreja; sem URL ou com o switch desligado, apenas encerra o app.
- O mesmo número de celular pode ser configurado como **totem em igrejas diferentes**. Não há unicidade global: telefone e senha são validados no contexto do tenant escolhido.

---

## 3. Autenticação, primeiro acesso e sessão

### 3.1 Login

- Login por **celular + PIN de 4 dígitos**.
- O telefone é normalizado para o padrão brasileiro e o PIN é validado no servidor.
- Sessões recebem token próprio e carregam `profile_id` e `tenant_id`; o banco resolve a identidade por cabeçalhos de sessão.
- A sessão é restaurada ao reabrir o PWA, enquanto válida.
- Usuários vinculados a várias igrejas passam pela seleção de instância.
- Instância inativa direciona usuários comuns para a seleção de igreja; o Super Administrador mantém acesso administrativo.
- O login reconhece o dispositivo de totem e o conduz ao fluxo dedicado.

### 3.2 Primeiro acesso e recuperação do PIN

- **Primeiro acesso:** o PIN temporário é enviado exclusivamente por **e-mail**.
- **Esqueci minha senha:** a recuperação valida os dados/pergunta de segurança e envia o novo PIN por **e-mail**.
- **WhatsApp não é canal de entrega do PIN de autenticação.**
- WhatsApp continua sendo usado em recursos operacionais — convites, acolhimento, aniversários, escalas, murais, visitantes, reembolsos e contatos — sem participar da recuperação do PIN.
- O celular cadastrado como totem é bloqueado no fluxo de primeiro acesso de usuário.
- Em Dados Cadastrais, o usuário pode trocar o PIN mediante validação do PIN atual.

### 3.3 Encerramento e segurança de sessão

- **Sair do aplicativo** limpa referências locais da sessão.
- A URL **Ao sair**, quando habilitada na instância, só é aberta depois do encerramento.
- Totem, sessão comum, sessão Ghost e troca de igreja possuem finalidades separadas.
- Reparos de sessão não transformam uma linha de `members` sem perfil válido em usuário autenticado.

---

## 4. Cadastro, LGPD e recepção

### 4.1 Cadastro inicial

- Nome completo, data de nascimento, celular, CEP e dados complementares.
- Preenchimento e normalização de endereço por CEP.
- Reserva/vinculação de código de família.
- Selfie por câmera ou arquivo, quando exigida.
- Validação de cadastro pendente antes de liberar a experiência completa.
- Novo cadastro entra na **inbox de novos cadastros**, isolada pela igreja.

### 4.2 LGPD por instância

- `LGPD_Ativo` é um parâmetro por igreja em `app_parameters`.
- Com LGPD ativo, o fluxo exige termos, consentimento e etapas configuradas, incluindo selfie quando aplicável.
- Com LGPD inativo, o cadastro segue de forma simplificada.
- O **texto completo do consentimento LGPD também é por instância**, armazenado em `app_parameters`.
- O Super Administrador edita o texto em **Controle de Acesso**; esse conteúdo é o exibido no cadastro e na tela de LGPD.
- Aceites ficam registrados no banco. A interface não usa um texto global fixo para todas as igrejas.

### 4.3 Cadastro público e Recepção Familiar

- `/cadastro-familia` atende famílias sem sessão autenticada e recebe o tenant no link.
- O formulário coleta informante, dependentes, parentesco, telefone, nascimento, endereço, data de casamento e campos de cuidado.
- As submissões entram em fila antes de criar/atualizar `profiles` e `members`.
- **Recepção Familiar** permite:
  - revisar lotes e integrantes;
  - detectar família existente por telefone, nome, nascimento e código;
  - visualizar conflitos entre famílias;
  - corrigir data de nascimento provisória e CEP ausente;
  - processar ou rejeitar lotes;
  - descartar um integrante sem rejeitar necessariamente toda a família;
  - preservar o `family_id` detectado.
- A área **Novos Membros** permite escolher uma pessoa já cadastrada para montar convite.
- O convite público inclui o **`family_id`** no link e preenche o **telefone** do convidado; nome, igreja e celular podem ser ajustados antes do envio.
- O convite é aberto no WhatsApp, mas o cadastro continua sendo processado pela fila da Recepção Familiar.

### 4.4 Inbox e Régua de Acolhimento

- Cada novo `profile` gera registro operacional na inbox, com data, papel efetivo, telefone, status de visto e vínculo com a régua.
- A equipe pode marcar o cadastro como visto.
- A régua automática só começa quando o perfil é **visitante efetivo**: possui papel `visitantes` e não possui `congregado`, `member` ou `super_admin`.
- Também exige cadastro mínimo concluído, nome válido e telefone utilizável.
- A promoção do visitante interrompe a régua automática correspondente.
- A jornada padrão cria tarefas de acolhimento: WhatsApp no dia 1, convite à célula no dia 4 e ligação pastoral no dia 8.
- A Régua de Acolhimento oferece quadro por visitante, tarefas, vencimentos, responsáveis e conclusão.

---

## 5. Início

### 5.1 Eventos e agenda familiar

- A primeira página da caixa de entrada lista **Próximos Eventos** com nome, local, data e horário.
- Tocar em um evento abre a Agenda da Família.
- A família seleciona integrantes, verifica vagas e realiza pré-inscrição/audiência.
- O compromisso pode ser adicionado ao Google Agenda e exportado em `.ics`, no fuso da igreja.
- Eventos podem habilitar capacidade, público, salas, totem, quórum e geofence.
- O check-in automático por proximidade valida janela temporal, raio, precisão e leituras GPS estáveis; possui fila para sincronização.

### 5.2 Caixa de avisos

- A segunda página reúne avisos publicados pela igreja.
- A mesma inbox agrega notificações de agenda pastoral, campanhas, oportunidades de voluntariado, generosidade, empréstimos de livros e trocas de escala.
- Avisos pessoais suportados são marcados como lidos após a carga.
- Avisos gerais atualizam em tempo real.

### 5.3 Bolo de aniversários

- O bolo aparece ao lado de **Próximos Eventos somente quando há celebração hoje**.
- Exibe aniversários pessoais e **aniversários de casamento** do dia.
- A lista mensal completa permanece na rota Aniversariantes.
- Conforme permissão, a mensagem de felicitação pode ser copiada.
- A data de casamento é mantida nos integrantes; Representante Legal e Cônjuge da mesma família são sincronizados como casal.

### 5.4 Sticker de admissão

- A etiqueta amarela retrátil `HomeAdmissionSticker` sinaliza novos registros.
- Para Super Administrador, permanece disponível mesmo sem pendências; para perfis operacionais autorizados, aparece quando há pendência.
- Pendência de Recepção Familiar tem prioridade e abre esse painel.
- Novo visitante fora da recepção abre **Mudança de Papéis** já filtrada em Visitante.
- Sem pendências, informa que não há novos registros aguardando admissão.

### 5.5 Eu quero…

| Ação | Conteúdo |
|------|----------|
| **Contribuir → Dízimos e Ofertas** | Informa valor, apresenta recebedor e copia a chave PIX |
| **Contribuir → Campanhas e Projetos** | Lista campanhas ativas e gera contribuição identificada |
| **Contribuir → Prímicias** | Compromisso com item em espécie, por categoria |
| **Cuidado Pastoral** | Pedido de oração, intercessão, conversa ou acompanhamento |

### 5.6 Abigail

- Botão de chat ao lado do título **Eu quero…**, visível apenas para papéis autorizados de liderança.
- A assistente responde em modal próprio, sem retirar o usuário do Início.
- A chave Gemini pertence à igreja, fica no Supabase e não é embutida no aplicativo.
- Apenas o Super Administrador configura/substitui a chave.
- Interações podem ser auditadas com data, usuário, papel, pergunta e resposta, conforme grant.

---

## 6. Menu lateral do membro

A fonte de verdade é `APP_DRAWER_MENU_ITEMS` em `lib/appDrawerMenu.ts`.

| Item publicado | Funcionalidade |
|----------------|----------------|
| **Início** | Eventos, avisos, celebrações do dia, sticker, Abigail e Eu quero… |
| **Perfil** | Hub pessoal e familiar |
| **Financeiro** | Informações financeiras autorizadas e documentos financeiros |
| **Documentos oficiais** | Atas de assembleia e outros documentos publicados da igreja |
| **Minha Célula** | Dados e vida do pequeno grupo do membro |
| **Escalas** | Escalas, datas, funções, contatos e solicitações de troca |
| **Mural de Oportunidades** | Oportunidades de serviço/voluntariado |
| **Mural de Generosidade** | Doações e pedidos de empréstimo, com moderação |
| **Apoio Mútuo** | Serviços oferecidos por pessoas da comunidade |
| **Sugestões** | Envio e acompanhamento de sugestões e melhorias |
| **Como faço…?** | Ajuda contextual e base de conhecimento para o uso do produto |
| **Redes Sociais** | Links oficiais configurados pela igreja |
| **Sobre o Conecta+** | Informações institucionais e do produto |

Os itens são filtrados por ACL, vínculo ativo quando exigido e identidade efetiva no Modo Ghost.

---

## 7. Perfil, família e comunidade

### 7.1 Hub Perfil

- **Dados Cadastrais:** nome, nascimento, CPF, e-mail, telefone, endereço, CEP, selfie, veículos e alteração de PIN.
- **Ofereço meus Serviços:** cria o cartão que alimenta o Apoio Mútuo.
- **Gerenciar Família:** integrantes, parentesco, reconhecimento, vínculos e transferências.
- **Carteirinha Digital:** identificação do usuário.
- **Trilha de Discipulado:** 5 passos, lições sequenciais, selos e reconhecimentos; Perfil Ministerial na lição 5.1.
- **Reembolsos:** criação e consulta de Relatórios de Despesas.
- **Cantinho da Leitura:** livros retirados pelo usuário.
- As ações aparecem conforme grants da identidade efetiva.

### 7.2 Gerenciar Família

- CRUD de integrantes, sem permitir exclusão indevida do Representante Legal.
- Busca de perfil por telefone ou nome.
- Detecção de duplicidade e confirmação de transferência entre famílias.
- Sincronização de `family_id` entre `members` e `profiles`.
- Herança do endereço completo do responsável nos fluxos autorizados.
- Campos de parentesco, nascimento, telefone, aceite e data de casamento.
- Campos de cuidado infantil: **restrição alimentar/alertas médicos**, **necessidades específicas** e **observações adicionais**.

### 7.3 Lista de Famílias

- Diretório da igreja agrupado pelo código de família.
- Busca uma família por **código ou nome de qualquer integrante**.
- Exibe integrantes ordenados por parentesco, nome completo e papel.
- Permite abrir a edição do integrante dentro do contexto familiar.
- A consulta é escopada ao tenant e exige vínculo ativo/permissão do diretório.

### 7.4 Lista de membros, visitantes e mapa

- Diretório com alternância entre membros e visitantes, busca, família, WhatsApp e localização.
- Modal de integrantes da família.
- Mapa web com pins por CEP, filtros e estatísticas.
- Abrir detalhes de um pin exige recurso ACL próprio; ver o mapa não concede automaticamente acesso aos dados detalhados.

### 7.5 Apoio Mútuo

- Fluxo deliberadamente simples: **categorias → nomes → cartão**.
- Primeiro mostra categorias de serviços em ordem alfabética; categorias sem oferta ficam desabilitadas.
- Ao escolher a categoria, abre os nomes e títulos dos ofertantes.
- Ao escolher a pessoa, abre cartão com serviço, apresentação, contato e ações disponíveis.
- Usa selfie ou iniciais e dados da própria igreja.
- O membro publica/edita sua oferta em **Perfil → Ofereço meus Serviços**.

### 7.6 Enxergar

- **Enxergar** é o padrão de busca ampliada aplicado a campos selecionados.
- Em pickers, combina pesquisa e lista filtrada em modal no topo.
- Em listas próprias, abre `EnxergarSearchModal` sem alterar o critério original.
- O usuário pesquisa com o mesmo campo de domínio — nome, telefone, código etc. — e seleciona o resultado com mais contexto.
- Está presente, entre outros fluxos, em Controle de Acesso, Atribuições, Mudança de Papéis, Recepção Familiar, membros e Acessos de Usuários.

---

## 8. Contribuições, campanhas e financeiro

### 8.1 Dízimos, ofertas e campanhas

- Exibe dados do recebedor e chave PIX da instância.
- Permite informar valor e copiar o PIX.
- Campanhas/projetos ativos possuem período, meta e identificação para conciliação.
- Prímicias registra compromissos com itens em espécie por categoria.
- Gestão de Campanhas cria, publica, conclui e acompanha fundos.
- Gestão de Prímicias mantém categorias, itens, quantidades e compromissos.

### 8.2 Financeiro para o membro

- Resultado mensal e acumulado.
- Comparativo com mês anterior.
- Matriz dos últimos 12 meses.
- Planejado × Realizado.
- Saldos bancários por conta e saldo total.
- Atas de assembleias disponibilizadas no módulo também alimentam **Documentos oficiais**.

### 8.3 Reembolsos / Relatório de Despesas

- RD com múltiplos itens, valores, comprovantes e chave PIX.
- Submissão final e contato com tesouraria.
- Consulta de histórico e detalhes.
- Exclusão pelo autor enquanto o relatório permanece pendente e elegível.
- Tesouraria concilia o RD com lançamento financeiro e pode remover o vínculo.

### 8.4 Manutenção financeira

- Importação por CSV ou conteúdo colado.
- Versões REALIZADO e PLANEJADO.
- Substituição, acréscimo e esvaziamento mensal escopado.
- Comentários, resumos, orçamento e relatórios de despesas.
- Modelo Preditivo apresenta inteligência conforme dados e grant disponíveis.

---

## 9. Cuidado Pastoral

- Pedido para o próprio usuário, família ou terceiro.
- Motivo, situação, categorias e subcategorias.
- Destino em **Sigilo Pastoral** ou **Ministério de Intercessão**.
- Equipe de intercessão não recebe automaticamente pedidos sigilosos.
- **Meus pedidos** mostra status e histórico.
- Antes do início do atendimento, o solicitante pode usar **Excluir** quando a regra permitir.
- Depois que o Cuidado Pastoral inicia o acompanhamento, o membro solicita cancelamento e informa justificativa.
- O pedido fica aguardando análise; somente `super_admin` confirma a exclusão por `approve_pastoral_cancellation`.
- O painel de gestão possui fila, responsável, status, agenda e slots de atendimento.
- Notificações de agenda pastoral chegam à inbox do Início.

---

## 10. Eventos, Espaço Infantil e presença

### 10.1 Programação e check-in

- Eventos com nome, local, período, capacidade, publicação, público, ofertas e salas.
- Audiência/pré-check-in por integrante da família.
- Check-in por QR/totem, manual, quórum ou geofence.
- Locais favoritos guardam CEP, endereço e coordenadas.
- Alterações críticas em evento/local invalidam check-ins incompatíveis.
- Proteções contra confirmação duplicada e reprocessamento.

### 10.2 Visitantes / Cadastro Rápido

- Identifica o culto ativo e seu código de 4 dígitos.
- Consulta o celular do responsável e diferencia novo visitante, visitante recorrente e membro ativo.
- Para novo visitante, cadastra responsável, filhos e aceite de imagem/LGPD.
- Para recorrente, pré-carrega responsável e crianças já conhecidos.
- Cada criança recebe nascimento ou idade, restrição alimentar, necessidades específicas e observações.
- Ao concluir, cria/preserva `family_id`, gera QR e envia no WhatsApp link do crachá e imagem do código.

### 10.3 Espaço Infantil — QR de entrada e saída

- O QR da família/visitante identifica o grupo no Espaço Infantil.
- A equipe realiza **check-in de entrada** e valida o mesmo vínculo na **saída/retirada**.
- A tela de sala usa as inscrições do evento e as salas habilitadas.
- O responsável recebe o QR pelo Cadastro Rápido e pode reapresentá-lo na retirada.
- Dados de cuidado acompanham a criança para apoiar os professores: alimentação/alertas médicos, necessidades específicas e observações adicionais.
- A visualização do membro é limitada à própria família; a equipe autorizada enxerga a operação do evento.

### 10.4 Quórum

- Eventos podem exigir registro formal de quórum.
- A confirmação alimenta Lista de Presença com horário.
- A gestão consulta e imprime a presença.

---

## 11. Células, murais, livros e escalas

### 11.1 Pequenos grupos

- **Minha Célula** exibe o vínculo do membro.
- Gestão de Pequenos Grupos mantém grupos, liderança, participantes e acompanhamento.
- Relatórios do grupo podem alimentar o Cuidado Pastoral.

### 11.2 Murais

- **Mural de Oportunidades:** vagas de voluntariado, candidatura/participação e avisos.
- **Mural de Generosidade:** doações e pedidos de empréstimo.
- **Mural de Voluntários:** gestão das oportunidades.
- **Moderação do Mural:** análise e estado das publicações de generosidade.
- Atualizações relevantes chegam à inbox.

### 11.3 Livros

- **Livros doados:** acervo, busca ISBN e cadastro manual.
- **Cantinho da Leitura:** empréstimos do usuário.
- Avisos de empréstimo podem aparecer no Início.

### 11.4 Escalas

- Membro consulta tipo, data, função, equipe e contatos.
- Solicitações/trocas produzem avisos na Home.
- **Tipos de Escala:** código, nome, vagas por serviço e modo individual/equipe.
- **Servos em Disponibilidade:** voluntários e ordem.
- **Programação de Escalas:** registro manual e geração de ciclo em bloco, com prévia e aplicação transacional.

---

## 12. Documentos oficiais e administrativo

- **Documentos oficiais** é item direto do menu.
- Exibe documentos publicados da igreja ativa; atualmente integra as atas de assembleia disponíveis no Financeiro.
- Cada registro informa título, tipo, data e link assinado quando disponível.
- Acesso é destinado a membros e respeita identidade efetiva/tenant.
- **Administrativo** concentra atos constitutivos e conteúdo administrativo autorizado.
- **Autorização de imagem e voz** gerencia termos e confirmação por e-mail.

---

## 13. Engrenagem de manutenção

A fonte de verdade é `APP_DRAWER_SETTINGS_ITEMS` em `lib/appDrawerMenu.ts`. A tabela abaixo inclui **todos os itens**, inclusive rotas dedicadas que não são cards internos de `/maintenance-dashboard`.

### 13.1 Operação e Segurança

| Item | Função |
|------|--------|
| **Configuração de salas** | Nomes afetivos, capacidade/configuração e atribuição de membros às salas |
| **Totem de check-in** | Leitor QR no hall e operação dedicada de presença |
| **Autorização de imagem e voz** | Termos, LGPD e confirmação por e-mail |

### 13.2 Gestão de Pessoas

| Item | Função |
|------|--------|
| **Visitantes / Cadastro Rápido** | Check-in de visitantes e crianças, QR/crachá e dados de cuidado |
| **Recepção Familiar** | Fila pública, inspeção de família, convites com `family_id`, processamento e rejeição |
| **Régua de Acolhimento** | Inbox de novos cadastros e jornadas D+1/D+4/D+8 |
| **Lista de Membros** | Diretório da comunidade |
| **Cadastro de Usuário** | Busca, correções cadastrais e administração autorizada |
| **Lista de Famílias** | Famílias e integrantes por código |
| **Mapa de geolocalização** | Pins das famílias e filtros |
| **Aniversariantes** | Aniversários pessoais e de casamento |
| **Cuidados Pastorais** | Fila, sigilo/intercessão, responsáveis, slots e cancelamentos |
| **Gestão de Pequenos Grupos** | Células, líderes, participantes e acompanhamento |
| **Mural de Voluntários** | Oportunidades de serviço |
| **Moderação do Mural** | Doações e pedidos de empréstimo |
| **Administrativo** | Atos constitutivos |
| **Livros doados** | Acervo, ISBN e cadastro manual |

### 13.3 Culto e Eventos

| Item | Função |
|------|--------|
| **Programação de Eventos** | CRUD, publicação, capacidade, salas, totem, quórum e geofence |
| **Cronograma de Eventos** | Visão temporal/Gantt e abertura para edição |
| **Manutenção de Avisos** | Comunicados publicados na Home |
| **Sala(s) - Check In** | Entrada/saída do Espaço Infantil |
| **Tipos de Escala** | Tipos, vagas e ciclo |
| **Servos em Disponibilidade** | Voluntários por escala |
| **Programação de Escalas** | Agenda manual e geração em bloco |
| **Presença** | Quórum, lista e impressão |

### 13.4 Finanças e Inteligência

| Item | Função |
|------|--------|
| **Informações Financeiras** | Lançamentos, importação, orçamento, comentários e RD |
| **Gestão de Campanhas** | Campanhas, projetos, metas, período e publicação |
| **Prímicias** | Itens em espécie e compromissos |
| **Modelo Preditivo** | Análises e projeções autorizadas |

### 13.5 Governança e TI

| Item | Função |
|------|--------|
| **Temas da Trilha** | Textos, vídeos e reflexões das lições |
| **Trilha — Reconhecimentos** | Alunos prontos para reconhecimento/certificado |
| **Resetar Trilha** | Reinício controlado do progresso na igreja |
| **Como faço…?** | Ajuda das telas da engrenagem |
| **Base de conhecimento** | Edição dos artigos da ajuda in-app |
| **Relatórios** | Catálogo analítico autorizado |
| **Controle de Acesso** | Papéis, grants, parâmetros, app ativo, Gestão Liberada e LGPD |
| **Mudança Papéis** | Promoção/transição entre visitante, congregado e membro |
| **Transferência de Membro** | Transferência entre igrejas/famílias conforme fluxo |
| **Acesso Usuários** | Logins e telas por sessão; exclusivo de `super_admin` |
| **Modo Ghost** | Auditoria pela identidade efetiva de outro perfil |
| **Assinaturas** | Planos, contratos, Stripe e cobrança da igreja |
| **Aliança Conecta Reino** | Indicações, passivo e baixa de ofertas; Super Administrador |
| **Indicados** | Funil Kanban exclusivo do Super Administrador |
| **Instâncias (Igrejas)** | Criação, configuração e alternância de tenants |
| **Chave Gemini** | Chave da Abigail e auditoria de IA; configuração pelo Super Administrador |

### 13.6 Atribuições

- **Atribuições** fica ao lado de **Mudança Papéis** dentro dessa experiência, com acesso da Equipe Pastoral e do Super Administrador.
- Seleciona um papel operacional e lista as pessoas da igreja.
- Permite ligar/desligar o papel com **Sim/Não**.
- Oferece busca Enxergar por nome, filtro por atribuídos/não atribuídos e paginação.
- Não substitui Mudança de Papéis: esta trata a jornada de vínculo; Atribuições trata papéis operacionais.

---

## 14. Controle de acesso (ACL)

- Recursos por `screen`, `dashboard_card`, `table` e `column`, com ações como `view` e `update`.
- UI filtra menu, engrenagem, ações e campos; o banco aplica RLS e RPCs `SECURITY DEFINER`.
- Guards de rota operam em modo fail-closed fora do Ghost.
- Controle de Acesso oferece visão por pessoa/papel e por recurso.
- Parâmetros administrativos incluem aplicação ativa/inativa, mensagem de indisponibilidade, **Gestão Liberada**, `LGPD_Ativo` e texto LGPD.
- Papéis incluem visitante, congregado, membro, secretaria/operação, liderança, eventos, tesouraria, pastoral, Gestor em Controle de Acesso e Super Administrador, conforme configuração da instância.

### 14.1 Gestor em Controle de Acesso

- A proteção autoritativa está no SQL (`assert_gestor_super_admin_shield`, visibilidade do ator e RPCs).
- O Gestor **não lista, visualiza nem edita** o perfil ou papel `super_admin`.
- Não vê registros de acesso do Super Administrador.
- Não vê nem concede acesso a PIN/senha (`access_pin`, `password`, `senha`).
- O cliente repete os filtros como defesa em profundidade.

### 14.2 Acessos de Usuários

- Painel exclusivo de `super_admin`.
- Lista usuários que possuem login registrado, último acesso e total de acessos.
- Abre histórico das telas visitadas, agrupado por sessão, do acesso mais recente ao mais antigo.
- Permite busca Enxergar, atualização e limpeza global do histórico.

---

## 15. Assinaturas, Stripe e Gestão Liberada

- Planos possuem código, nome, descrição, capacidade e preço Stripe.
- Checkout é criado pela API do Cloudflare; o retorno sincroniza assinatura e pagamento.
- O módulo acompanha status, período, cancelamento ao fim do ciclo, capacidade, membros/congregados ativos e contratos SaaS.
- O cliente pode solicitar cancelamento ou retomada da assinatura.
- O gate comercial considera instância ativa, assinatura e rotas administrativas.
- **Gestão Liberada** é um switch por tenant no Controle de Acesso.
- Quando ligado, toda a instância opera sem exigir plano Stripe ativo.
- O Super Administrador pode liberar ou bloquear a gestão e não é preso pelo paywall.
- Instância inativa e cobrança são estados distintos.
- No Modo Ghost, paywall, billing e escolha de instância usam o **operador real**, nunca o perfil simulado.

---

## 16. Modo Ghost

- Disponível ao Super Administrador ou a quem possui grant explícito de auditor.
- O operador escolhe um perfil-alvo e passa a navegar com sua **identidade efetiva**.
- Perfil, telefone, `family_id`, ACL de telas e dados são resolvidos pelo alvo.
- O bypass de Super Administrador do operador fica desligado para a ACL simulada.
- O auditor pode abrir e permanecer na rota escolhida por menu, Eu quero… ou deep link.
- Negação de grant do alvo não provoca bounce para o Início e não cobre a tela com “Sem acesso nesta simulação”; dados/RLS seguem a identidade efetiva.
- O Ghost não injeta histórico extra nem cancela navegação ao fechar modais.
- Iniciar Ghost leva ao Início uma única vez já como o alvo; encerrar retorna ao Início na identidade real.
- Cobrança, assinatura, tenant e paywall continuam vinculados ao operador real.

---

## 17. Segurança e infraestrutura

- Expo/React Native com PWA web; build de produção em `dist/`.
- Supabase/PostgreSQL com RLS, RPCs e Storage.
- Sessão customizada com token, perfil e tenant; dados críticos não confiam apenas em estado local.
- Escritas sensíveis usam RPCs transacionais e `SECURITY DEFINER`.
- PIN não é exibido em listagens administrativas.
- CPF, consentimento, alertas médicos, necessidades especiais, pastoral sigiloso e dados financeiros têm controles específicos.
- Isolamento tenant é aplicado tanto na sessão quanto nas consultas/RPCs.
- Operações financeiras, recepção, ACL, Ghost, IA e acessos mantêm trilhas/auditoria quando previstas.
- Caches de perfil, ACL e tenant são invalidados em troca de identidade/instância.
- PWA é publicado via Cloudflare Pages; APIs Stripe executam no ambiente Cloudflare.

---

## 18. Mapa de rotas

| Rota | Uso atual |
|------|-----------|
| `/` | Login |
| `/forgot-password` | Recuperação do PIN por e-mail |
| `/register` | Cadastro inicial |
| `/selecionar-igreja` | Escolha da instância |
| `/(tabs)` / `/(tabs)/index` | Início publicado |
| `/(tabs)/dashboard` | Redirecionamento legado para tela viva |
| `/(tabs)/explore` | Congelada/não publicada |
| `/perfil` | Hub do perfil |
| `/manage-profile` | Dados cadastrais |
| `/manage-members` | Gerenciar família |
| `/lista-familias` | Lista de Famílias |
| `/membros` | Membros e visitantes |
| `/aniversariantes` | Aniversários pessoais e de casamento |
| `/ofertas` | Dízimos, ofertas, campanhas e projetos |
| `/primicias` | Compromissos em espécie |
| `/pastoral` | Cuidado Pastoral |
| `/pastoral-history` | Meus pedidos |
| `/agenda-cancelar` | Ação pública/controlada de agenda |
| `/pequeno-grupo` | Minha Célula |
| `/mural-oportunidades` | Mural de Oportunidades |
| `/mural-generosidade` | Mural de Generosidade |
| `/apoio-mutuo` | Apoio Mútuo |
| `/escalas` | Escalas do membro |
| `/financial` | Financeiro |
| `/expense-report` | Reembolsos/RD |
| `/documentos-oficiais` | Documentos oficiais |
| `/administrativo` | Administrativo |
| `/mapa-geolocalizacao` | Mapa |
| `/visitantes-cadastro-rapido` | Cadastro Rápido e QR do visitante |
| `/cracha-visitante` | Crachá/QR público do visitante |
| `/trilha-discipulado` | Trilha |
| `/livros-doados` | Acervo |
| `/suggestions-improvements` | Sugestões |
| `/como-faco` | Ajuda |
| `/conhecimento` | Base de conhecimento |
| `/redes-sociais` | Redes oficiais |
| `/sobre-conecta` | Sobre o produto |
| `/maintenance-dashboard` | Painéis de manutenção |
| `/atribuicoes` | Atribuições operacionais |
| `/configuracao-salas` | Configuração de salas |
| `/totem-checkin` | Totem e leitura de QR |
| `/autorizacao-midia` | Autorização de imagem e voz |
| `/billing` | Assinaturas/Stripe |
| `/igrejas` | Instâncias |
| `/alianca-conecta-reino` | Aliança |
| `/alianca-indicados` | Indicados |
| `/cadastro-familia` | Formulário público familiar |
| `/lgpd` | Consentimento LGPD |
| `/sessao-encerrada` | Encerramento de sessão |
| `/admin/orquestrador` | Orquestração administrativa autorizada |

---

## 19. Resumo por público

| Público | Principais funcionalidades |
|---------|---------------------------|
| **Visitante** | Primeiro acesso, cadastro, eventos permitidos, cuidado pastoral e acolhimento |
| **Membro / congregado** | Início, Perfil, família, contribuições, documentos, células, escalas, murais, Apoio Mútuo, pastoral, financeiro e ajuda conforme ACL |
| **Família** | Integrantes, agenda, audiência, QR, Espaço Infantil, dados de cuidado e celebrações |
| **Recepção / secretaria** | Cadastro Rápido, Recepção Familiar, novos cadastros, régua, diretórios, eventos, salas, avisos e escalas conforme grants |
| **Voluntário / líder** | Escalas, oportunidades, pequenos grupos e módulos delegados |
| **Equipe pastoral** | Cuidados Pastorais, Mudança de Papéis, Atribuições, acolhimento e alertas |
| **Tesouraria** | Informações financeiras, campanhas, Prímicias, RD e conciliação |
| **Gestor em Controle de Acesso** | Gestão delegada de papéis/grants, sem qualquer visibilidade de Super Administrador ou PIN |
| **Super Administrador** | Instâncias, billing, Gestão Liberada, ACL, LGPD, Ghost, Acessos de Usuários, IA, Aliança e configurações críticas |
| **Totem / Espaço Infantil** | QR de presença, entrada e retirada no tenant selecionado |

---

*Documento funcional do Conecta+ gerado a partir da experiência publicada e do código-fonte em 05/10/2026. Para visão técnica e procedimentos de entrega, consulte [`MANUAL_ENTREGA.md`](MANUAL_ENTREGA.md) e [`INDICE_DOCUMENTACAO.md`](INDICE_DOCUMENTACAO.md).*


---

# Parte 2 — Manual de Treinamento (Mão na Massa)

---

# Manual de Treinamento — Conecta+

Treinamento prático em missões para membros, famílias, voluntários e equipes. Execute cada missão no ambiente da sua igreja.

**Atualizado em:** 05/10/2026
**Navegação publicada:** **Início + menu lateral + Eu quero… + Perfil + engrenagem**. Não use o antigo carrossel do Painel como roteiro.

---

## Antes de começar

- Confira nome/logo da igreja ativa.
- Tenha acesso ao e-mail cadastrado: primeiro PIN e recuperação são enviados por e-mail.
- Itens variam por papel e ACL; não ver uma opção pode ser comportamento correto.
- Em aparelho compartilhado, encerre a sessão ao terminar.

---

## Missão 1 — Entrar pela primeira vez

**Caminho:** Boas-vindas → celular → Continuar → Receber código por e-mail → PIN.

1. Digite o celular com DDD.
2. Toque em **Continuar**.
3. Se ainda não possui PIN, solicite o código por e-mail.
4. Confira caixa de entrada, spam e promoções.
5. Digite os quatro dígitos.
6. Se o usuário participa de várias igrejas, selecione a instância correta.

**Validação:** o app abre cadastro, LGPD ou Início conforme o estado do perfil. WhatsApp não entrega PIN.

---

## Missão 2 — Concluir cadastro e LGPD

**Caminho:** onboarding → Cadastro/LGPD.

1. Confira telefone, nome e nascimento.
2. Informe CEP e dados solicitados.
3. Com LGPD ativo, leia o texto da igreja até o fim.
4. Registre aceite/recusa e selfie quando exigido.
5. Confirme o cadastro.
6. Depois, abra **Menu → Perfil → Dados Cadastrais** e revise contato/endereço.

Com LGPD inativo, o fluxo é simplificado. A configuração vale por igreja.

---

## Missão 3 — Reconhecer a navegação

No **Início**, identifique:

- Próximos Eventos e avisos;
- bolo de aniversários, quando houver celebração no dia;
- faixa **Eu quero…**;
- Abigail, quando autorizada;
- sticker amarelo de novos registros, apenas para equipe autorizada.

Abra o **menu lateral** e localize Perfil, Financeiro, Documentos oficiais, Minha Célula, Escalas, murais, Apoio Mútuo, Sugestões, ajuda, redes e Sobre. Abra e feche sem alterar dados.

Se houver autorização, abra a **engrenagem** e reconheça os grupos, sem executar ações destrutivas.

---

## Missão 4 — Agenda da Família

**Caminho:** Início → tocar em evento → Agenda da Família.

1. Escolha evento publicado.
2. Confira data, horário, local e vagas.
3. Marque os integrantes em **Audiência**.
4. Adicione o compromisso ao calendário quando disponível.
5. Em evento com Espaço Infantil, abra o QR de entrada/saída.
6. Em evento de quórum/totem, apresente o QR conforme orientação.

**Resultado:** inscrições são atualizadas. Geofence, quando configurado e autorizado, pode confirmar presença dentro da janela e do raio.

---

## Missão 5 — Contribuir

**Caminho:** Início → Eu quero… → Contribuir.

1. Escolha Dízimos e Ofertas, Campanhas e Projetos ou Primícias.
2. Confira recebedor e igreja.
3. Informe valor/item quando solicitado.
4. Copie a chave PIX ou instrução identificada.
5. Conclua no banco.

O Conecta+ não debita automaticamente a conta.

---

## Missão 6 — Cuidado Pastoral

**Caminho:** Início → Eu quero… → Cuidado Pastoral.

1. Escolha motivo, situação, beneficiário e destino.
2. Escreva o pedido sem dados desnecessários.
3. Envie e abra **Meus pedidos**.
4. Em pedido novo, use Excluir se disponível.
5. Se o acompanhamento já começou, use **Solicitar cancelamento**, justifique e aguarde análise.

A exclusão final de pedido acompanhado é confirmada por Super Administrador no painel pastoral.

---

## Missão 7 — Perfil e família

**Caminho:** Menu → Perfil.

Pratique:

1. **Dados Cadastrais:** revisar endereço, e-mail e PIN.
2. **Gerenciar Família:** conferir integrantes, parentescos e código familiar.
3. **Carteirinha Digital:** abrir QR permanente.
4. **Ofereço meus Serviços:** conhecer a publicação no Apoio Mútuo.
5. **Trilha de Discipulado:** abrir progresso e conquistas.
6. **Reembolsos:** iniciar um RD somente se houver despesa real e autorização.

Não remova representante legal nem transfira pessoa entre famílias como teste.

---

## Missão 8 — Menu do membro

Abra, conforme sua permissão:

- **Documentos oficiais:** consultar documento publicado;
- **Apoio Mútuo:** categoria → pessoa → cartão;
- **Minha Célula:** conferir vínculo;
- **Escalas:** conferir datas e equipe;
- **Murais:** ler oportunidade/doação;
- **Como faço…?:** localizar artigo de ajuda.

A ausência de conteúdo pode significar que a igreja ainda não publicou registros.

---

## Missão 9 — Espaço Infantil

### Família
1. Inscreva a criança na Agenda.
2. Abra o QR familiar.
3. Apresente na entrada.
4. Na retirada, apresente novamente.
5. Confira estado **Na sala** ou **Liberado**.

### Equipe
1. Abra **Engrenagem → Culto e Eventos → Sala(s) - Check In**.
2. Selecione evento/sala.
3. Leia o QR e confirme identidade da família/criança.
4. Registre entrada.
5. Na retirada, valide o vínculo e registre saída.

Confira alertas alimentares, necessidades específicas e observações sem expor dados a pessoas não autorizadas.

---

## Missão 10 — Recepção e acolhimento (equipe)

1. Abra **Recepção Familiar**.
2. Em **Novos Membros**, selecione pessoa já cadastrada.
3. Confira `family_id` e celular pré-preenchido no convite.
4. Na fila, revise telefone, nascimento, CEP, família e conflitos.
5. Processe somente lote válido.
6. Abra a inbox de novos cadastros e marque o item tratado.
7. Na Régua, confirme que apenas visitante efetivo recebeu D+1/D+4/D+8.
8. Observe o sticker: Recepção tem prioridade; depois, Mudança Papéis filtrada em Visitante.

Não use a régua para membro ou congregado.

---

## Missão 11 — Escalas (líder)

**Caminho:** Engrenagem → Culto e Eventos.

1. Em **Tipos de Escala**, configure vagas e modo individual/equipe.
2. Em **Servos em Disponibilidade**, associe voluntários e ordem.
3. Em **Programação de Escalas**, gere prévia.
4. Confira datas, vagas e duplicidades.
5. Aplique o bloco apenas depois da revisão.
6. Valide em **Menu → Escalas** com um usuário autorizado.

---

## Missão 12 — Governança (administrador)

1. Confirme igreja ativa.
2. Abra **Controle de Acesso** e reconheça App Ativo, Gestão Liberada e LGPD.
3. Revise papéis e grants sem usar PIN/senha como dado administrativo.
4. Teste **Modo Ghost** com perfil de teste: iniciar leva ao Início uma vez; depois a navegação permanece na rota escolhida.
5. Encerre Ghost e confirme retorno à identidade real.
6. Confira **Assinaturas**; Gestão Liberada remove o paywall, mas não concede ACL.

Gestor de Controle de Acesso nunca pode ver Super Administrador, seus logs ou credenciais.

---

## Missão 13 — Encerrar sessão

1. Abra o menu.
2. Toque em **Encerrar sessão/Sair do aplicativo**.
3. Confirme retorno à tela de login ou site configurado pela igreja.
4. Em totem/aparelho compartilhado, verifique que a sessão anterior não é restaurada.

---

## Checklist final

- [ ] Entrei com PIN recebido por e-mail.
- [ ] Confirmei a igreja ativa.
- [ ] Concluí cadastro/LGPD conforme configuração.
- [ ] Usei Início, menu, Eu quero… e Perfil.
- [ ] Abri evento e marquei audiência.
- [ ] Entendi QR/totem/geofence e Espaço Infantil.
- [ ] Sei abrir e acompanhar Cuidado Pastoral.
- [ ] Sei onde ficam documentos, escalas e Apoio Mútuo.
- [ ] Equipe: revisei Recepção, inbox, régua e sticker.
- [ ] Administração: entendi ACL, Ghost, billing e Gestão Liberada.
- [ ] Encerrei sessão com segurança.

---

## Solução rápida de problemas

| Situação | Ação |
|---|---|
| PIN não chegou | Conferir e-mail/spam e endereço cadastrado |
| Item não aparece | Conferir papel/grant; sair e entrar após mudança |
| Evento não aparece | Confirmar publicação, período e tenant |
| QR não confirma | Conferir audiência, evento, família e fluxo do totem |
| Criança não aparece | Conferir parentesco, evento, sala e inscrição |
| Régua nasceu para membro | Interromper e revisar papéis/patch do visitante efetivo |
| Ghost volta ao Início | Reportar regressão; só entrada/saída devem redirecionar automaticamente |
| Cobrança bloqueia | Conferir assinatura, instância ativa e Gestão Liberada |

*Conecta+ · Manual de Treinamento · revisão de 05/10/2026.*


---

# Parte 3 — Perguntas e Respostas (FAQ)

---

# Perguntas e Respostas — Conecta+

FAQ do ambiente publicado para membros, famílias e equipes de gestão.

**Atualizado em:** 05/10/2026

Documentação relacionada: [Manual do membro](MANUAL_DASHBOARD_MEMBRO.md) · [Manual da engrenagem](MANUAL_DASHBOARD_MANUTENCAO.md)

---

## Navegação atual

### O Conecta+ ainda usa o Painel antigo em carrossel?

Não como caminho publicado. A experiência atual é:

- **Início** para eventos, avisos, aniversários do dia, Abigail e ações rápidas;
- **menu lateral** para módulos permanentes;
- **Eu quero…** para ações como Contribuir e Cuidado Pastoral;
- **Perfil** para dados, família, Carteirinha Digital e jornada pessoal;
- **engrenagem** para gestão autorizada.

Os cards do carrossel antigo estão congelados. Links antigos, quando suportados, redirecionam para a rota dedicada correspondente.

### Como abro a Agenda da Família?

No **Início**, toque no culto em **Próximos Eventos**.

### Onde ficam ofertas e cuidado pastoral?

- **Início → Eu quero… → Contribuir**
- **Início → Eu quero… → Cuidado Pastoral**

### Onde ficam meus dados e o QR permanente?

Abra **Menu → Perfil**. A **Carteirinha Digital** aparece logo abaixo de **Gerenciar Família**.

### O que encontro em cada item do menu lateral?

- **Início:** eventos, avisos, bolo, Abigail e atalhos;
- **Perfil:** dados, família, Carteirinha, Trilha, serviços e reembolsos permitidos;
- **Financeiro:** informações financeiras autorizadas;
- **Documentos oficiais:** arquivos institucionais publicados;
- **Minha Célula:** dados do pequeno grupo;
- **Escalas:** programação pessoal de serviço;
- **Mural de Oportunidades:** oportunidades de voluntariado;
- **Mural de Generosidade:** doações e pedidos moderados;
- **Apoio Mútuo:** serviços oferecidos pela comunidade;
- **Sugestões, Como faço…?, Redes Sociais e Sobre:** comunicação e ajuda.

### Por que não vejo uma opção?

Os itens respeitam papel e ACL. Se sua função mudou, saia e entre novamente. Se continuar ausente, peça ao responsável pelo Controle de Acesso que confira o grant.

Antes de solicitar suporte, informe a igreja ativa, o nome exato da opção ausente e se você já encerrou e iniciou a sessão novamente. Não envie PIN.

---

## Login, PIN e e-mail

### Como entro pela primeira vez?

Informe o celular, toque em **Continuar** e solicite **Receber código por e-mail**. Digite o PIN temporário de quatro dígitos enviado.

### O PIN chega por WhatsApp?

Não. O primeiro PIN e o PIN de recuperação são enviados por **e-mail**. WhatsApp pode ser usado em convites, contatos e avisos, mas não no fluxo de autenticação.

### Esqueci minha senha. O que faço?

1. Informe o celular.
2. Toque em **Continuar**.
3. No passo do PIN, toque em **Esqueci minha senha**.
4. Confirme o e-mail e responda à pergunta de segurança, quando solicitada.
5. Use o novo PIN recebido por e-mail.

### O botão “Esqueci minha senha” não aparece.

Ele aparece no segundo passo, depois que o celular foi informado.

### O código não chegou.

Confira:

1. se o e-mail está correto;
2. spam, lixo eletrônico e abas de promoções;
3. se a caixa está cheia;
4. se a equipe configurou corretamente o remetente de e-mail da instância.

### Posso usar o mesmo celular em mais de uma igreja?

Sim. A mesma pessoa ou aparelho pode estar associado a mais de uma instância. O app usa a igreja ativa escolhida pelo link, QR ou seleção de instância. Confira sempre o nome/logo antes de operar.

---

## Cadastro, família e LGPD

### Por que preciso rolar o texto LGPD?

Quando o módulo está ativo, o app exige leitura até o fim antes do reconhecimento.

### O texto LGPD é igual em todas as igrejas?

Não necessariamente. O Super Admin pode manter o **Texto de consentimento LGPD por instância** em **Engrenagem → Controle de Acesso**.

### O que muda quando LGPD está inativo?

O cadastro fica simplificado e não exige a tela formal de consentimento nem selfie obrigatória daquele fluxo. A decisão vale para a igreja ativa.

### Como adiciono uma criança sem celular?

Abra **Menu → Perfil → Gerenciar Família → Adicionar integrante**. A criança pode participar da Agenda e do Espaço Infantil sem possuir login próprio.

Antes de salvar, informe nome completo, nascimento e parentesco. Se a criança já aparecer em outra família, não crie duplicidade: peça à Recepção Familiar ou à secretaria para revisar o vínculo.

### Onde encontro o QR da família?

Em **Menu → Perfil → Carteirinha Digital**. Em evento com criança elegível, a Agenda também oferece **Espaço Infantil | Check-In / Check-Out QR**.

---

## Início, aniversários e Abigail

### O que é o bolo ao lado de Próximos Eventos?

É o aviso de aniversário pessoal ou de casamento do dia. Toque para ver os nomes e, quando autorizado, copiar a mensagem sugerida.

### O bolo não aparece.

Ele só aparece quando existe aniversário do dia nos dados permitidos ao seu perfil.

### O que é a Abigail?

É a assistente do Conecta+. Para perfis autorizados, fica no Início, ao lado de **Eu quero…**. Ela responde com base no contexto da igreja ativa e nas permissões disponíveis.

### A Abigail substitui atendimento pastoral?

Não. Ela ajuda com informações e organização. Emergências, aconselhamento e decisões sensíveis devem seguir os canais humanos apropriados.

---

## Agenda e Espaço Infantil

### Como inscrevo minha família em um culto?

Abra **Início → toque no culto → Agenda da Família** e marque os integrantes em **Audiência**.

### Como faço check-in da criança?

1. Abra a Agenda do evento.
2. Marque a criança.
3. Toque em **Espaço Infantil | Check-In / Check-Out QR**.
4. Apresente o QR na recepção da sala.
5. A equipe lê o código para registrar entrada e, depois, saída.

### O botão do Espaço Infantil não aparece.

Ele depende de criança elegível na família, sala ativa no evento e configuração do culto. Confira também se existe código familiar.

### O que significam “Na sala” e “Liberado”?

- **Na sala:** a equipe confirmou a entrada.
- **Liberado:** a equipe registrou a retirada/saída.

### Posso usar o QR da Carteirinha?

Sim, o QR permanente da Carteirinha identifica a família e pode ser lido pelos fluxos autorizados.

---

## Cuidado Pastoral

### Como envio um pedido?

Abra **Início → Eu quero… → Cuidado Pastoral**, preencha motivo, situação, beneficiário, destino e descrição e toque em **Enviar pedido**.

### Onde acompanho?

Em **Meus pedidos**. Os estágios são **Acolher**, **Apoiar** e **Acompanhar**, além dos estados inicial e encerrado.

### Posso excluir um pedido que já está sendo acompanhado?

Não diretamente. Toque em **Solicitar cancelamento**, informe a justificativa e envie. A equipe vê a solicitação.

### Quem confirma o cancelamento?

O **super_admin** abre **Engrenagem → Cuidados Pastorais**. Quando existe uma solicitação válida, o botão **Excluir** aparece ao lado de **Acompanhar**. O Super Admin lê a justificativa e confirma a exclusão.

### Por que o botão Excluir não aparece para a equipe pastoral?

Porque a confirmação destrutiva é reservada ao **super_admin** e só aparece quando o membro solicitou cancelamento.

### Um pedido novo pode ser apagado?

Pode haver exclusão direta antes do início do cuidado, conforme a regra atual. Depois que o acompanhamento começa, use **Solicitar cancelamento**.

---

## Documentos oficiais

### Onde vejo documentos da igreja?

Em **Menu → Documentos oficiais**.

### A tela está vazia.

A igreja pode ainda não ter publicado documentos, ou seu papel pode não ter acesso.

### Os documentos são da igreja ativa?

Sim. Confirme a instância antes de consultar ou compartilhar.

---

## Apoio Mútuo

### O que é?

É a vitrine de serviços oferecidos por pessoas da comunidade da igreja.

### Como encontro um serviço?

Abra **Menu → Apoio Mútuo**, pesquise, abra o cartão e use os contatos permitidos.

### Como ofereço meu serviço?

Abra **Menu → Perfil → Ofereço meus Serviços**, preencha o cartão, ative **Publicar no Apoio Mútuo** e salve.

Depois, abra **Menu → Apoio Mútuo**, pesquise seu cartão e confira descrição e contato. Se não aparecer, volte ao Perfil, confirme que a publicação está ativa e salve novamente.

### O Conecta+ garante o serviço?

Não. Valor, prazo, qualidade, contratação e responsabilidade são combinados diretamente entre as pessoas.

---

## Recepção e novos membros

### O que é o sticker amarelo de Novos Membros?

É uma etiqueta retrátil na lateral do Início para avisar que há novos registros aguardando admissão.

### Para quem o sticker aparece?

- **super_admin:** sempre; quando não há pendências, mostra “Não há pendências de novos registros”;
- **secretaria/pastoral:** somente quando há pendência;
- demais perfis: não aparece, salvo regra expressamente concedida.

### Para onde o sticker leva?

- Se existe pendência na **Recepção Familiar**, essa fila tem prioridade.
- Caso contrário, se há novo visitante, abre **Mudança Papéis** já filtrada em **Visitante**.

### O que é Recepção Familiar?

É o módulo que envia convite familiar e processa formulários públicos antes de criar/atualizar perfis e membros.

### Como usar “Novos Membros” dentro da Recepção?

1. Abra **Engrenagem → Recepção Familiar**.
2. Toque em **Novos Membros**.
3. Use a busca Enxergar.
4. Selecione um membro já cadastrado.
5. O convite levará o código da família selecionada.

### O que devo revisar na fila?

Nome, telefone, CEP, nascimento, integrantes, duplicidades e conflitos de código familiar. Registros com data provisória, CEP ausente ou conflito devem ser corrigidos antes da gravação.

### O que é a Régua de Acolhimento?

É o acompanhamento posterior da recepção com etapas como D+1, D+4 e D+8.

### Posso colocar membros na Régua?

Não. A Régua é somente para **visitante**. Ao mudar para congregado ou membro, encerre o acompanhamento de visitante.

---

## Busca Enxergar

### O que é Enxergar?

É o padrão em que a lista filtrada abre em um modal no topo enquanto você digita. Isso facilita ver e escolher resultados em telas pequenas.

### Enxergar muda a forma de pesquisar?

Não. O critério continua sendo o da tela — nome, telefone, código e quantidade mínima de letras. Muda apenas a apresentação da lista filtrada.

### Onde ele aparece?

Entre outros pontos, em seleções de pessoas no Controle de Acesso, Mudança Papéis, Atribuições, Recepção Familiar e Acesso Usuários.

---

## Controle de Acesso e Gestão Liberada

### O que significa App Ativo?

Controla a disponibilidade geral da aplicação na instância. Se ficar inativo, a mensagem de indisponibilidade configurada é exibida.

### O que significa Gestão Liberada?

Com **Gestão Liberada**, o paywall comercial é desligado para toda a instância e a operação não exige uma assinatura Stripe ativa.

### Gestão Liberada dá acesso a todos os módulos?

Não. Ela remove o bloqueio comercial, mas não altera papéis, grants ou ACL.

### Qual é a diferença entre App Ativo, Gestão Liberada e LGPD Ativo?

| Controle | O que altera | O que não altera |
|---|---|---|
| **App Ativo** | Disponibilidade geral da aplicação na igreja | Papéis individuais |
| **Gestão Liberada** | Exigência comercial/paywall da instância | Grants e permissões |
| **LGPD Ativo** | Fluxo formal de consentimento no cadastro | Assinatura e acesso administrativo |

Antes de mudar qualquer switch, confirme a igreja ativa e o impacto para toda a instância.

### Quem altera Gestão Liberada?

O controle fica no cabeçalho de **Engrenagem → Controle de Acesso** para o perfil autorizado.

### Quem pode ver Acesso Usuários?

Somente **super_admin**. O Gestor de Controle de Acesso não deve ver perfil, ações, logs ou credenciais do Super Administrador.

---

## Modo Ghost

### O que é?

É a simulação do app usando a identidade efetiva de outro perfil para auditoria.

### Por que o Ghost não deve voltar ao Início ao abrir uma rota?

Porque a finalidade é testar a navegação real do alvo. Depois de iniciado, o Ghost deve entrar e permanecer na rota escolhida, inclusive quando a ACL do alvo não possui grant.

### Quando o Ghost pode ir automaticamente ao Início?

Somente:

1. ao iniciar, uma vez, já como o alvo;
2. ao encerrar, de volta à identidade real.

Também pode ocorrer quando o operador toca explicitamente em Fechar, Voltar ao Início ou Sair do Ghost.

### O Super Admin real fura as permissões do alvo?

Não. O bypass do operador fica desligado para telas e dados durante a simulação.

### O Ghost usa a assinatura do alvo?

Não. Paywall, instância e cobrança continuam vinculados ao operador e à igreja ativa.

---

## Totem e múltiplas igrejas

### O mesmo celular pode ser totem em mais de uma igreja?

Sim. O mesmo número pode estar cadastrado em várias instâncias. A sessão deve entrar pela igreja correta, determinada pelo QR, link ou seleção ativa.

### Como evitar check-in na igreja errada?

1. Abra o QR/link da instância correta.
2. Confira nome e identidade visual.
3. Entre com o celular e o PIN do totem.
4. Confirme o evento mostrado antes de iniciar a leitura.
5. Encerre a sessão ao terminar.

### O totem diz “Pré-check-in não encontrado”.

A família precisa marcar audiência no evento correto antes da leitura, salvo fluxo específico do Espaço Infantil/visitante.

### A câmera não funciona.

No navegador, use HTTPS e permita câmera. Feche outras aplicações que possam estar usando o sensor.

---

## Eventos, escalas e financeiro

### Evento rascunho aparece no Início?

Não. Somente evento publicado.

### Como replico o culto?

Na Programação de Eventos, abra um evento existente e use a ação de replicar em +7 dias, quando disponível. Revise antes de publicar.

### Onde o membro vê escalas?

Em **Menu → Escalas**. A equipe programa na engrenagem.

### Como peço reembolso?

Abra **Menu → Perfil → Reembolsos**, crie um RD, informe chave PIX, itens e comprovantes e finalize.

### O PIX no Conecta+ debita minha conta?

Não. O app apresenta os dados; a confirmação financeira ocorre no aplicativo do banco ou no fluxo do provedor exibido.

---

## Segurança e solução de problemas

### Mudaram meu papel, mas a tela não apareceu.

Saia e entre novamente para recarregar a sessão e a ACL.

### A tela abriu vazia.

Confirme:

1. igreja ativa;
2. acesso do papel;
3. existência de registros naquela instância;
4. conexão com a internet.

Depois, retire filtros muito restritivos, recarregue uma vez e refaça o login. Ao pedir suporte, informe tela, horário, filtro utilizado e mensagem exibida; não envie PIN, chave Gemini nem dados bancários.

### Posso compartilhar dados do diretório?

Somente dentro da finalidade autorizada pela igreja e pela política de privacidade.

### O app substitui serviços de emergência?

Não. Em risco imediato, use SAMU 192, Polícia 190, Bombeiros 193 ou o serviço local apropriado.

### Como saio com segurança?

Abra o menu e toque em **Encerrar sessão/Sair do aplicativo**, especialmente em aparelho compartilhado, totem ou computador público.

---

*Conecta+ · FAQ · revisão de 05/10/2026*

