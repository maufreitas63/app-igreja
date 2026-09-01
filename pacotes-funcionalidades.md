# Pacotes de funcionalidades — Conecta+

**Data:** 1º de setembro de 2026  
**Papel deste documento:** recorte comercial e arquitetural do que o código **já entrega** hoje, dividido em três pacotes pela **quantidade de facilidades** (não por esforço de desenvolvimento nem por telas congeladas).

**Fonte:** menus publicados (lateral do membro, **Eu quero…**, engrenagem de manutenção), rotas vivas em `app/` e painéis da manutenção. O carrossel antigo do Painel e os cards congelados (QR, Salas no carrossel, Estacionamento, escala avulsa no dashboard) **não entram** nestes pacotes: não são produto publicado.

**Leitura dos pacotes:** cada pacote **inclui o anterior**. Padrão = Básico + o que está listado em Padrão. Avançado = Padrão + o que está listado em Avançado.

---

## Critério de corte

| Pacote | Critério | Ideia de uso |
| --- | --- | --- |
| **Básico** | Sem isto o sistema não “abre a igreja”: identidade, família, culto do dia, contribuição e cuidado mínimo. | Igreja pequena, operação enxuta, poucos papéis. |
| **Padrão** | Básico **mais** automações de rotina, relatórios de gestão e integrações intermediárias (Pix identificado, WhatsApp, totem, CEP, câmera). | Secretaria, tesouraria e pastoral no dia a dia. |
| **Avançado** | Padrão **mais** múltiplos perfis de acesso, governança de TI, inteligência operacional e rede multi-igreja. | Rede, auditoria, predição, assinatura SaaS e régua de acolhimento. |

Itens com *“em breve”* no hub financeiro do membro (fluxo de caixa, categorias, relatórios daquele hub) **não** estão nos pacotes: o código marca `coming_soon` e não há entrega.

---

## Pacote Básico

Facilidades **centrais e indispensáveis** para o aplicativo funcionar como igreja digital.

### 1. Entrada, instância e sessão

- Seleção da **igreja (instância)** no login (`?igreja=` / código do tenant).
- Login por **celular + PIN** de 4 dígitos.
- **Primeiro acesso e recuperação de PIN por e-mail** (WhatsApp não entra neste fluxo).
- Restauração de sessão ao reabrir; **sair / encerrar sessão**.
- Parâmetro **Aplicativo ativo / inativo** (bloqueio global com mensagem).
- PWA web (deploy em produção) com identidade visual da instância.

### 2. Cadastro e identidade

- Cadastro inicial (nome, nascimento, telefone, CEP).
- Parâmetro **LGPD ativo**: termos com rolagem obrigatória, selfie e tela de declaração; com LGPD inativo, fluxo simplificado.
- **Perfil** do membro: carteirinha digital, dados cadastrais (nome, documentos, contato, endereço).
- Preenchimento de endereço por **CEP**.
- **Gerenciar família**: integrantes, parentesco, representante legal, código familiar.

### 3. Culto do dia (membro)

- **Início**: caixa de avisos e eventos publicados.
- **Agenda da família** no evento: inscrição da família no culto.
- Check-in da família no fluxo da agenda (presença no evento do dia).
- Pedido de **oração / cuidado pastoral** (“Eu quero… → Fazer um pedido de Oração”).

### 4. Contribuição mínima

- **Dízimos e ofertas**: informar valor (com centavos) e **copiar Pix** da igreja.

### 5. Navegação e segurança mínima

- Menu do membro (Início, Perfil, Sobre o Conecta+, Redes sociais).
- **Sobre o Conecta+** (versão, declaração de privacidade).
- **Redes sociais** da instância (links oficiais).
- Controle de acesso **fail-closed**: tela sem grant não abre.
- Três papéis de chão: **Visitantes**, **Congregado**, **Membro** (o suficiente para distinguir quem ainda não é membro, quem congrega e quem é membro).

### 6. Manutenção mínima (para o sistema “rodar”)

- Cadastro de **usuário** (ficha operacional).
- **Programação de eventos** (criar/publicar o culto que alimenta o Início).
- **Manutenção de avisos** (comunicados da home).
- Ligar/desligar **LGPD** e **App ativo** (já na governança mínima do painel).

**Fora do Básico (de propósito):** escalas, célula, murais, tesouraria analítica, totem, mapa, livros, múltiplos papéis de staff, Ghost, preditivo, billing, régua D+1/D+4/D+8.

---

## Pacote Padrão

Tudo do **Básico**, mais automações de rotina, relatórios e integrações intermediárias.

### 1. Automações da rotina do membro

- **Minha Célula** (pequeno grupo do membro).
- **Escalas**: consulta da escala; troca/disponibilidade de servo (incluindo avisos de permuta na home).
- **Mural de Oportunidades** (voluntariado) e avisos de vaga na home.
- **Mural de Generosidade** (doações e empréstimos entre irmãos) e avisos na home.
- **Trilha de Discipulado** (passos, lições, progresso, selos; perfil ministerial na lição de dons).
- **Aniversariantes** (lista + atalho de WhatsApp no mesmo padrão de click-to-chat).
- **Lista de membros** (diretório).
- **Reembolsos (RD)** pelo perfil, quando o papel tiver grant.
- **Cantinho da Leitura**: livros retirados pelo membro; avisos de empréstimo na home.
- **Financeiro do membro**: prestação de contas (resultado, comparativo, 12 meses, orçamento, saldo) — leitura da transparência, não a tesouraria de lançamento.

### 2. Automações e operação de secretaria / culto

- **Gestão de Pequenos Grupos** (anfitrião, líder, participantes; um grupo por pessoa na instância).
- **Tipos de escala**, **Servos em disponibilidade**, **Programação de escalas**.
- **Configuração de salas** (nomes afetivos e atribuição).
- **Sala(s) — Check-in** (operação de sala no culto).
- **Presença / quórum** (lista de presença; eventos estatutários).
- **Cronograma de eventos** (visão Gantt).
- **Orquestrador** (painel de avisos em tela cheia).
- **Totem de check-in** (leitor no hall, sessão dedicada).
- **Cuidado pastoral** (fila e slots da equipe, não só o pedido do membro).
- **Mural de Voluntários** (gestão das oportunidades).
- **Moderação do Mural** de generosidade.
- **Autorização de imagem e voz** (termo LGPD + confirmação).
- **Administrativo** (atos constitutivos / atas).
- **Livros doados**: acervo, empréstimos e histórico (busca ISBN e cadastro manual).
- **Mapa de geolocalização** (pins das famílias).
- **Sugestões e melhorias** (abertura pelo membro e tratamento na manutenção).

### 3. Pessoas e acolhimento (sem a régua inteligente)

- **Recepção Familiar**: fila de formulários públicos `/cadastro-familia`, conferência, gravação ou rejeição.
- Convite **WhatsApp** da recepção (nome + celular com DDD; conversa mesmo fora da agenda).
- Formulário público de cadastro familiar (página standalone, fora do PWA).
- Check-in **automático por geofence** quando o evento estiver configurado (integração de localização).
- Desbloqueio de sessão por **biometria** (quando o aparelho oferecer).

### 4. Relatórios (catálogo da manutenção)

- Membros ativos/inativos, congregados e tempo de congregação.
- Ativos por faixa etária (com gráfico).
- Necessidades pastorais (semestre).
- Saúde e alertas vitais do ministério infantil (restrito / LGPD).
- Quórum oficial para assembleias.
- Estimativa de estacionamento por evento (cruza inscrição × veículos da família).
- Fichas de sugestões e melhorias (com PDF).
- Inscritos por evento.

### 5. Tesouraria operacional (não a inteligência)

- **Informações financeiras** na manutenção: lançamentos, RD, orçamento, extratos.
- **Gestão de campanhas** (projetos com Pix identificado; o membro contribui pelo “Eu quero…”).
- Papel **Tesoureiro** (escrita financeira, distinto da leitura do membro).

### 6. Papéis intermediários

Além de Visitantes / Congregado / Membro:

- **Secretaria** (operação: eventos, escalas, salas, totem, recepção, avisos, murais, campanhas — sem tesouraria global nem cuidado pastoral pleno).
- **Tesoureiro**.
- **Equipe Pastoral**.

Integrações deste pacote: **Pix (copia-e-cola)**, **WhatsApp (wa.me)**, **e-mail (PIN)**, **CEP**, **câmera (totem/selfie)**, **ISBN**, **mapa**.

---

## Pacote Avançado

Tudo do **Padrão**, mais recursos complexos, **múltiplos perfis de acesso** e **inteligência operacional**.

### 1. Múltiplos perfis e governança de acesso

- Matriz completa de **Controle de Acesso** (telas, tabelas, colunas; visão por papel e por recurso).
- Aba **Pessoas**: relatório de quem está em cada papel (blocos expansíveis; Gestor sem ver Super Administrador).
- Papéis **Gestor em Controle de Acesso** e **Super administrador**.
- Blindagem: Gestor não lista, vê nem edita Super Administrador, PIN ou senha.
- **Mudança de papéis** (fluxo pastoral/governança de membresia).
- **Transferência de membro** entre igrejas da rede.
- **Acessos de usuários** (histórico de telas visitadas / insights de sessão).
- **Modo Ghost (Auditor)**: operar com a identidade efetiva do alvo (listas, permissões e família do perfil visitado).
- Parâmetros finos de operação (QR, geofence, raios, tempos de check-in) além de LGPD/App ativo.

### 2. Inteligência operacional

- **Régua de Acolhimento** após a Recepção Familiar: jornada D+1 (WhatsApp), D+4 (célula), D+8 (culto), quadro de andamento e conclusão de passos.
- **Modelo preditivo** (painel de inteligência / finanças preditivas).
- Relatórios e resumos analíticos financeiros avançados (resultado, comparativo, 12 meses, orçamento, saldo bancário, sumário analítico) no mesmo hub, com recorte de **igreja-mãe / aliança** quando couber.
- Alertas e reconhecimentos da **Trilha** (alunos prontos para certificado) e **reset** de trilha por igreja.
- **Temas da Trilha** (conteúdo: textos, vídeos, reflexões) como curadoria institucional.

### 3. Rede, comercial e multi-igreja

- **Instâncias (Igrejas)**: criar e alternar ambientes.
- **Aliança Conecta Reino**: indicações, passivo de 40%, baixa manual de ofertas, painel da igreja-mãe.
- **Assinaturas**: planos, capacidade de usuários, checkout **Stripe**, portal de cobrança da igreja.
- Isolamento por `tenant_id` em RPCs/listagens (cada igreja só vê os seus dados).

### 4. Operação de alta complexidade (já no código, acima do “padrão de secretaria”)

- Liderança de escala **por tipo** no perfil (além do papel Secretaria).
- Eventos com **somente membros**, **totem**, **geofence**, **capacidade**, **quórum** e salas habilitadas por evento.
- Orquestração de comunicados na home (pastorais, campanhas, oportunidades, generosidade, livros, permuta de escala) como canal único de “caixa de entrada”.

---

## Mapa rápido: facilidade → pacote

A coluna indica o **pacote mínimo** em que a facilidade entra. Pacotes superiores a herdam.

| Facilidade (como o usuário vê) | Pacote mínimo |
| --- | --- |
| Login, PIN, e-mail de acesso, sessão, instância | Básico |
| Cadastro, LGPD, selfie, CEP | Básico |
| Perfil, dados cadastrais, família, carteirinha | Básico |
| Início (avisos/eventos) e agenda da família | Básico |
| Pedido de oração | Básico |
| Dízimos e ofertas (Pix) | Básico |
| Sobre o Conecta+ e redes sociais | Básico |
| Programação de eventos e avisos da home | Básico |
| Cadastro de usuário | Básico |
| Papéis Visitantes / Congregado / Membro | Básico |
| Célula do membro e gestão de pequenos grupos | Padrão |
| Escalas (consulta, tipos, servos, programação, permuta) | Padrão |
| Murais (oportunidades, generosidade, moderação, voluntários) | Padrão |
| Trilha de discipulado (aluno) | Padrão |
| Aniversariantes e lista de membros | Padrão |
| Reembolsos (RD) | Padrão |
| Prestação de contas (leitura financeira do membro) | Padrão |
| Campanhas e projetos (Pix identificado) | Padrão |
| Tesouraria (lançamentos / papel Tesoureiro) | Padrão |
| Relatórios da manutenção (membros, faixa etária, pastoral, saúde, quórum, estacionamento, sugestões, inscritos) | Padrão |
| Recepção Familiar + formulário público + convite WhatsApp | Padrão |
| Totem, salas, presença/quórum, Gantt, orquestrador | Padrão |
| Cuidado pastoral (fila/slots) | Padrão |
| Mapa, livros (acervo/empréstimo), autorização de mídia, administrativo | Padrão |
| Sugestões e melhorias | Padrão |
| Geofence e biometria | Padrão |
| Papéis Secretaria, Tesoureiro, Equipe Pastoral | Padrão |
| Controle de Acesso (matriz, pessoas por papel) | Avançado |
| Gestor em Controle de Acesso e Super administrador | Avançado |
| Mudança de papéis e transferência de membro | Avançado |
| Acessos de usuários e Modo Ghost | Avançado |
| Régua de Acolhimento (D+1 / D+4 / D+8) | Avançado |
| Modelo preditivo | Avançado |
| Temas, reconhecimentos e reset da Trilha | Avançado |
| Instâncias, Aliança Conecta Reino, assinaturas Stripe | Avançado |

---

## Papéis de acesso por pacote

| Papel no código | Nome | Pacote em que passa a ser “produto” |
| --- | --- | --- |
| `visitantes` | Visitantes | Básico (fallback de sessão; não se atribui na ficha) |
| `congregado` | Congregado | Básico |
| `member` | Membro | Básico |
| `secretaria` | Secretaria | Padrão |
| `tesoureiro` | Tesoureiro | Padrão |
| `pastoral` | Equipe Pastoral | Padrão |
| `family_acceptor` | Responsável familiar | *Não empacotar como facilidade autônoma:* no código atual não acrescenta capacidade além do Membro. |
| `gestor_controle_acesso` | Gestor em Controle de Acesso | Avançado |
| `super_admin` | Super administrador | Avançado |

Papéis já absorvidos no banco (`lider`, `lider_geral`, `events_admin`, `orquestrador_evento`) **não** aparecem como produto: a operação correspondente está em **Secretaria** (Padrão).

---

## Contagem orientativa de facilidades

Contagem por **capacidade de negócio** (não por arquivo). Serve só para deixar explícito o recorte “pela quantidade”:

| Pacote | Facilidades neste degrau | Acumulado |
| --- | --- | --- |
| Básico | 18 | 18 |
| Padrão | +32 | 50 |
| Avançado | +16 | 66 |

O número exato pode variar se se agrupar ou separar subtelas; o **corte qualitativo** acima é o que importa para oferta comercial.

---

## Fora destes pacotes (código presente, produto não publicado)

Não vender, não treinar, não listar como entrega:

- Carrossel antigo do Painel (`/(tabs)/dashboard` só redireciona).
- Cards congelados sem rota substituta de operação: **QR**, **Salas Kids/Teens no carrossel**, **Estacionamento**, **escala avulsa** no dashboard antigo.
- Itens `coming_soon` do hub financeiro do membro (fluxo de caixa, categorias, relatórios daquele card).

Essas peças permanecem no repositório até decisão explícita de descongelar.
