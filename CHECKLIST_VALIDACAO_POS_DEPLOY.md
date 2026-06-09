# Checklist de validação pós-deploy

Lista das alterações **solicitadas após o deployment oficial** (Cloudflare Pages, branch `main`) para conferência em produção.

| Referência | Valor |
|------------|--------|
| Deploy oficial inicial | commit `408e796` |
| Último commit desta lista | commit `d653152` |
| URL de produção | painel Cloudflare → projeto Pages |
| Guia de deploy | [`DEPLOY_CLOUDFLARE.md`](DEPLOY_CLOUDFLARE.md) |

---

## Antes de validar (obrigatório)

- [ ] No Cloudflare: deploy do commit desejado com status **Success** (não basta o `git push`)
- [ ] Aguardar **3–10 min** após o push para o build concluir
- [ ] Abrir o PWA com **Ctrl+Shift+R** (hard refresh) ou em **aba anônima**
- [ ] Se instalado como PWA: fechar todas as janelas e reabrir
- [ ] DevTools → Network → documento HTML: `cache-control` com `must-revalidate` (commit `9f4aeb2`)
- [ ] Scripts SQL necessários já executados no Supabase (ver seção [SQL no Supabase](#sql-no-supabase))

---

## 1. Deploy e atualização em produção

**Pedido:** alterações demoravam para aparecer no ambiente de produção.

| Commit | O que validar |
|--------|----------------|
| `9f4aeb2` | Após novo deploy, a tela atualiza sem ficar presa em versão antiga do HTML |

**Checklist**

- [ ] Após deploy **Success**, a alteração mais recente aparece com hard refresh
- [ ] Bundles em `/_expo/static` continuam em cache (performance OK)
- [ ] `DEPLOY_CLOUDFLARE.md` documenta tempos esperados do pipeline

---

## 2. LGPD e cadastro

**Pedido:** botões LGPD não respondiam (aceitar / recusar / confirmar).

| Commit | Arquivos principais |
|--------|---------------------|
| `d653152` | `app/lgpd.tsx`, `app/register.tsx`, `hooks/useLgpdTermsScrollGate.ts` |

**Checklist — tela `/lgpd` (Dados cadastrais)**

- [ ] Role os termos até o final → aparece **✅ Termos lidos.**
- [ ] **Li e aceito** ou **Li e não concordo** habilitam após leitura
- [ ] **Confirmar** grava e retorna sem erro
- [ ] Abrir LGPD pelo perfil sem telefone na URL ainda resolve o perfil (`getStoredProfileId`)

**Checklist — cadastro inicial (`register.tsx`)**

- [ ] Mesmo fluxo de scroll dos termos funciona no cadastro de visitante
- [ ] Botões respondem após rolar até o fim

---

## 3. Dashboard principal

### 3.1 Escalas — voltar sem rolagem

**Pedido:** ao clicar em Voltar no detalhe da escala, voltar ao card Escalas sem animação.

| Commit | `85cc7cc` |

- [ ] Dashboard → card **Escalas** → selecionar uma escala
- [ ] Card de detalhe abre **instantaneamente**
- [ ] **Voltar** retorna ao card Escalas **sem rolar** pelos cards intermediários

### 3.2 Escalas — troca instantânea ao abrir

**Pedido:** ao selecionar escala, trocar de card sem animação.

| Commit | `ef118f4` |

- [ ] Ao tocar em uma escala, o carrossel pula direto ao card de detalhe (sem animação visível)

### 3.3 QR Code — Totem azul piscina após check-in

**Pedido:** após confirmar check-in no totem, fundo do card QR em azul piscina até o dia do evento passar.

| Commit | `36bb168` |

- [ ] Evento com **totem ativo**, sem quórum, **no dia de hoje**
- [ ] Marcar audiência → apresentar QR no totem → confirmar check-in
- [ ] Card **QR Code — Totem** fica com fundo azul piscina e borda ciano
- [ ] No dia seguinte (ou evento que não é hoje), o destaque **não** aparece

---

## 4. Manutenção — dashboard e eventos

### 4.1 Cards do carrossel visíveis

**Pedido:** cards do dashboard de manutenção não apareciam (tela em branco após editor).

| Commit | `4f1aabb` |

- [ ] Manutenção → navegar entre cards (Programação, Escalas, Financeiro, etc.)
- [ ] Abrir editor de evento → fechar/cancelar → cards continuam visíveis
- [ ] Não há tela vazia após criar/cancelar evento

### 4.2 Cancelar novo evento

**Pedido:** cancelar criação de evento não deixava tela vazia.

| Commit | `324f59d` (reforçado em `4f1aabb`) |

- [ ] Programação de Eventos → **Novo evento** → **Cancelar**
- [ ] Carrossel e cards permanecem na tela

### 4.3 Botão +7 — replicar evento

**Pedido:** em evento cadastrado, botão **+7** abaixo de Publicado/Rascunho; cópias em rascunho.

| Commit | `110b50f` |

- [ ] Abrir evento **já cadastrado** (não em “Novo evento”)
- [ ] Botão **+7** aparece abaixo da linha Publicado/Rascunho
- [ ] Confirmar → cria **7 rascunhos** (+1 a +7 dias) com mesmos parâmetros
- [ ] Evento original **não** é alterado
- [ ] Cópias aparecem como rascunho no cronograma/lista

### 4.4 Controle de Acesso — visualização

**Pedido:** painel de Controle de Acesso com scroll, papéis e colunas visíveis.

| Commit | `43a1ae2` |

- [ ] Manutenção → **Controle de Acesso** (última linha do menu)
- [ ] Lista de papéis rola e expande corretamente
- [ ] Colunas de permissão legíveis (sem corte)

---

## 5. Financeiro

### 5.1 Seletor de mês em dropdown (relatórios)

**Pedido:** na tela Financeiro, relatórios com seletor de mês no estilo dropdown modal.

| Commits | `1d828ca`, `773cb49` |

**Tela `/financial` — seção Relatórios**

- [ ] Seção **Relatórios** agrupada com título fixo
- [ ] Rótulo **Mês** + `DropdownSelect` (chevron, abre modal)
- [ ] Trocar mês atualiza Resultado do Mês, Comparativo, etc.

**Manutenção → Informações Financeiras → Relatórios de Despesas**

- [ ] Dropdown de mês dentro da seção de RDs (sem depender só de “Mês de referência”)

### 5.2 Coluna Descrição — EXTRAORDINARIO

**Pedido:** largura mínima da coluna Descrição para caber **EXTRAORDINARIO** em uma linha.

| Commit | `12e4759` |

- [ ] Financeiro → Relatórios → **Resultado do Mês**
- [ ] Linha com descrição **EXTRAORDINARIO** não quebra em duas linhas

### 5.3 Relatório de Despesas (RD) — data padrão

**Pedido:** data de preenchimento com hoje por padrão em cada linha do RD.

| Commit | `fa48276` |

- [ ] Novo RD → primeira linha já com data de hoje (`DD/MM/AA`)
- [ ] **Adicionar linha** → nova linha também com data de hoje
- [ ] Campo continua editável

### 5.4 Seis instruções — Informações Financeiras (manutenção)

**Pedido:** RDs do mês, accordion, título fixo, versão na carga, comentário sob clique.

| Implementação | `MaintenanceFinancialsCard`, RPCs em `scripts/` |

- [ ] **Relatórios de Despesas:** lista RDs do mês de referência
- [ ] RD conciliado → botão **Remover vínculo** → volta para pendente
- [ ] Título da etiqueta colapsável **fixo** (não desloca ao expandir conteúdo)
- [ ] Só **uma** seção aberta por vez (accordion)
- [ ] Picker do mês com altura maior (~+50%)
- [ ] Carga/limpeza em lote: seletor **REALIZADO / PLANEJADO** — só afeta a versão escolhida
- [ ] Editar lançamento → comentário **vazio**; teclado só ao tocar em “Toque para digitar…”

### 5.5 RD conciliado em mês diferente da emissão

**Pedido:** RD de junho vinculado a despesa de maio deve aparecer no relatório de **maio**.

| SQL | `scripts/expense-reports-rpc.sql` → `listar_relatorios_despesas_periodo` |

- [ ] Conciliar RD a lançamento de **maio**
- [ ] Em Manutenção → Financeiro → mês **maio** → RD aparece na lista
- [ ] Pendente continua filtrado pelo mês de **emissão**

---

## 6. Perfil, selfie e família

### 6.1 Selfie — gravação e preview

**Pedido:** foto da selfie não atualizava no banco nem na tela.

| Commits | `d3fb8d8`, `6a934de` |

- [ ] Dados cadastrais → **Atualizar Selfie** → nova foto aparece na hora
- [ ] Sair e voltar → foto permanece
- [ ] Gerenciar família → editar membro → foto do membro grava corretamente
- [ ] Não é possível vincular membro à **mesma família** duas vezes

### 6.2 Lista de membros — mapa

**Pedido:** tela branca ao abrir mapa na Lista de Membros.

| Commit | `2121906` |

- [ ] Manutenção → Lista de Membros → abrir mapa sem tela branca

### 6.3 Gerenciar família

| Commit | Assunto |
|--------|---------|
| `61a85a3` | Membro adicionado aparece na lista |
| `6efdfd1` | Nome pelo telefone; bloqueio de duplicata na família |
| `5314b73` | Data de nascimento com barras ao digitar |

- [ ] Adicionar membro → aparece na lista após salvar
- [ ] Busca por nome (não só celular) funciona
- [ ] Data de nascimento formata com `/` ao digitar
- [ ] Não permite membro duplicado na mesma família

---

## 7. Login e interface

**Pedido:** login sem marca d'água; redes sociais só no passo 1; marca d'água mais transparente e altura do dashboard.

| Arquivos | `AppShell.tsx`, `AppWatermark.tsx`, `app/index.tsx` |

- [ ] Tela de login/senha **sem** marca d'água
- [ ] Ícones de redes sociais **somente** no passo 1 (telefone/CPF)
- [ ] Passo 2 (senha) **sem** ícones sociais
- [ ] Demais telas: marca d'água mais discreta (opacidade ~0,07)
- [ ] Altura da marca d'água alinhada à altura do card do dashboard principal

---

## 8. Infraestrutura PWA (pós-deploy inicial)

| Commit | Assunto | Validar |
|--------|---------|---------|
| `4c77386` | Fontes locais + headers `.ttf` | Ícones FontAwesome/Material não aparecem como `?` |
| `20f2b72` | Carrossel PWA, super_admin, ACL | Carrossel estável no navegador |
| `d74f245` | Dropdown Aniversariantes, família | Filtros e transferência familiar OK |
| `cc38ab1` / `1c54443` | Build Cloudflare / Supabase SSR | Deploy conclui sem erro |

- [ ] Ícones renderizam corretamente em produção (Network: `.ttf` → 200)
- [ ] Login e dashboard carregam sem tela branca no PWA
- [ ] Build Cloudflare **Success** no último push

---

## SQL no Supabase

Executar no SQL Editor **antes** de validar funcionalidades que dependem de RPC:

| Script | Quando necessário |
|--------|-------------------|
| `scripts/update-profile-field.sql` | Selfie / campos de perfil via RPC |
| `scripts/financials-maintenance-rpc.sql` | Carga/limpeza por versão (`p_budget_version`) |
| `scripts/expense-reports-rpc.sql` | Lista de RDs, desconciliar, filtro por mês do lançamento |
| `scripts/access-control-*.sql` | Controle de Acesso, papéis Congregado/Visitante |

**Checklist SQL**

- [ ] `update_profile_field` existe e aceita `selfie_url`
- [ ] `listar_relatorios_despesas_periodo` usa data do **lançamento** para RD conciliado
- [ ] `desconciliar_relatorio_despesas` disponível
- [ ] `carga_lote_lancamentos_financeiros` aceita parâmetro de versão

---

## Ordem sugerida de teste

1. Deploy **Success** + hard refresh  
2. Login (marca d'água / redes sociais)  
3. LGPD e cadastro  
4. Dashboard (escalas + QR totem)  
5. Manutenção (cards + eventos +7)  
6. Financeiro (dropdown, relatórios, RD)  
7. Perfil / selfie / família  

---

## Registro de validação

| Data | Validador | Commit testado | Observações |
|------|-----------|----------------|-------------|
| | | `d653152` | |
| | | | |

---

*Atualizado em 22/05/2026 · App IBN · Cloudflare Pages*
