# Cards do Dashboard (legado / congelado)

**Documentação:** [`PACOTE_4_ANEXO_TECNICO.md`](PACOTE_4_ANEXO_TECNICO.md) · [`INDICE_DOCUMENTACAO.md`](INDICE_DOCUMENTACAO.md) · [`lib/frozenPublication.ts`](lib/frozenPublication.ts)

**Atualizado em:** 05/10/2026

---

## Estado de publicação

O carrossel horizontal em `app/(tabs)/dashboard.tsx` **não é o caminho de uso publicado**. A experiência atual é:

| Superfície | Função |
|---|---|
| **Início** `/(tabs)` | Eventos, avisos, Agenda da Família, bolo, sticker, Eu quero…, Abigail |
| **Menu lateral** | Vida do membro (Perfil, Financeiro, Documentos, Célula, Escalas, murais, Apoio Mútuo, etc.) |
| **Engrenagem** | Operação da igreja (grupos em `lib/appDrawerMenu.ts`) |
| **Perfil** `/perfil` | Dados, família, carteirinha, trilha, serviços, reembolsos |

`dashboard.tsx` apenas **redireciona** deep links de cards congelados para rotas dedicadas (`resolveFrozenDashboardDeepLink` / `resolvePublishedDashboardHref`).

### Cards congelados (`FROZEN_DASHBOARD_CARD_CONTENTS`)

`event_alt`, `qr`, `kids_teens`, `offerings`, `pastoral`, `members_list`, `birthdays`, `financial`, `vigilance_scales`, `parking_vehicle_v2`, `scale_roster`, `grouped_manage`, `administrativo`, `campaign_card`.

Código antigo em comentário: `lib/frozen-dashboard-cards.comment.ts` (não importar).

### Cards ainda vivos com rota dedicada (`LIVE_DASHBOARD_CARD_CONTENTS`)

| Content | Rota |
|---|---|
| `small_group` | `/pequeno-grupo` |
| `opportunity_mural_card` | `/mural-oportunidades` |

### Rotas congeladas

`/(tabs)/explore`, `/explore`.

---

## Mapa de equivalência (legado → publicado)

| Card antigo | Destino publicado |
|---|---|
| Agenda / `event_alt` | Início → tocar o culto → Agenda da Família |
| QR / `qr` | Agenda / Carteirinha Digital / Totem |
| Ofertas / Campanhas | Eu quero… → Contribuir → `/ofertas` |
| Pastoral | Eu quero… → Cuidado Pastoral → `/pastoral` |
| Perfil & Identidade | Menu → Perfil → `/perfil` |
| Aniversariantes | Home (bolo do dia) e Engrenagem → Aniversariantes |
| Escalas | Menu → Escalas → `/escalas` |
| Lista de Membros | Engrenagem → Lista de Membros → `/membros` |
| Financeiro | Menu → Financeiro → `/financial` |
| Administrativo | Engrenagem → Administrativo |
| Célula | Menu → Minha Célula |
| Mural de Oportunidades | Menu → Mural de Oportunidades |

---

## Índice legado

Documentos de treinamento e manuais **não** devem ensinar o carrossel como fluxo principal. Use [`MANUAL_DASHBOARD_MEMBRO.md`](MANUAL_DASHBOARD_MEMBRO.md) e [`FUNCIONALIDADES.md`](FUNCIONALIDADES.md).

---

*Anexo técnico · estado congelado documentado em 05/10/2026.*
