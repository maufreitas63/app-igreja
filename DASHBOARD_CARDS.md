# Cards do Dashboard



Lista dos cards do carrossel horizontal em `app/(tabs)/dashboard.tsx`.



**Documentação:** [`PACOTE_4_ANEXO_TECNICO.md`](PACOTE_4_ANEXO_TECNICO.md) · [`INDICE_DOCUMENTACAO.md`](INDICE_DOCUMENTACAO.md)



**Atualizado em:** 22/05/2026



## Índice do Aplicativo (`/(tabs)/index`)

Tela inicial após o login com **etiquetas** (atalhos) para cada módulo do Painel:

- Distribuição uniforme na altura útil da tela
- Subitens aninhados (ex.: Sala(s) e QR Code sob Painel de Eventos)
- Ícones coloridos por módulo; atalhos desabilitados quando o fluxo não se aplica (sem evento, sem QR, etc.)
- Toque na etiqueta navega para `/(tabs)/dashboard` com parâmetro `dashboardCard`
- Marca d'água visível (login não exibe marca d'água)

---

## Navegação do carrossel



- Deslize horizontalmente no card **ou** use os botões `‹` / `›` no rodapé (`CarouselFooterNav`).

- O rodapé exibe a posição atual (`1 / N`) e o botão central abre o **Menu** de atalhos.

- Segurar `‹` ou `›` avança card a card automaticamente (500 ms).

- O cabeçalho mostra o título do card ativo (`ActiveScreenBadge`).

- Cards visíveis dependem de **ACL** (`dashboard.card.*`) e de flags de evento/escala/estacionamento.

- Cada card usa **paleta visual própria** (fundo, borda, sombra e acentos) definida em `lib/dashboardCardThemes.ts`.

- Telas filhas abertas a partir do dashboard propagam `returnDashboardCard`; ao voltar, o carrossel restaura o card de origem sem passar por cards intermediários.



## Todos os cards (por número)



| Número | Nome | Posição padrão* | Conteúdo (`content`) | Visibilidade |

|--------|------|-----------------|----------------------|--------------|

| 1 | Agenda da Família | 1 | `event_alt` | Sempre (com ACL) |

| 2 | Check In | 2 | `qr` | Parâmetro `qr_code` ≠ `nao` |

| 4 | SALA(S) | 3 | `kids_teens` | Sempre (com ACL) — **só inscrições da família do usuário** |

| 3 | Dízimos e Ofertas | 4 | `offerings` | **Sempre** (com ACL) — independente de `parm_ofertas` do evento |

| 5 | Coração Aberto | 5 | `pastoral` | Sempre (com ACL) |

| 10 | Lista de Membros | 6 | `members_list` | Sempre (com ACL) |

| 7 | Aniversariantes | 7 | `birthdays` | Sempre (com ACL) |

| 11 | Financeiro | 8 | `financial` | Sempre (com ACL) — hub: `/financial` (relatórios + saldo bancário) e `/expense-report` (RD) |

| 8 | Escalas | 9 | `vigilance_scales` | Sempre (com ACL) |

| 12 | Servos em escala | 10 | `scale_roster` | Quando há escala selecionada com servos |

| 9 | Estacionamento | 11 | `parking_vehicle_v2` | Painel de estacionamento ativo |

| 6 | Gestão de Cadastros | 12 | `grouped_manage` | Sempre (com ACL) — título na UI; atalhos Dados Cadastrais e Gerenciar Família |



\* Posição na ordem do carrossel quando **todos** os cards condicionais estão visíveis.



## Ordem no carrossel (cenário completo)



| Posição | Número | Nome |

|---------|--------|------|

| 1 | 1 | Agenda da Família |

| 2 | 2 | Check In |

| 3 | 4 | SALA(S) |

| 4 | 3 | Dízimos e Ofertas |

| 5 | 5 | Coração Aberto |

| 6 | 10 | Lista de Membros |

| 7 | 7 | Aniversariantes |

| 8 | 11 | Financeiro |

| 9 | 8 | Escalas |

| 10 | 12 | Servos em escala *(condicional)* |

| 11 | 9 | Estacionamento *(condicional)* |

| 12 | 6 | Gestão de Cadastros |



## Ordem mínima (sem cards condicionais)



Quando Check In, Estacionamento e Servos em escala estão ocultos:



| Posição | Número | Nome |

|---------|--------|------|

| 1 | 1 | Agenda da Família |

| 2 | 4 | SALA(S) |

| 3 | 3 | Dízimos e Ofertas |

| 4 | 5 | Coração Aberto |

| 5 | 10 | Lista de Membros |

| 6 | 7 | Aniversariantes |

| 7 | 11 | Financeiro |

| 8 | 8 | Escalas |

| 9 | 6 | Gestão de Cadastros |



## Card SALA(S) — escopo no dashboard



No **Painel do membro**, o card lista apenas inscrições Kids/Teens de **membros da própria família** (`familyId` da sessão). Na **Manutenção → Sala(s) - Check In**, a equipe vê **todos** os inscritos do evento.



Mensagens quando vazio:



- Família não identificada: *"Não foi possível identificar a família do seu cadastro…"*

- Sem inscritos da família: *"Nenhum membro da sua família inscrito em IBN KIDS/TEENS."*



## Navegação por parâmetro



Outras telas podem abrir um card via `dashboardCard`:



- Por **número**: `'1'`, `'2'`, … `'12'`, `'6'`

- Por **conteúdo**: ex. `'pastoral'` (card 5), `'members_list'` (card 10), `'offerings'` (card 3)



Constante usada para o menu: `DASHBOARD_MENU_CARD_ID = '6'`.

---

## Card Lista de Membros (`members_list`)

- Botões **Visitantes** (ou **Membros**, conforme a lista ativa) e **Mapa Geral** dividem a mesma linha (`flex: 1` cada).
- **Mapa Geral** abre `/mapa-geolocalizacao` preservando `returnDashboardCard`.
- Título alterna entre *LISTA DE MEMBROS* e *LISTA DE VISITANTES*.

---

## Card Gestão de Cadastros (`grouped_manage`)

- Título exibido: **Gestão de Cadastros** (identificador interno do card permanece `grouped_manage`).
- Botões com ícones: **Dados Cadastrais** → `/manage-profile`; **Gerenciar Família** → `/manage-members`.
- Ambos propagam `returnDashboardCard` para retorno ao card 6.

---

## Card Dízimos e Ofertas (`offerings`)

- Botão **Copiar chave PIX** usa ícone Material *touch-app* para reforçar a ação de toque no PWA.

---

## Card Financeiro (`financial`)

- Recurso ACL: `dashboard.card.financial` (card) + telas `/financial` e `/expense-report`.
- Toque abre hub com atalho destacado **Relatório de Despesas (RD)** → `/expense-report`.
- Tela `/financial`: Resultado do mês, Comparativo, Últimos 12 meses, Planejado × Realizado, **Saldo bancário**.
- Itens Fluxo de caixa, Categorias e Relatórios extras aparecem como **em breve** no hub.


