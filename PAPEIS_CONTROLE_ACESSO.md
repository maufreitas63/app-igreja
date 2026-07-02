# Mapa visual de papéis — Controle de Acesso

Gerado em: 02/07/2026, 18:44:05
Fonte: banco Supabase (ao vivo)

Legenda: **Ver** = visualizar recurso; **Editar** = alterar recurso.

---

## Visitantes

- **Código:** `visitantes`
- **Descrição:** Acesso público mínimo sem perfil/papéis na sessão

### Telas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Cadastro | `/register` | **Sim** | **Sim** |
| Card Agenda da Família | `dashboard.card.event_alt` | **Sim** | — |
| Card Check In | `dashboard.card.qr` | **Sim** | — |
| Card Coração Aberto | `dashboard.card.pastoral` | **Sim** | **Sim** |
| Card Dízimos e Ofertas | `dashboard.card.offerings` | **Sim** | — |
| Coração Aberto | `/pastoral` | **Sim** | **Sim** |
| Dashboard | `/dashboard` | **Sim** | — |
| LGPD | `/lgpd` | **Sim** | **Sim** |
| Login | `/` | **Sim** | — |
| Meus pedidos pastorais | `/pastoral-history` | **Sim** | **Sim** |

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
| Cadastro | `/register` | **Sim** | **Sim** |
| Card — Administrativo | `dashboard.card.administrativo` | **Sim** | — |
| Card Agenda da Família | `dashboard.card.event_alt` | **Sim** | — |
| Card Aniversariantes | `dashboard.card.birthdays` | **Sim** | — |
| Card Check In | `dashboard.card.qr` | **Sim** | — |
| Card Coração Aberto | `dashboard.card.pastoral` | **Sim** | — |
| Card Dízimos e Ofertas | `dashboard.card.offerings` | **Sim** | — |
| Card Lista de Membros | `dashboard.card.members_list` | **Sim** | — |
| Card Menu | `dashboard.card.grouped_manage` | **Sim** | — |
| Card SALA(S) | `dashboard.card.kids_teens` | **Sim** | — |
| Coração Aberto | `/pastoral` | **Sim** | **Sim** |
| Dados cadastrais | `/manage-profile` | **Sim** | — |
| Dashboard | `/dashboard` | **Sim** | — |
| Gerenciar família | `/manage-members` | **Sim** | — |
| LGPD | `/lgpd` | **Sim** | **Sim** |
| Mapa de geolocalização | `/mapa-geolocalizacao` | **Sim** | — |
| Meus pedidos pastorais | `/pastoral-history` | **Sim** | — |

### Tabelas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Pedidos pastorais | `pastoral_requests` | **Sim** | **Sim** |
| Perfis | `profiles` | **Sim** | **Sim** |
| Tabela — Atas de assembleias | `maintenance_assembly_minutes` | **Sim** | — |

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
| Cadastro | `/register` | **Sim** | **Sim** |
| Card — Administrativo | `dashboard.card.administrativo` | **Sim** | — |
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
| Gerenciar família | `/manage-members` | **Sim** | **Sim** |
| LGPD | `/lgpd` | **Sim** | **Sim** |
| Login | `/` | **Sim** | **Sim** |
| Mapa de geolocalização | `/mapa-geolocalizacao` | **Sim** | — |
| Meus pedidos pastorais | `/pastoral-history` | **Sim** | — |
| Relatório de Despesas (RD) | `/expense-report` | **Sim** | **Sim** |
| Relatórios financeiros (/financial) | `/financial` | **Sim** | — |

### Tabelas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Categorias pastorais | `pastoral_reason_categories` | **Sim** | — |
| Eventos | `events` | **Sim** | — |
| Famílias | `families` | **Sim** | — |
| Inscrições em eventos | `event_registrations` | **Sim** | **Sim** |
| Lançamentos financeiros | `financials` | **Sim** | — |
| Membros da família | `members` | **Sim** | **Sim** |
| Parâmetros do app | `app_parameters` | **Sim** | — |
| Pedidos pastorais | `pastoral_requests` | **Sim** | **Sim** |
| Perfis | `profiles` | **Sim** | **Sim** |
| Relatórios de Despesas | `expense_reports` | **Sim** | **Sim** |
| Subcategorias pastorais | `pastoral_reason_subcategories` | **Sim** | — |
| Tabela — Atas de assembleias | `maintenance_assembly_minutes` | **Sim** | — |
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
| Nome fantasia | `profiles.nome_fantasia` | **Sim** | **Sim** |
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
| Dashboard | `/dashboard` | **Sim** | — |

---

## Líder

- **Código:** `lider`
- **Descrição:** Gerencia servos e programação de tipos de escala atribuídos ao perfil

### Telas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Card Escalas | `dashboard.card.vigilance_scales` | **Sim** | — |
| Dashboard | `/dashboard` | **Sim** | — |
| Escala: Acolhimento Recepção | `scale_type.acolhimento_recepcao` | **Sim** | **Sim** |
| Escala: Escala de Monitores Sala Kids | `scale_type.sala kids` | **Sim** | **Sim** |
| Escala: Escala de Monitores Sala Teens | `scale_type.sala teens` | **Sim** | **Sim** |
| Escala: Escala Ministério  Infantil | `scale_type.sala_kids` | **Sim** | **Sim** |
| Escala: Escala Ministério de Louvor | `scale_type.louvor` | **Sim** | **Sim** |
| Escala: Escala Ministério Jovens | `scale_type.sala_teens` | **Sim** | **Sim** |
| Escala: Ministério De Acolhimento | `scale_type.ministerioacolhimento` | **Sim** | **Sim** |
| Escala: Ministério De Intercessão | `scale_type.ministintersec` | **Sim** | **Sim** |
| Manutenção — Cronograma de eventos | `maintenance.card.events_gantt` | **Sim** | **Sim** |
| Manutenção — Programação de eventos | `maintenance.card.events` | **Sim** | **Sim** |
| Manutenção do sistema | `/maintenance-dashboard` | **Sim** | — |
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
| Manutenção — Relatórios | `maintenance.card.relatorios` | **Sim** | — |
| Manutenção — Sugestões e Melhorias | `maintenance.card.suggestions_improvements` | **Sim** | — |
| Manutenção do sistema | `/maintenance-dashboard` | **Sim** | **Sim** |

### Tabelas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Eventos | `events` | **Sim** | **Sim** |
| Inscrições em eventos | `event_registrations` | **Sim** | **Sim** |
| Tabela — Anexos de suporte | `maintenance_support_attachments` | **Sim** | — |
| Tabela — Atas de assembleias | `maintenance_assembly_minutes` | **Sim** | **Sim** |
| Tabela — Comunicações de suporte | `maintenance_support_communications` | **Sim** | — |
| Tabela — Histórico de suporte | `maintenance_support_interactions` | **Sim** | — |
| Tabela — Solicitações de suporte | `maintenance_support_requests` | **Sim** | — |
| Tabela — Temas de suporte | `maintenance_support_themes` | **Sim** | — |

---

## Tesoureiro

- **Código:** `tesoureiro`
- **Descrição:** Tesouraria: card financeiro, manutenção financeira, eventos de meses anteriores e RD por mês de referência

### Telas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Card Financeiro (dashboard) | `dashboard.card.financial` | **Sim** | **Sim** |
| Dashboard | `/dashboard` | **Sim** | — |
| Manutenção — Cronograma de eventos | `maintenance.card.events_gantt` | **Sim** | **Sim** |
| Manutenção — Informações financeiras | `maintenance.card.financials` | **Sim** | **Sim** |
| Manutenção — Programação de eventos | `maintenance.card.events` | **Sim** | **Sim** |
| Manutenção — Relatórios | `maintenance.card.relatorios` | **Sim** | — |
| Manutenção — Sugestões e Melhorias | `maintenance.card.suggestions_improvements` | **Sim** | — |
| Manutenção do sistema | `/maintenance-dashboard` | **Sim** | — |
| Manutenção: Modelo Preditivo | `maintenance.card.predictive_insights` | **Sim** | — |
| Relatório de Despesas (RD) | `/expense-report` | **Sim** | **Sim** |
| Relatórios financeiros (/financial) | `/financial` | **Sim** | **Sim** |

### Tabelas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Eventos | `events` | **Sim** | **Sim** |
| Inscrições em eventos | `event_registrations` | **Sim** | **Sim** |
| Lançamentos financeiros | `financials` | **Sim** | **Sim** |
| Relatórios de Despesas | `expense_reports` | **Sim** | **Sim** |
| Tabela — Anexos de suporte | `maintenance_support_attachments` | **Sim** | — |
| Tabela — Atas de assembleias | `maintenance_assembly_minutes` | **Sim** | **Sim** |
| Tabela — Comunicações de suporte | `maintenance_support_communications` | **Sim** | — |
| Tabela — Histórico de suporte | `maintenance_support_interactions` | **Sim** | — |
| Tabela — Solicitações de suporte | `maintenance_support_requests` | **Sim** | — |
| Tabela — Temas de suporte | `maintenance_support_themes` | **Sim** | — |

---

## Equipe Pastoral

- **Código:** `pastoral`
- **Descrição:** Mesmos privilégios de Membro, mais manutenção Cuidado Pastoral

### Telas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Card Check In | `dashboard.card.qr` | **Sim** | — |
| Card Coração Aberto | `dashboard.card.pastoral` | **Sim** | — |
| Card Dízimos e Ofertas | `dashboard.card.offerings` | **Sim** | — |
| Card Escalas | `dashboard.card.vigilance_scales` | **Sim** | — |
| Card Estacionamento | `dashboard.card.parking_vehicle_v2` | **Sim** | — |
| Coração Aberto | `/pastoral` | **Sim** | **Sim** |
| Dashboard | `/dashboard` | **Sim** | — |
| Manutenção — Relatórios | `maintenance.card.relatorios` | **Sim** | — |
| Manutenção — Sugestões e Melhorias | `maintenance.card.suggestions_improvements` | **Sim** | — |
| Manutenção do sistema | `/maintenance-dashboard` | **Sim** | — |
| Manutenção: Cuidado Pastoral | `maintenance.card.pastoral_care` | **Sim** | **Sim** |
| Manutenção: Modelo Preditivo | `maintenance.card.predictive_insights` | **Sim** | — |
| Manutenção: Mudança de Papéis | `maintenance.card.mudanca_papeis` | **Sim** | **Sim** |
| Meus pedidos pastorais | `/pastoral-history` | **Sim** | **Sim** |

### Tabelas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Categorias pastorais | `pastoral_reason_categories` | **Sim** | — |
| Eventos | `events` | **Sim** | — |
| Famílias | `families` | **Sim** | — |
| Inscrições em eventos | `event_registrations` | **Sim** | **Sim** |
| Lançamentos financeiros | `financials` | **Sim** | — |
| Membros da família | `members` | **Sim** | — |
| Parâmetros do app | `app_parameters` | **Sim** | — |
| Pedidos pastorais | `pastoral_requests` | **Sim** | **Sim** |
| Perfis | `profiles` | **Sim** | **Sim** |
| Relatórios de Despesas | `expense_reports` | **Sim** | **Sim** |
| Subcategorias pastorais | `pastoral_reason_subcategories` | **Sim** | — |
| Tabela — Anexos de suporte | `maintenance_support_attachments` | **Sim** | — |
| Tabela — Atas de assembleias | `maintenance_assembly_minutes` | **Sim** | — |
| Tabela — Comunicações de suporte | `maintenance_support_communications` | **Sim** | — |
| Tabela — Histórico de suporte | `maintenance_support_interactions` | **Sim** | — |
| Tabela — Solicitações de suporte | `maintenance_support_requests` | **Sim** | — |
| Tabela — Temas de suporte | `maintenance_support_themes` | **Sim** | — |
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
| Nome fantasia | `profiles.nome_fantasia` | **Sim** | **Sim** |
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
| Acessos de Usuários | `maintenance.card.profile_access_insights` | **Sim** | **Sim** |
| Cadastro | `/register` | **Sim** | **Sim** |
| Card — Administrativo | `dashboard.card.administrativo` | **Sim** | **Sim** |
| Card Agenda da Família | `dashboard.card.event_alt` | **Sim** | **Sim** |
| Card Aniversariantes | `dashboard.card.birthdays` | **Sim** | **Sim** |
| Card Check In | `dashboard.card.qr` | **Sim** | **Sim** |
| Card Coração Aberto | `dashboard.card.pastoral` | **Sim** | **Sim** |
| Card Dízimos e Ofertas | `dashboard.card.offerings` | **Sim** | **Sim** |
| Card Escalas | `dashboard.card.vigilance_scales` | **Sim** | **Sim** |
| Card Estacionamento | `dashboard.card.parking_vehicle_v2` | **Sim** | **Sim** |
| Card Financeiro (dashboard) | `dashboard.card.financial` | **Sim** | **Sim** |
| Card Lista de Membros | `dashboard.card.members_list` | **Sim** | **Sim** |
| Card Menu | `dashboard.card.grouped_manage` | **Sim** | **Sim** |
| Card SALA(S) | `dashboard.card.kids_teens` | **Sim** | **Sim** |
| Controle de Acesso | `maintenance.card.access_control` | **Sim** | **Sim** |
| Coração Aberto | `/pastoral` | **Sim** | **Sim** |
| Dados cadastrais | `/manage-profile` | **Sim** | **Sim** |
| Dashboard | `/dashboard` | **Sim** | **Sim** |
| Escala: Acolhimento Estacionamento | `scale_type.acolhimento_estacionamento` | **Sim** | **Sim** |
| Escala: Acolhimento Recepção | `scale_type.acolhimento_recepcao` | **Sim** | **Sim** |
| Escala: Escala de Monitores Sala Kids | `scale_type.sala kids` | **Sim** | **Sim** |
| Escala: Escala de Monitores Sala Teens | `scale_type.sala teens` | **Sim** | **Sim** |
| Escala: Escala Ministério  Infantil | `scale_type.sala_kids` | **Sim** | **Sim** |
| Escala: Escala Ministério de Louvor | `scale_type.louvor` | **Sim** | **Sim** |
| Escala: Escala Ministério Jovens | `scale_type.sala_teens` | **Sim** | **Sim** |
| Escala: Ministério De Acolhimento | `scale_type.ministerioacolhimento` | **Sim** | **Sim** |
| Escala: Ministério De Intercessão | `scale_type.ministintersec` | **Sim** | **Sim** |
| Gerenciar família | `/manage-members` | **Sim** | **Sim** |
| LGPD | `/lgpd` | **Sim** | **Sim** |
| Login | `/` | **Sim** | **Sim** |
| Manutenção — Cronograma de eventos | `maintenance.card.events_gantt` | **Sim** | **Sim** |
| Manutenção — Informações financeiras | `maintenance.card.financials` | **Sim** | **Sim** |
| Manutenção — Orquestração do Evento | `maintenance.card.event_orchestration` | **Sim** | **Sim** |
| Manutenção — Programação de eventos | `maintenance.card.events` | **Sim** | **Sim** |
| Manutenção — Relatórios | `maintenance.card.relatorios` | **Sim** | **Sim** |
| Manutenção — Sugestões e Melhorias | `maintenance.card.suggestions_improvements` | **Sim** | **Sim** |
| Manutenção do sistema | `/maintenance-dashboard` | **Sim** | **Sim** |
| Manutenção: Cuidado Pastoral | `maintenance.card.pastoral_care` | **Sim** | **Sim** |
| Manutenção: Modelo Preditivo | `maintenance.card.predictive_insights` | **Sim** | **Sim** |
| Manutenção: Mudança de Papéis | `maintenance.card.mudanca_papeis` | **Sim** | **Sim** |
| Manutenção: Programação de Escalas | `maintenance.card.scales` | **Sim** | **Sim** |
| Manutenção: Servos em Disponibilidade | `maintenance.card.scale_volunteers` | **Sim** | **Sim** |
| Manutenção: Tipos de Escala | `maintenance.card.scale_types` | **Sim** | **Sim** |
| Mapa de geolocalização | `/mapa-geolocalizacao` | **Sim** | **Sim** |
| Meus pedidos pastorais | `/pastoral-history` | **Sim** | **Sim** |
| Modo Ghost (Auditor) | `maintenance.card.auditor` | **Sim** | **Sim** |
| Orquestrador do evento (/admin/orquestrador) | `/admin/orquestrador` | **Sim** | **Sim** |
| Relatório de Despesas (RD) | `/expense-report` | **Sim** | **Sim** |
| Relatórios financeiros (/financial) | `/financial` | **Sim** | **Sim** |
| Todas as telas (curinga) | `*` | **Sim** | **Sim** |

### Tabelas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Categorias pastorais | `pastoral_reason_categories` | **Sim** | **Sim** |
| Eventos | `events` | **Sim** | **Sim** |
| Famílias | `families` | **Sim** | **Sim** |
| Inscrições em eventos | `event_registrations` | **Sim** | **Sim** |
| Lançamentos financeiros | `financials` | **Sim** | **Sim** |
| Membros da família | `members` | **Sim** | **Sim** |
| Parâmetros do app | `app_parameters` | **Sim** | **Sim** |
| Pedidos pastorais | `pastoral_requests` | **Sim** | **Sim** |
| Perfis | `profiles` | **Sim** | **Sim** |
| Registro de escalas | `escalas_log` | **Sim** | **Sim** |
| Relatórios de Despesas | `expense_reports` | **Sim** | **Sim** |
| Subcategorias pastorais | `pastoral_reason_subcategories` | **Sim** | **Sim** |
| Tabela — Anexos de suporte | `maintenance_support_attachments` | **Sim** | **Sim** |
| Tabela — Atas de assembleias | `maintenance_assembly_minutes` | **Sim** | **Sim** |
| Tabela — Comunicações de suporte | `maintenance_support_communications` | **Sim** | **Sim** |
| Tabela — Histórico de suporte | `maintenance_support_interactions` | **Sim** | **Sim** |
| Tabela — Solicitações de suporte | `maintenance_support_requests` | **Sim** | **Sim** |
| Tabela — Temas de suporte | `maintenance_support_themes` | **Sim** | **Sim** |
| Tipos de escala | `tipos_escala` | **Sim** | **Sim** |
| Todas as tabelas (curinga) | `*` | **Sim** | **Sim** |
| Veículos do perfil | `profile_vehicles` | **Sim** | **Sim** |
| Voluntários de escala | `voluntarios_escala` | **Sim** | **Sim** |

### Colunas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Alertas alimentares | `profiles.medical_food_alerts` | **Sim** | **Sim** |
| Bairro | `profiles.address_neighborhood` | **Sim** | **Sim** |
| CEP | `profiles.cep` | **Sim** | **Sim** |
| Cidade | `profiles.address_city` | **Sim** | **Sim** |
| Código família | `profiles.family_id` | **Sim** | **Sim** |
| Complemento | `profiles.address_complement` | **Sim** | **Sim** |
| CPF | `profiles.cpf` | **Sim** | **Sim** |
| E-mail | `profiles.email` | **Sim** | **Sim** |
| Estado | `profiles.address_state` | **Sim** | **Sim** |
| LGPD aceito | `profiles.lgpd_accepted` | **Sim** | **Sim** |
| Nascimento | `profiles.birth_date` | **Sim** | **Sim** |
| Nome completo | `profiles.full_name` | **Sim** | **Sim** |
| Nome fantasia | `profiles.nome_fantasia` | **Sim** | **Sim** |
| Número | `profiles.address_number` | **Sim** | **Sim** |
| Papel no sistema | `profiles.role` | **Sim** | **Sim** |
| Rua | `profiles.address_street` | **Sim** | **Sim** |
| Senha de acesso (PIN) | `profiles.access_pin` | **Sim** | **Sim** |
| Telefone | `profiles.phone` | **Sim** | **Sim** |
| Todas as colunas de profiles (curinga) | `profiles.*` | **Sim** | **Sim** |

---

## Orquestrador de Evento

- **Código:** `orquestrador_evento`
- **Descrição:** Conduz o culto em tempo real: altera a rota ativa no orquestrador e guia os membros conectados

### Telas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Dashboard | `/dashboard` | **Sim** | — |
| Manutenção — Orquestração do Evento | `maintenance.card.event_orchestration` | **Sim** | **Sim** |
| Orquestrador do evento (/admin/orquestrador) | `/admin/orquestrador` | **Sim** | **Sim** |

### Tabelas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Avisos do culto (event_avisos) | `event_avisos` | **Sim** | **Sim** |
| Orquestração do evento (event_control) | `event_control` | **Sim** | **Sim** |

---
