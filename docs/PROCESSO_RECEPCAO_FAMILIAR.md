# Processo de Recepção Familiar

**Documento de validação operacional**  
Fonte: comportamento implementado na aplicação (formulário público, fila da Manutenção, RPCs e telas vivas).  
Data de extração: 31 de agosto de 2026.

Este texto descreve o processo **como o sistema realmente executa hoje**. Use-o como roteiro de teste ponta a ponta. Onde o código deixa um ponto ambíguo, isso está marcado como **ponto de validação**.

---

## 1. Para que serve este processo

A Recepção Familiar é o caminho oficial para **entrar uma família nova (ou complementar uma já existente) sem gravar direto** nas tabelas finais de pessoas.

Objetivo operacional:

1. O Ministério de Acolhimento (ou a própria família) preenche um formulário **público, sem login**.
2. O envio gera um **lote pendente** (protocolo), ainda **fora** de `profiles` e `members`.
3. A Secretaria / operador autorizado **revisa** a fila na Manutenção.
4. Só então o sistema **grava** (promove) as pessoas no cadastro da igreja, com código de família (IBN).
5. A partir daí a família pode **entrar no aplicativo**, aceitar **LGPD + selfie**, marcar presença na **Agenda da Família** e ser confirmada no **totem**.

Não existe uma tela única chamada “Recepção”. É um **pipeline em etapas**, com duas entradas possíveis (formulário público e visitante de célula).

```
Formulário público /cadastro-familia/
        ou
Visitante de célula (Pequeno Grupo)
        │
        ▼
Lote PENDING  (recepcao_cadastro_familiar_lote)
        │
        ▼
Fila «Recepção — Cadastro Familiar»  (Manutenção)
        │
   ┌────┴────┐
   ▼         ▼
GRAVAR     REJEITAR
   │         │
   ▼         ▼
processed   rejected
   │
   ├─► profiles + members  (family_id / IBN)
   ├─► Régua de Acolhimento (D+1, D+4, D+8)  [se houver telefone próprio]
   └─► Login no app → LGPD/selfie → Agenda → Totem
```

---

## 2. Atores e o que cada um pode fazer

| Ator | Onde atua | Pode |
|------|-----------|------|
| Qualquer pessoa com o link | `/cadastro-familia/` | Preencher e enviar o formulário. **Não precisa de conta.** |
| Operador de Pequeno Grupo | Manutenção → Células | Enviar um visitante **para a mesma fila** (nome + celular). |
| Secretaria / Super Admin / grant do card | Manutenção → Recepção Familiar | Ver pendentes, selecionar, **Gravar** ou **Rejeitar**. |
| Super Admin | Fora do painel (poll 60 s) | Recebe alerta WhatsApp quando entram lotes novos (se configurado). |
| Equipe de boas-vindas | Manutenção → Régua de Acolhimento | Executar tarefas D+1 (WhatsApp) e D+4 (convite à célula). |
| Pastor | Régua / pastoral | Tarefa D+8 (ligação / verificação de retorno). |
| Família já promovida | App (login por celular + PIN) | LGPD, selfie, Agenda, Carteirinha Digital (QR da família). |
| Operador de totem | `/totem-checkin` | Confirmar a família no culto a partir do QR. |

**ACL da fila:** o painel **Recepção Familiar** e o **Cadastro de Usuário** compartilham o mesmo recurso `maintenance.card.profile_cadastro`. Quem vê um, em princípio vê o outro. Super Administrador sempre acessa. Papel **secretaria** inclui esse recurso e o totem.

O formulário público **não** verifica papel: qualquer um com a URL envia.

---

## 3. Etapa 1 — Formulário público (entrada principal)

### 3.1 Como abrir

- URL canônica: **`/cadastro-familia/`** (página standalone, fora do PWA).
- Título na tela: **Cadastro de Família**.
- Subtítulo: nome da entidade (`Nome_Entidade`) + «Ministério de Acolhimento».
- Se alguém cair na rota Expo `/cadastro-familia`, o app **redireciona** para o standalone.
- A rota está **liberada no gate de cobrança** (não exige assinatura para abrir o formulário).

### 3.2 Quem é o informante

A primeira pessoa do formulário é sempre o **Representante Legal**. Esse vínculo **não é escolhido** na tela: o servidor grava `Representante Legal` automaticamente.

### 3.3 Campos obrigatórios do informante

| Campo | Regra no formulário |
|-------|---------------------|
| Nome completo | Mínimo 3 caracteres (após trim). Gravado com nome formatado. |
| Data de nascimento | Formato **dd/mm/aaaa**, data calendário válida. Convertida para `yyyy-mm-dd`. |
| Celular | **11 dígitos** (DDD + número com 9). Aceita `55` na frente e descarta. Formato gravado: `(11) 98765-4321`. |
| CEP | **8 dígitos**. O navegador consulta ViaCEP e monta logradouro, bairro, cidade e UF **antes** de enviar. |
| Número do endereço | Obrigatório. |
| Complemento | Opcional. |
| Restrições alimentares / alertas | Opcional. Vai para `medical_food_alerts`. |

**Ponto de validação:** o CEP é obrigatório no formulário (Zod). No SQL de `submit_family_registration_public` o CEP **não é exigido**. Um envio que contorne o formulário poderia gravar lote sem CEP.

### 3.4 Dependentes

- Opcional. Pode enviar só o representante.
- Máximo **9 dependentes** (10 pessoas no total, incluindo o informante).
- Cada dependente: nome (≥ 3), nascimento (dd/mm/aaaa), **vínculo obrigatório**, celular opcional, restrições opcionais.
- Vínculos permitidos para dependente: **Cônjuge**, **Filho(a)**, **Pai**, **Mãe**, **Outros**.
- **Representante Legal** não aparece para dependente. Só o informante pode ter esse vínculo.
- Celular do dependente, se preenchido, segue a mesma regra de 11 dígitos.

**Ponto de validação:** não há checagem de menor de idade. Criança e adulto passam pela mesma regra.

### 3.5 O que acontece no envio (ainda sem cadastro final)

1. O browser resolve o endereço pelo CEP.
2. Chama a RPC **`submit_family_registration_public`** (anônimo).
3. O sistema **não** cria `profiles` nem `members` neste momento.
4. Cria um **lote** `pending` e uma linha por pessoa em `recepcao_cadastro_familiar`.
5. A tela de sucesso mostra:
   - mensagem de que o cadastro **aguarda análise**;
   - **protocolo** (`submission_id`);
   - `family_id` **se** já foi detectado (família existente);
   - botões para **copiar o link** do formulário e **compartilhar no WhatsApp**.

Enquanto o lote estiver `pending`, a família **não consegue** usar o app com esse cadastro (ainda não existe perfil promovido).

---

## 4. Etapa 2 — O que o servidor decide na entrada (matching)

Tudo isso ocorre **no envio**, antes da Secretaria gravar.

### 4.1 Correspondência com cadastro já existente

Regra explícita no SQL: **nunca vincular só pelo telefone**. Famílias costumam compartilhar o mesmo celular.

Para achar um `profiles` / `members` já existente:

- o **nome** precisa coincidir (sem diferenciar maiúsculas/minúsculas);
- se houver telefone na linha, ele **também** deve coincidir (formato normalizado).

Se o celular já pertence a **outra pessoa** (nome diferente):

- **não** vincula o perfil;
- **não** grava o telefone duplicado no profile (armazena `null` nesse caso).

### 4.2 Código de família (IBN) detectado

O lote tenta reutilizar um `family_id` já existente se os celulares do formulário apontam para **um único** código em `profiles`.

| Situação | Flag | Efeito na aprovação |
|----------|------|---------------------|
| Nenhum IBN encontrado | `detected_family_id` vazio | Na gravação, o sistema **reserva um IBN novo**. |
| Um único IBN | `detected_family_id` preenchido | Na gravação, **reutiliza** esse código. |
| Vários IBN distintos nos celulares/matches | `has_family_conflict = true` | A Secretaria **não consegue gravar** esse lote. Exige revisão manual (não há tela de “juntar famílias” neste fluxo). |

A tela de sucesso do formulário já pode mostrar o IBN detectado. Isso **não** significa que a família já foi aprovada — só que o sistema **reconheceu** um código.

---

## 5. Etapa 3 — Fila na Manutenção

### 5.1 Onde abrir

1. Engrenagem (Manutenção) → dashboard.
2. Card / painel **Recepção — Cadastro Familiar** (`panel=family_reception`).
3. Ajuda na tela: formulários públicos entram aqui **antes** de `profiles`/`members`; lotes com código detectado reutilizam o prefixo da entidade; conflitos exigem revisão manual.

### 5.2 O que o operador vê em cada lote

- Data/hora do envio.
- Quantidade de pessoas.
- IBN detectado (se houver).
- Sinal de **conflito de família**.
- Lista de integrantes: nome, se é informante, vínculo, telefone, nascimento, IBN da pessoa, ids de match (perfil/membro já existentes).

### 5.3 Ações da barra

| Botão | Comportamento |
|-------|----------------|
| Atualizar | Recarrega a fila (lista RPC, até 50 pendentes). |
| Selecionar todos | Marca todos os lotes visíveis. |
| Limpar | Desmarca. |
| **Gravar selecionados (N)** ou **Gravar todos pendentes** | Promove. Se nada estiver marcado, processa **todos** os pendentes. |
| Rejeitar selecionados | Só age nos marcados. Marca lote e pessoas como `rejected`. |

Lotes com **conflito** são **pulados** na gravação (contador `skipped_conflicts`). Continuam na fila até alguém tratar a causa (dados) ou rejeitar.

---

## 6. Etapa 4 — Gravar (promover) ou rejeitar

### 6.1 Gravar — o que o sistema faz, pessoa a pessoa

RPC: `process_recepcao_cadastro_familiar_batch`.

Para cada lote `pending` **sem** conflito:

1. Define o `family_id` do lote (detectado ou **novo IBN** via `reserve_next_family_id`).
2. Para cada pessoa:
   - se achou perfil/membro existente (nome + telefone) → **atualiza**;
   - senão → **cria** `profiles` e `members`.
3. Endereço do **informante** (CEP, número, complemento, logradouro, bairro, cidade, UF) é aplicado no perfil correspondente.
4. `members.accepted = true` (entra na família já aceito).
5. `profiles.is_active = false` (mesmo padrão de outros cadastros de família).
6. **Não** preenche nesta etapa: `lgpd_accepted`, selfie, CPF, e-mail, PIN.
7. Unifica `family_id` / `codigo_membro` do lote.
8. Status do lote e das pessoas: **`processed`**.

**Ponto de validação:** o login **não** consulta `is_active` nas rotas de sessão vistas. O flag existe no cadastro, mas **não bloqueia** o app por si só. Confirme na operação se “inativo” significa “ainda não membro pleno” apenas em Dados Cadastrais.

### 6.2 Rejeitar

RPC: `reject_recepcao_cadastro_familiar_batch`.

- Lote e pessoas → `rejected`.
- Motivo opcional.
- **Não** cria nem altera `profiles`/`members`.
- A família precisaria enviar de novo (novo protocolo) se o acolhimento quiser retomar.

### 6.3 Status possíveis

**Lote** (`recepcao_cadastro_familiar_lote.status`)

| Status | Significado |
|--------|-------------|
| `pending` | Na fila, visível para Gravar/Rejeitar. |
| `processed` | Promovido ao cadastro final. |
| `rejected` | Recusado. |

Flags auxiliares: `detected_family_id`, `has_family_conflict`, `member_count`, `process_message`, `processed_at`.

**Pessoa** (`recepcao_cadastro_familiar.status`)

| Status | Significado |
|--------|-------------|
| `pending` | Aguardando decisão. |
| `processed` | Gravada em profiles/members (`applied_profile_id`, `applied_member_id`, `applied_family_id`). |
| `rejected` | Recusada com o lote. |
| `skipped` | Não aplicada (ex.: pulo interno). |

---

## 7. Etapa 5 — Régua de acolhimento (pós-aprovação)

Disparo **automático** quando a pessoa da recepção passa a `processed` (trigger `trg_recepcao_start_visitor_followup`).

### 7.1 Quem entra na régua

Só inicia se:

- a linha de recepção tiver `tenant_id` e `applied_profile_id`;
- a pessoa for o **informante** **ou** um dependente com **telefone próprio** (não cópia do celular do representante).

Dependente **sem** telefone próprio **não** ganha ciclo de acolhimento individual.

### 7.2 Ciclo (datas em America/Sao_Paulo)

| Dia | Tarefa | Responsável | Tipo |
|-----|--------|-------------|------|
| D+1 (data da aprovação) | WhatsApp da equipe de boas-vindas | `welcome_team` | `whatsapp_dia_1` |
| D+4 | Convite à célula mais próxima (CEP do visitante × geolocalização do anfitrião) | `welcome_team` | `convite_celula_dia_4` |
| D+8 | Verificação de check-in no domingo subsequente | `pastor` / sistema | `ligacao_pastor_dia_8` |

Resultado possível do ciclo:

- **integrado** — houve check-in no período → régua `Concluído`;
- **sem_retorno** — sem check-in → pendência pastoral / ligação.

Status da régua: `Ativo` | `Concluído` | `Interrompido`.  
Painel: Manutenção → **Régua de Acolhimento** (`visitor_followup`), ACL própria `maintenance.card.visitor_followup`.

**Ponto de validação:** se o isolamento multi-tenant da recepção não estiver aplicado na base, o trigger **sai cedo** (`tenant_id` nulo) e a régua **não começa**. Vale um teste após gravar um lote: a tarefa D+1 deve aparecer.

---

## 8. Etapa 6 — Primeiro acesso da família ao aplicativo

A promoção **não** envia senha automaticamente neste fluxo. O acesso usa o **celular** gravado no perfil.

### 8.1 Login (`/`)

1. Informa telefone + PIN.
2. O sistema decide a próxima tela:

| Condição do perfil | Destino |
|--------------------|---------|
| Nome vazio / «Visitante» **ou** sem data de nascimento | `/register` (cadastro inicial **próprio** — **não** é o formulário familiar) |
| Módulo LGPD ativo e `lgpd_accepted` diferente de verdadeiro | `/lgpd` |
| Caso contrário | Início `/(tabs)` |

Família que passou pela recepção **já tem nome e nascimento**. O caminho típico é **login → LGPD** (se o módulo estiver ligado), não `/register`.

`/register` é o fluxo de quem entrou só com PIN de visitante. **Não misturar** os dois na validação.

### 8.2 LGPD + selfie (`/lgpd`)

Etapas na tela: termos (precisa rolar) → câmera/selfie → confirmação.

- Aceite grava `lgpd_accepted`.
- Selfie vai para o storage e `selfie_url` no perfil.
- Recusa gera mensagem de recusa (não segue para o Início).
- Sessão de **totem** é barrada nesta rota (não usar telefone de kiosk como se fosse o membro).

### 8.3 Depois do aceite

- Início (avisos / próximos eventos).
- **Agenda da Família** (modal a partir do Início).
- **Perfil** → Carteirinha Digital: QR = **código da família** (`family_id`), não o id individual.
- **Perfil** → Gerenciar Família (se tiver grant): aceitar/rejeitar integrantes, vincular, desmembrar — isso é **gestão posterior**, não a fila pública.

---

## 9. Etapa 7 — Agenda da Família e totem (presença no culto)

A Recepção **não** marca presença. Depois de promovida, a família usa o fluxo vivo de eventos:

1. No Início, abre a **Agenda da Família** do evento publicado.
2. Marca a **audiência** (quem da família vai).
3. Se o evento tiver **totem ativo** ou **quórum**, isso gera **pré-check-in**. Sem essa marcação, o totem/QR de família não confirma.
4. Na Carteirinha, o QR carrega o **código da família**.
5. No **`/totem-checkin`**, o operador (ou dispositivo totem) lê o QR:
   - `lookup_totem_checkin` — localiza o pré-check-in;
   - `confirm_totem_checkin` — confirma (`checkins`).
6. Confirmação repetida devolve mensagem de “já confirmado”.

O card antigo de QR no Painel (carrossel) está **congelado**. O caminho publicado é: **Início → Agenda** e rota dedicada **`/totem-checkin`**.

Não há flag de “primeira visita” na Agenda. A régua D+8 é que olha check-in no período para decidir integração.

---

## 10. Entrada alternativa — visitante de célula

Operador de pequeno grupo (com permissão no grupo) usa **Enviar à recepção**:

- Informa **nome** e **celular 11 dígitos**.
- RPC `enqueue_small_group_visitor`.
- Cria um lote `pending` com **uma** pessoa:
  - vínculo: `Visitante de célula` (fora da lista do formulário público);
  - nascimento placeholder: **1900-01-01**;
  - alerta: origem do grupo e aviso de que a data de nascimento não foi informada.

Esse lote **aparece na mesma fila** da Recepção Familiar. A Secretaria deve completar/corrigir dados ao gravar (especialmente nascimento).

Após gravar, o perfil pode cair em `/register` no primeiro login **se** o nascimento continuar inválido/ausente na prática — o placeholder `1900-01-01` **é** uma data, então o app pode **não** mandar para `/register` e ir para LGPD. **Ponto de validação:** conferir o que a operação espera para visitante de célula (obrigar correção do nascimento na fila antes de Gravar).

---

## 11. Isolamento, segurança e o que não está neste processo

### 11.1 Igreja (tenant)

Listagem, gravação e rejeição da fila usam a igreja da **sessão** do operador (`require_session_tenant_id` no patch multi-tenant). O envio público associa o lote ao tenant da sessão/default.

Ghost: na Manutenção e na Agenda usa-se a **identidade efetiva** do alvo, não o telefone do auditor.

### 11.2 Fail-closed na interface

- Sem grant do card (e sem Super Admin) o painel de recepção **não abre**.
- Totem exige rota de liderança / dispositivo totem.
- LGPD exige sessão de membro (não totem).

### 11.3 Fora do escopo / congelado

- Carrossel antigo do Painel (QR, Agenda duplicada) — **não** é o caminho publicado.
- `CheckinModal` com texto “Em breve…” — **não** é o check-in live.
- Face ID / Touch ID do aparelho — desbloqueio do app, **não** é a selfie da LGPD.
- Cantinho da Leitura, ofertas, escalas etc. — processos independentes.

---

## 12. Roteiro de validação ponta a ponta

Use famílias de teste. Anote protocolo, IBN e telefones.

### Bloco A — Família 100% nova

1. Abrir `/cadastro-familia/` **sem** estar logado.
2. Preencher representante (nome, nascimento, celular novo, CEP real, número).
3. Adicionar 1 cônjuge (com celular próprio) e 1 filho (sem celular).
4. Enviar. Conferir: protocolo na tela; **nenhum** IBN (família nova); mensagem de espera.
5. Abrir Manutenção → Recepção. O lote deve aparecer com 3 pessoas; informante = Representante Legal.
6. Sem selecionar → **Gravar todos pendentes**. Esperado: processados 1 lote / 3 pessoas; conflito 0.
7. Conferir em Lista de membros / Dados: os três com o **mesmo** IBN novo; endereço no representante.
8. Filho sem telefone: **não** deve gerar régua própria. Representante e cônjuge com telefone: **devem** aparecer na Régua (D+1).
9. Login com o celular do representante + PIN. Esperado: **LGPD** (se módulo ativo), não `/register`.
10. Aceitar termos, tirar selfie, ir ao Início.
11. Abrir Agenda, marcar audiência da família em evento com totem.
12. Abrir Carteirinha, ler QR no `/totem-checkin`. Esperado: confirmação da família.

### Bloco B — Família já existente (mesmo celular + mesmo nome)

1. Enviar de novo o **mesmo** representante (mesmo nome e celular) + um dependente novo.
2. Tela de sucesso deve **mostrar IBN** já conhecido.
3. Na fila: lote com `detected_family_id`.
4. Gravar. Esperado: **reutiliza** o IBN; não cria segunda família; dependente novo entra no mesmo código.

### Bloco C — Conflito de famílias

1. Montar um envio cujos celulares batam com **dois IBN diferentes** já gravados.
2. Fila deve marcar **conflito**.
3. Gravar: lote **permanece** (skipped). Não pode misturar as duas famílias automaticamente.
4. Rejeitar o lote e registrar o tratamento manual esperado pela operação.

### Bloco D — Celular de outra pessoa

1. Usar celular já cadastrado em perfil com **outro nome**.
2. Enviar. Matching não deve acoplar esse perfil. Telefone não deve duplicar no profile alheio.
3. Validar mensagem/protocolo e o que a Secretaria vê no lote (match vazio).

### Bloco E — Rejeição

1. Enviar um lote de teste.
2. Rejeitar na fila.
3. Confirmar: some da lista pendente; **não** aparece em membros; novo envio gera **outro** protocolo.

### Bloco F — Visitante de célula

1. Em Pequeno Grupo, enviar visitante (nome + celular).
2. Fila: 1 pessoa, vínculo «Visitante de célula», nascimento 01/01/1900.
3. Decidir com a operação: corrigir nascimento **antes** de Gravar ou gravar e completar em Dados Cadastrais.
4. Gravar e seguir login/LGPD.

### Bloco G — Totem sem pré-check-in

1. Família promovida, **sem** marcar Agenda, tenta QR no totem de evento com `totem_ativo`.
2. Esperado: **não** confirma (falta pré-check-in).
3. Marcar Agenda e repetir: confirma.

---

## 13. Checklist resumido (imprimir / marcar)

| # | Critério | OK? |
|---|----------|-----|
| 1 | Formulário abre sem login em `/cadastro-familia/` | |
| 2 | Recusa envio com nome curto, data inválida, celular ≠ 11 dígitos, CEP ≠ 8, sem número | |
| 3 | Máximo 9 dependentes; vínculo Representante Legal só no informante | |
| 4 | ViaCEP preenche logradouro antes do envio | |
| 5 | Sucesso mostra protocolo; cadastro **ainda não** está em membros | |
| 6 | Fila só para quem tem o card (ou Super Admin) | |
| 7 | Gravar cria/atualiza profiles+members com IBN único no lote | |
| 8 | Lote em conflito não grava | |
| 9 | Rejeitar não cria pessoas | |
| 10 | Matching exige nome; telefone sozinho não une pessoas | |
| 11 | Régua D+1 para quem tem telefone próprio após Gravar | |
| 12 | Login da família promovida vai a LGPD, não a `/register` | |
| 13 | Selfie + aceite LGPD liberam o Início | |
| 14 | QR da carteirinha é o código da **família** | |
| 15 | Totem só confirma com pré-check-in da Agenda (evento com totem/quórum) | |
| 16 | Visitante de célula cai na **mesma** fila | |
| 17 | Ghost na Agenda/Manutenção usa o alvo, não o auditor | |

---

## 14. Pontos abertos para a validação de negócio

Anote a decisão da operação ao lado de cada item:

1. **`profiles.is_active = false` na promoção** — o app deixa logar. A Secretaria trata como “ainda não ativo” só no cadastro interno?
2. **CEP obrigatório no form e opcional no SQL** — manter só o form como trava é aceitável?
3. **Menor de idade** — precisa de responsável além do Representante Legal já informado?
4. **Visitante de célula com nascimento 1900-01-01** — a fila deve recusar Gravar até corrigir a data?
5. **Conflito de IBN** — qual o procedimento manual (qual tela: Gerenciar Família, Cadastro de Usuário, SQL de reparo)?
6. **PIN do primeiro acesso** — como a família recebe o PIN se a recepção não dispara e-mail neste fluxo?
7. **Régua sem `tenant_id`** — confirmar no ambiente de produção que a tarefa D+1 nasce ao Gravar.

---

## 15. Referência técnica (para cruzar com o teste)

| Peça | Onde |
|------|------|
| Formulário | `standalone/cadastro-familia/`, `components/forms/FamilyRegistrationForm.tsx` |
| Validações | `components/forms/familyRegistrationSchema.ts` |
| Envio público | RPC `submit_family_registration_public` |
| Fila | `components/MaintenanceFamilyReceptionCard.tsx` |
| Gravar / rejeitar | `process_recepcao_cadastro_familiar_batch` / `reject_recepcao_cadastro_familiar_batch` |
| SQL base | `scripts/recepcao-cadastro-familiar.sql` |
| Tenant | `scripts/multi-tenant-wave2c-media-recepcao-params.sql` |
| Régua | `scripts/visitor-followup-regua.sql` |
| Célula → fila | `enqueue_small_group_visitor` em `scripts/small-groups-schema.sql` |
| Login / LGPD | `lib/profileOnboarding.ts`, `app/lgpd.tsx` |
| QR / totem | `lib/digitalIdCard.ts`, `app/totem-checkin.tsx`, `scripts/checkins-totem-flow.sql` |
| ACL | `maintenance.card.profile_cadastro` (fila) e `maintenance.card.visitor_followup` (régua) |

---

*Fim do documento. Qualquer divergência entre este texto e o ambiente de produção deve ser registrada no checklist (ambiente desatualizado ou regra de negócio ainda não implementada).*
