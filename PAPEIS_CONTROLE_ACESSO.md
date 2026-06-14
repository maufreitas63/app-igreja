# Mapa visual de papéis — Controle de Acesso

Gerado em: 13/06/2026, 12:29:23
Fonte: scripts SQL do repositório

Legenda: **Ver** = visualizar recurso; **Editar** = alterar recurso.

---

## Visitantes

- **Código:** `visitantes`
- **Descrição:** Acesso público mínimo: login, cadastro e check-in; usado quando não há perfil/papéis na sessão

### Telas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Cadastro | `/register` | **Sim** | **Sim** |
| Card Agenda da Família | `dashboard.card.event_alt` | **Sim** | — |
| Card Check In | `dashboard.card.qr` | **Sim** | — |
| LGPD | `/lgpd` | **Sim** | **Sim** |
| Login | `/` | **Sim** | — |

### Tabelas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Categorias pastorais | `pastoral_reason_categories` | **Sim** | — |
| Eventos | `events` | **Sim** | — |
| Inscrições em eventos | `event_registrations` | **Sim** | **Sim** |
| Parâmetros do app | `app_parameters` | **Sim** | — |
| Subcategorias pastorais | `pastoral_reason_subcategories` | **Sim** | — |

---

## Congregado

- **Código:** `congregado`
- **Descrição:** Participante cadastrado com acesso básico; sem gerência familiar

### Telas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Card Agenda da Família | `dashboard.card.event_alt` | **Sim** | — |
| Card Aniversariantes | `dashboard.card.birthdays` | **Sim** | — |
| Card Check In | `dashboard.card.qr` | **Sim** | — |
| Card Coração Aberto | `dashboard.card.pastoral` | **Sim** | — |
| Card Dízimos e Ofertas | `dashboard.card.offerings` | **Sim** | — |
| Card Menu | `dashboard.card.grouped_manage` | **Sim** | — |
| Card SALA(S) | `dashboard.card.kids_teens` | **Sim** | — |
| Coração Aberto | `/pastoral` | **Sim** | **Sim** |
| Dados cadastrais | `/manage-profile` | **Sim** | **Sim** |
| Dashboard | `/dashboard` | **Sim** | — |
| LGPD | `/lgpd` | **Sim** | **Sim** |
| Meus pedidos pastorais | `/pastoral-history` | **Sim** | — |

### Tabelas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Pedidos pastorais | `pastoral_requests` | **Sim** | **Sim** |
| Perfis | `profiles` | **Sim** | **Sim** |

### Colunas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Bairro | `profiles.address_neighborhood` | **Sim** | **Sim** |
| CEP | `profiles.cep` | **Sim** | **Sim** |
| Cidade | `profiles.address_city` | **Sim** | **Sim** |
| Complemento | `profiles.address_complement` | **Sim** | **Sim** |
| E-mail | `profiles.email` | **Sim** | **Sim** |
| Estado | `profiles.address_state` | **Sim** | **Sim** |
| Nascimento | `profiles.birth_date` | **Sim** | **Sim** |
| Nome completo | `profiles.full_name` | **Sim** | **Sim** |
| Número | `profiles.address_number` | **Sim** | **Sim** |
| Rua | `profiles.address_street` | **Sim** | **Sim** |
| Telefone | `profiles.phone` | **Sim** | **Sim** |

---

## Membro

- **Código:** `member`
- **Descrição:** Acesso padrão do aplicativo

### Telas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Card Agenda da Família | `dashboard.card.event_alt` | **Sim** | — |
| Card Aniversariantes | `dashboard.card.birthdays` | **Sim** | — |
| Card Check In | `dashboard.card.qr` | **Sim** | — |
| Card Coração Aberto | `dashboard.card.pastoral` | **Sim** | — |
| Card Dízimos e Ofertas | `dashboard.card.offerings` | **Sim** | — |
| Card Escalas | `dashboard.card.vigilance_scales` | **Sim** | — |
| Card Estacionamento | `dashboard.card.parking_vehicle_v2` | **Sim** | — |
| Card Financeiro (dashboard) | `dashboard.card.financial` | **Sim** | — |
| Card Lista de Membros | `dashboard.card.members_list` | **Sim** | — |
| Card Menu | `dashboard.card.grouped_manage` | **Sim** | — |
| Card SALA(S) | `dashboard.card.kids_teens` | **Sim** | — |
| Coração Aberto | `/pastoral` | **Sim** | **Sim** |
| Dados cadastrais | `/manage-profile` | **Sim** | **Sim** |
| Dashboard | `/dashboard` | **Sim** | — |
| Gerenciar família | `/manage-members` | **Sim** | — |
| LGPD | `/lgpd` | **Sim** | **Sim** |
| Meus pedidos pastorais | `/pastoral-history` | **Sim** | — |
| Relatório de Despesas (RD) | `/expense-report` | **Sim** | — |
| Relatórios financeiros (/financial) | `/financial` | **Sim** | — |

### Tabelas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Categorias pastorais | `pastoral_reason_categories` | **Sim** | — |
| Eventos | `events` | **Sim** | — |
| Famílias | `families` | **Sim** | — |
| Inscrições em eventos | `event_registrations` | **Sim** | **Sim** |
| Membros da família | `members` | **Sim** | — |
| Parâmetros do app | `app_parameters` | **Sim** | — |
| Pedidos pastorais | `pastoral_requests` | **Sim** | **Sim** |
| Perfis | `profiles` | **Sim** | **Sim** |
| Subcategorias pastorais | `pastoral_reason_subcategories` | **Sim** | — |
| Veículos do perfil | `profile_vehicles` | **Sim** | **Sim** |

### Colunas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Alertas alimentares | `profiles.medical_food_alerts` | **Sim** | **Sim** |
| Bairro | `profiles.address_neighborhood` | **Sim** | **Sim** |
| CEP | `profiles.cep` | **Sim** | **Sim** |
| Cidade | `profiles.address_city` | **Sim** | **Sim** |
| Complemento | `profiles.address_complement` | **Sim** | **Sim** |
| CPF | `profiles.cpf` | **Sim** | **Sim** |
| E-mail | `profiles.email` | **Sim** | **Sim** |
| Estado | `profiles.address_state` | **Sim** | **Sim** |
| Nascimento | `profiles.birth_date` | **Sim** | **Sim** |
| Nome completo | `profiles.full_name` | **Sim** | **Sim** |
| Número | `profiles.address_number` | **Sim** | **Sim** |
| Rua | `profiles.address_street` | **Sim** | **Sim** |
| Telefone | `profiles.phone` | **Sim** | **Sim** |

---

## Responsável familiar

- **Código:** `family_acceptor`
- **Descrição:** Gerencia membros da família

### Telas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Card Lista de Membros | `dashboard.card.members_list` | **Sim** | — |
| Gerenciar família | `/manage-members` | **Sim** | — |

---

## Líder

- **Código:** `lider`
- **Descrição:** Gerencia servos e programação de tipos de escala atribuídos ao perfil

### Telas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Card Escalas | `dashboard.card.vigilance_scales` | **Sim** | — |
| Manutenção | `/maintenance-dashboard` | **Sim** | — |
| Manutenção: Programação de Escalas | `maintenance.card.scales` | **Sim** | **Sim** |
| Manutenção: Servos em Disponibilidade | `maintenance.card.scale_volunteers` | **Sim** | **Sim** |

---

## Administrador de eventos

- **Código:** `events_admin`
- **Descrição:** Manutenção de eventos e salas

### Telas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Card SALA(S) | `dashboard.card.kids_teens` | **Sim** | **Sim** |
| Dashboard | `/dashboard` | **Sim** | **Sim** |
| Manutenção | `/maintenance-dashboard` | **Sim** | **Sim** |
| Manutenção — Cronograma de eventos | `maintenance.card.events_gantt` | **Sim** | **Sim** |
| Manutenção — Lista de presença (quórum) | `maintenance.card.quorum_presence` | **Sim** | **Sim** |
| Manutenção — Monitor de salas | `maintenance.card.sala_monitor` | **Sim** | **Sim** |
| Manutenção — Programação de eventos | `maintenance.card.events` | **Sim** | **Sim** |

---

## Equipe Pastoral

- **Código:** `pastoral`
- **Descrição:** Mesmos privilégios de Membro, mais manutenção Cuidado Pastoral

### Telas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Card Agenda da Família | `dashboard.card.event_alt` | **Sim** | — |
| Card Aniversariantes | `dashboard.card.birthdays` | **Sim** | — |
| Card Check In | `dashboard.card.qr` | **Sim** | — |
| Card Coração Aberto | `dashboard.card.pastoral` | **Sim** | — |
| Card Dízimos e Ofertas | `dashboard.card.offerings` | **Sim** | — |
| Card Escalas | `dashboard.card.vigilance_scales` | **Sim** | — |
| Card Estacionamento | `dashboard.card.parking_vehicle_v2` | **Sim** | — |
| Card Financeiro (dashboard) | `dashboard.card.financial` | **Sim** | — |
| Card Lista de Membros | `dashboard.card.members_list` | **Sim** | — |
| Card Menu | `dashboard.card.grouped_manage` | **Sim** | — |
| Card SALA(S) | `dashboard.card.kids_teens` | **Sim** | — |
| Coração Aberto | `/pastoral` | **Sim** | **Sim** |
| Dados cadastrais | `/manage-profile` | **Sim** | **Sim** |
| Dashboard | `/dashboard` | **Sim** | — |
| Gerenciar família | `/manage-members` | **Sim** | — |
| LGPD | `/lgpd` | **Sim** | **Sim** |
| Manutenção | `/maintenance-dashboard` | **Sim** | — |
| Manutenção: Cuidado Pastoral | `maintenance.card.pastoral_care` | **Sim** | **Sim** |
| Meus pedidos pastorais | `/pastoral-history` | **Sim** | — |
| Relatório de Despesas (RD) | `/expense-report` | **Sim** | — |
| Relatórios financeiros (/financial) | `/financial` | **Sim** | — |

### Tabelas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Membros da família | `members` | **Sim** | — |
| Pedidos pastorais | `pastoral_requests` | **Sim** | **Sim** |
| Perfis | `profiles` | **Sim** | **Sim** |

### Colunas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Alertas alimentares | `profiles.medical_food_alerts` | **Sim** | **Sim** |
| Bairro | `profiles.address_neighborhood` | **Sim** | **Sim** |
| CEP | `profiles.cep` | **Sim** | **Sim** |
| Cidade | `profiles.address_city` | **Sim** | **Sim** |
| Complemento | `profiles.address_complement` | **Sim** | **Sim** |
| CPF | `profiles.cpf` | **Sim** | **Sim** |
| E-mail | `profiles.email` | **Sim** | **Sim** |
| Estado | `profiles.address_state` | **Sim** | **Sim** |
| Nascimento | `profiles.birth_date` | **Sim** | **Sim** |
| Nome completo | `profiles.full_name` | **Sim** | **Sim** |
| Número | `profiles.address_number` | **Sim** | **Sim** |
| Rua | `profiles.address_street` | **Sim** | **Sim** |
| Telefone | `profiles.phone` | **Sim** | **Sim** |

---

## Super administrador

- **Código:** `super_admin`
- **Descrição:** Acesso total configurável

### Telas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Todas as telas (curinga) | `*` | **Sim** | **Sim** |

### Tabelas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Todas as tabelas (curinga) | `*` | **Sim** | **Sim** |

### Colunas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Todas as colunas (curinga) | `*` | **Sim** | **Sim** |

---
