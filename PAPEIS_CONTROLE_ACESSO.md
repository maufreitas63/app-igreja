# Mapa visual de papéis — Controle de Acesso

Gerado em: 05/10/2026, 12:30:39
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
| Card Agenda da Família | `dashboard.card.event_alt` | **Sim** | **Sim** |
| Card Check In | `dashboard.card.qr` | **Sim** | — |
| Card Coração Aberto | `dashboard.card.pastoral` | **Sim** | **Sim** |
| Card Dízimos e Ofertas | `dashboard.card.offerings` | **Sim** | — |
| Card Menu | `dashboard.card.grouped_manage` | **Sim** | — |
| Card SALA(S) | `dashboard.card.kids_teens` | **Sim** | — |
| Coração Aberto | `/pastoral` | **Sim** | **Sim** |
| Dados cadastrais | `/manage-profile` | **Sim** | **Sim** |
| Dashboard | `/dashboard` | **Sim** | — |
| Gerenciar família | `/manage-members` | **Sim** | **Sim** |
| LGPD | `/lgpd` | **Sim** | **Sim** |
| Login | `/` | **Sim** | — |
| Menu — Redes Sociais | `menu_redes_sociais` | **Sim** | — |
| Meus pedidos pastorais | `/pastoral-history` | **Sim** | **Sim** |
| Redes Sociais | `/redes-sociais` | **Sim** | **Sim** |

### Tabelas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Categorias pastorais | `pastoral_reason_categories` | **Sim** | — |
| Eventos | `events` | **Sim** | — |
| Inscrições em eventos | `event_registrations` | **Sim** | **Sim** |
| Parâmetros do app | `app_parameters` | **Sim** | — |
| Perfis | `profiles` | **Sim** | **Sim** |
| Subcategorias pastorais | `pastoral_reason_subcategories` | **Sim** | — |

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

## Congregado

- **Código:** `congregado`
- **Descrição:** Participante cadastrado com acesso básico; sem gerência familiar

### Telas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Cadastro | `/register` | **Sim** | **Sim** |
| Card — Campanhas e Projetos | `dashboard.card.campaign` | **Sim** | — |
| Card — Mural de Oportunidades | `dashboard.card.opportunities` | **Sim** | — |
| Card Agenda da Família | `dashboard.card.event_alt` | **Sim** | **Sim** |
| Card Coração Aberto | `dashboard.card.pastoral` | **Sim** | **Sim** |
| Card Dízimos e Ofertas | `dashboard.card.offerings` | **Sim** | — |
| Card Menu | `dashboard.card.grouped_manage` | **Sim** | — |
| Card SALA(S) | `dashboard.card.kids_teens` | **Sim** | — |
| Coração Aberto | `/pastoral` | **Sim** | **Sim** |
| Dados cadastrais | `/manage-profile` | **Sim** | **Sim** |
| Dashboard | `/dashboard` | **Sim** | — |
| Escalas — Solicitar troca autônoma | `scales.allow_swap` | **Sim** | — |
| Gerenciar família | `/manage-members` | **Sim** | — |
| LGPD | `/lgpd` | **Sim** | **Sim** |
| Login | `/` | **Sim** | — |
| Menu — Redes Sociais | `menu_redes_sociais` | **Sim** | — |
| Meus pedidos pastorais | `/pastoral-history` | **Sim** | **Sim** |
| Mural de Generosidade | `dashboard.card.generosity` | **Sim** | — |
| Prímicias | `dashboard.card.primicias` | **Sim** | — |
| Redes Sociais | `/redes-sociais` | **Sim** | **Sim** |
| Tela — Mural de Generosidade | `/mural-generosidade` | **Sim** | — |
| Trilha de Discipulado | `/trilha` | **Sim** | **Sim** |
| Trilha de Discipulado | `/trilha-discipulado` | **Sim** | **Sim** |

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
| Card — Campanhas e Projetos | `dashboard.card.campaign` | **Sim** | — |
| Card — Mural de Oportunidades | `dashboard.card.opportunities` | **Sim** | — |
| Card Agenda da Família | `dashboard.card.event_alt` | **Sim** | **Sim** |
| Card Check In | `dashboard.card.qr` | **Sim** | — |
| Card Coração Aberto | `dashboard.card.pastoral` | **Sim** | **Sim** |
| Card Dízimos e Ofertas | `dashboard.card.offerings` | **Sim** | — |
| Card Estacionamento | `dashboard.card.parking_vehicle_v2` | **Sim** | — |
| Card Financeiro (dashboard) | `dashboard.card.financial` | **Sim** | — |
| Card Menu | `dashboard.card.grouped_manage` | **Sim** | — |
| Card SALA(S) | `dashboard.card.kids_teens` | **Sim** | — |
| Coração Aberto | `/pastoral` | **Sim** | **Sim** |
| Coração Aberto — Agendar atendimento | `dashboard.pastoral.schedule` | **Sim** | **Sim** |
| Dados cadastrais | `/manage-profile` | **Sim** | **Sim** |
| Dashboard | `/dashboard` | **Sim** | — |
| Documentos oficiais | `/documentos-oficiais` | **Sim** | — |
| Escalas — Solicitar troca autônoma | `scales.allow_swap` | **Sim** | — |
| Gerenciar família | `/manage-members` | **Sim** | **Sim** |
| LGPD | `/lgpd` | **Sim** | **Sim** |
| Login | `/` | **Sim** | **Sim** |
| Menu — Redes Sociais | `menu_redes_sociais` | **Sim** | — |
| Meus pedidos pastorais | `/pastoral-history` | **Sim** | **Sim** |
| Mural de Generosidade | `dashboard.card.generosity` | **Sim** | **Sim** |
| Prímicias | `dashboard.card.primicias` | **Sim** | **Sim** |
| Redes Sociais | `/redes-sociais` | **Sim** | **Sim** |
| Relatórios financeiros (/financial) | `/financial` | **Sim** | — |
| Tela — Mural de Generosidade | `/mural-generosidade` | **Sim** | **Sim** |
| Tela — Prímicias | `/primicias` | **Sim** | **Sim** |
| Trilha de Discipulado | `/trilha` | **Sim** | **Sim** |
| Trilha de Discipulado | `/trilha-discipulado` | **Sim** | **Sim** |

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
| Necessidades específicas | `profiles.special_needs` | **Sim** | **Sim** |
| Nome completo | `profiles.full_name` | **Sim** | **Sim** |
| Nome fantasia | `profiles.nome_fantasia` | **Sim** | **Sim** |
| Número | `profiles.address_number` | **Sim** | **Sim** |
| Observações adicionais | `profiles.additional_care_notes` | **Sim** | **Sim** |
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
| Gerenciar família | `/manage-members` | **Sim** | **Sim** |
| Login | `/` | **Sim** | **Sim** |
| Mural de Generosidade | `dashboard.card.generosity` | **Sim** | — |
| Prímicias | `dashboard.card.primicias` | **Sim** | — |
| Tela — Mural de Generosidade | `/mural-generosidade` | **Sim** | — |

---

## Tesoureiro

- **Código:** `tesoureiro`
- **Descrição:** Tesouraria: card financeiro, manutenção financeira, eventos de meses anteriores e RD por mês de referência

### Telas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Card — Campanhas e Projetos | `dashboard.card.campaign` | **Sim** | — |
| Card — Mural de Oportunidades | `dashboard.card.opportunities` | **Sim** | — |
| Card Financeiro (dashboard) | `dashboard.card.financial` | **Sim** | **Sim** |
| Dashboard | `/dashboard` | **Sim** | — |
| Escalas — Solicitar troca autônoma | `scales.allow_swap` | **Sim** | — |
| Gestão de Campanhas | `maintenance.finance.campaigns` | **Sim** | **Sim** |
| Gestão de Prímicias | `maintenance.card.primicias_management` | **Sim** | **Sim** |
| Manutenção | `/maintenance-dashboard` | **Sim** | — |
| Manutenção — Informações financeiras | `maintenance.card.financials` | **Sim** | **Sim** |
| Manutenção — Relatórios | `maintenance.card.relatorios` | **Sim** | — |
| Manutenção: Assistente IA | `maintenance.card.ai_assistant` | **Sim** | — |
| Mural de Generosidade | `dashboard.card.generosity` | **Sim** | — |
| Prímicias | `dashboard.card.primicias` | **Sim** | — |
| Relatórios financeiros (/financial) | `/financial` | **Sim** | **Sim** |
| Tela — Mural de Generosidade | `/mural-generosidade` | **Sim** | — |
| Tela — Prímicias | `/primicias` | **Sim** | — |

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
| Atribuições | `/atribuicoes` | **Sim** | **Sim** |
| Autorização de imagem e voz | `/autorizacao-midia` | **Sim** | **Sim** |
| Card — Campanhas e Projetos | `dashboard.card.campaign` | **Sim** | — |
| Card — Mural de Oportunidades | `dashboard.card.opportunities` | **Sim** | — |
| Card Aniversariantes | `dashboard.card.birthdays` | **Sim** | — |
| Card Lista de Membros | `dashboard.card.members_list` | **Sim** | — |
| Coração Aberto | `/pastoral` | **Sim** | **Sim** |
| Coração Aberto — Agendar atendimento | `dashboard.pastoral.schedule` | **Sim** | — |
| Cuidado Pastoral — Minha Agenda | `maintenance.pastoral.agenda` | **Sim** | **Sim** |
| Dashboard | `/dashboard` | **Sim** | — |
| Escalas — Solicitar troca autônoma | `scales.allow_swap` | **Sim** | **Sim** |
| Gestão de Campanhas | `maintenance.finance.campaigns` | **Sim** | **Sim** |
| Gestão de Prímicias | `maintenance.card.primicias_management` | **Sim** | **Sim** |
| Manutenção | `/maintenance-dashboard` | **Sim** | — |
| Manutenção — Mudança de papéis | `maintenance.card.mudanca_papeis` | **Sim** | **Sim** |
| Manutenção — Mural de Voluntários | `maintenance.volunteer.mural` | **Sim** | **Sim** |
| Manutenção — Relatórios | `maintenance.card.relatorios` | **Sim** | — |
| Manutenção: Assistente IA | `maintenance.card.ai_assistant` | **Sim** | — |
| Manutenção: Cuidado Pastoral | `maintenance.card.pastoral_care` | **Sim** | **Sim** |
| Manutenção: Transferência de Membro | `maintenance.card.transferencia_igreja` | **Sim** | **Sim** |
| Mapa — detalhe do pin | `/mapa-geolocalizacao/detalhe-pin` | **Sim** | — |
| Mapa de geolocalização | `/mapa-geolocalizacao` | **Sim** | — |
| Meus pedidos pastorais | `/pastoral-history` | **Sim** | **Sim** |
| Moderação do Mural | `maintenance.card.generosity_moderation` | **Sim** | **Sim** |
| Mural de Generosidade | `dashboard.card.generosity` | **Sim** | — |
| Prímicias | `dashboard.card.primicias` | **Sim** | — |
| Régua de Acolhimento | `maintenance.card.visitor_followup` | **Sim** | **Sim** |
| Tela — Mural de Generosidade | `/mural-generosidade` | **Sim** | — |
| Tela — Prímicias | `/primicias` | **Sim** | — |
| Temas da Trilha | `maintenance.card.discipleship_themes` | **Sim** | **Sim** |
| Trilha — Reconhecimentos | `/trilha-reconhecimentos` | **Sim** | **Sim** |
| Trilha — Reconhecimentos | `maintenance.card.discipleship_alerts` | **Sim** | **Sim** |
| Trilha de Discipulado | `/trilha` | **Sim** | **Sim** |
| Trilha de Discipulado | `/trilha-discipulado` | **Sim** | **Sim** |
| Visitantes / Cadastro Rápido | `/visitantes-cadastro-rapido` | **Sim** | **Sim** |
| Visitantes / Cadastro Rápido | `dashboard.card.visitor_quick_checkin` | **Sim** | **Sim** |

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
| Necessidades específicas | `profiles.special_needs` | **Sim** | **Sim** |
| Nome completo | `profiles.full_name` | **Sim** | **Sim** |
| Nome fantasia | `profiles.nome_fantasia` | **Sim** | **Sim** |
| Número | `profiles.address_number` | **Sim** | **Sim** |
| Observações adicionais | `profiles.additional_care_notes` | **Sim** | **Sim** |
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
| Aliança — Indicados | `/alianca-indicados` | **Sim** | **Sim** |
| Apoio Mútuo | `dashboard.card.apoio_mutuo` | **Sim** | **Sim** |
| Atribuições | `/atribuicoes` | **Sim** | **Sim** |
| Autorização de imagem e voz | `/autorizacao-midia` | **Sim** | **Sim** |
| Cadastro | `/register` | **Sim** | **Sim** |
| Cantinho da Leitura | `/cantinho-leitura` | **Sim** | — |
| Card — Administrativo | `dashboard.card.administrativo` | **Sim** | **Sim** |
| Card — Campanhas e Projetos | `dashboard.card.campaign` | **Sim** | **Sim** |
| Card — Mural de Oportunidades | `dashboard.card.opportunities` | **Sim** | **Sim** |
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
| Card Pequeno Grupo | `dashboard.card.small_group` | **Sim** | **Sim** |
| Card SALA(S) | `dashboard.card.kids_teens` | **Sim** | **Sim** |
| Configuração de salas | `/configuracao-salas` | **Sim** | **Sim** |
| Controle de Acesso | `maintenance.card.access_control` | **Sim** | **Sim** |
| Coração Aberto | `/pastoral` | **Sim** | **Sim** |
| Coração Aberto — Agendar atendimento | `dashboard.pastoral.schedule` | **Sim** | **Sim** |
| Cuidado Pastoral — Minha Agenda | `maintenance.pastoral.agenda` | **Sim** | **Sim** |
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
| Escala: Ministério Infantil | `scale_type.ministerio_infantil` | **Sim** | **Sim** |
| Escalas — Solicitar troca autônoma | `scales.allow_swap` | **Sim** | **Sim** |
| Gerenciar família | `/manage-members` | **Sim** | **Sim** |
| Gestão de Campanhas | `maintenance.finance.campaigns` | **Sim** | **Sim** |
| Gestão de Pequenos Grupos | `maintenance.card.small_groups_management` | **Sim** | **Sim** |
| Gestão de Prímicias | `maintenance.card.primicias_management` | **Sim** | **Sim** |
| LGPD | `/lgpd` | **Sim** | **Sim** |
| Livros doados | `/livros-doados` | **Sim** | **Sim** |
| Login | `/` | **Sim** | **Sim** |
| Manutenção | `/maintenance-dashboard` | **Sim** | **Sim** |
| Manutenção — Cadastro / Recepção familiar | `maintenance.card.profile_cadastro` | **Sim** | **Sim** |
| Manutenção — Cronograma de eventos | `maintenance.card.events_gantt` | **Sim** | **Sim** |
| Manutenção — Informações financeiras | `maintenance.card.financials` | **Sim** | **Sim** |
| Manutenção — Insights preditivos | `maintenance.card.predictive_insights` | **Sim** | **Sim** |
| Manutenção — Mudança de papéis | `maintenance.card.mudanca_papeis` | **Sim** | **Sim** |
| Manutenção — Mural de Voluntários | `maintenance.volunteer.mural` | **Sim** | **Sim** |
| Manutenção — Orquestração do Evento | `maintenance.card.event_orchestration` | **Sim** | **Sim** |
| Manutenção — Programação de eventos | `maintenance.card.events` | **Sim** | **Sim** |
| Manutenção — Relatórios | `maintenance.card.relatorios` | **Sim** | **Sim** |
| Manutenção — Servidor de salas | `maintenance.card.sala_servidor` | **Sim** | **Sim** |
| Manutenção — Sugestões e Melhorias | `maintenance.card.suggestions_improvements` | **Sim** | **Sim** |
| Manutenção: Assistente IA | `maintenance.card.ai_assistant` | **Sim** | — |
| Manutenção: Auditoria IA | `maintenance.card.ai_audit_logs` | **Sim** | — |
| Manutenção: Cuidado Pastoral | `maintenance.card.pastoral_care` | **Sim** | **Sim** |
| Manutenção: Programação de Escalas | `maintenance.card.scales` | **Sim** | **Sim** |
| Manutenção: Servos em Disponibilidade | `maintenance.card.scale_volunteers` | **Sim** | **Sim** |
| Manutenção: Tipos de Escala | `maintenance.card.scale_types` | **Sim** | **Sim** |
| Manutenção: Transferência de Membro | `maintenance.card.transferencia_igreja` | **Sim** | **Sim** |
| Mapa — detalhe do pin | `/mapa-geolocalizacao/detalhe-pin` | **Sim** | **Sim** |
| Mapa de geolocalização | `/mapa-geolocalizacao` | **Sim** | **Sim** |
| Menu — Indicados Aliança | `menu_alianca_indicados` | **Sim** | **Sim** |
| Menu — Redes Sociais | `menu_redes_sociais` | **Sim** | **Sim** |
| Meus pedidos pastorais | `/pastoral-history` | **Sim** | **Sim** |
| Moderação do Mural | `maintenance.card.generosity_moderation` | **Sim** | **Sim** |
| Modo Ghost (Auditor) | `maintenance.card.auditor` | **Sim** | **Sim** |
| Mural de Generosidade | `dashboard.card.generosity` | **Sim** | **Sim** |
| Ofereço meus Serviços | `/ofereco-servicos` | **Sim** | — |
| Orquestrador do evento | `/admin/orquestrador` | **Sim** | **Sim** |
| Presença | `maintenance.card.quorum_presence` | **Sim** | **Sim** |
| Prímicias | `dashboard.card.primicias` | **Sim** | **Sim** |
| Redes Sociais | `/redes-sociais` | **Sim** | **Sim** |
| Régua de Acolhimento | `maintenance.card.visitor_followup` | **Sim** | **Sim** |
| Relatório de Despesas (RD) | `/expense-report` | **Sim** | **Sim** |
| Relatórios financeiros (/financial) | `/financial` | **Sim** | **Sim** |
| Resetar Trilha | `maintenance.card.discipleship_reset` | **Sim** | **Sim** |
| Sugestões | `/suggestions-improvements` | **Sim** | **Sim** |
| Tela — Apoio Mútuo | `/apoio-mutuo` | **Sim** | **Sim** |
| Tela — Mural de Generosidade | `/mural-generosidade` | **Sim** | **Sim** |
| Tela — Prímicias | `/primicias` | **Sim** | **Sim** |
| Temas da Trilha | `maintenance.card.discipleship_themes` | **Sim** | **Sim** |
| Todas as telas (curinga) | `*` | **Sim** | **Sim** |
| Totem de check-in | `/totem-checkin` | **Sim** | **Sim** |
| Trilha — Reconhecimentos | `/trilha-reconhecimentos` | **Sim** | **Sim** |
| Trilha — Reconhecimentos | `maintenance.card.discipleship_alerts` | **Sim** | **Sim** |
| Trilha de Discipulado | `/trilha` | **Sim** | **Sim** |
| Trilha de Discipulado | `/trilha-discipulado` | **Sim** | **Sim** |
| Visitantes / Cadastro Rápido | `/visitantes-cadastro-rapido` | **Sim** | **Sim** |
| Visitantes / Cadastro Rápido | `dashboard.card.visitor_quick_checkin` | **Sim** | **Sim** |

### Tabelas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Atribuição de membros às salas | `user_room_assignment` | **Sim** | **Sim** |
| Categorias pastorais | `pastoral_reason_categories` | **Sim** | **Sim** |
| Configuração de salas | `church_room_settings` | **Sim** | **Sim** |
| Empréstimos de livros | `emprestimos_livros` | **Sim** | **Sim** |
| Eventos | `events` | **Sim** | **Sim** |
| Famílias | `families` | **Sim** | **Sim** |
| Inscrições em eventos | `event_registrations` | **Sim** | **Sim** |
| Lançamentos financeiros | `financials` | **Sim** | **Sim** |
| Livros doados | `livros` | **Sim** | **Sim** |
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
| Necessidades específicas | `profiles.special_needs` | **Sim** | **Sim** |
| Nome completo | `profiles.full_name` | **Sim** | **Sim** |
| Nome fantasia | `profiles.nome_fantasia` | **Sim** | **Sim** |
| Número | `profiles.address_number` | **Sim** | **Sim** |
| Observações adicionais | `profiles.additional_care_notes` | **Sim** | **Sim** |
| Papel no sistema | `profiles.role` | **Sim** | **Sim** |
| Rua | `profiles.address_street` | **Sim** | **Sim** |
| Senha de acesso (PIN) | `profiles.access_pin` | **Sim** | **Sim** |
| Telefone | `profiles.phone` | **Sim** | **Sim** |
| Todas as colunas de profiles (curinga) | `profiles.*` | **Sim** | **Sim** |

---

## Gestor em Controle de Acesso

- **Código:** `gestor_controle_acesso`
- **Descrição:** Gestão operacional de eventos, escalas, presença, cadastro/recepção, salas, avisos, relatórios e ACL — sem visibilidade do Super Administrador

### Telas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Card — Mural de Oportunidades | `dashboard.card.opportunities` | **Sim** | — |
| Configuração de salas | `/configuracao-salas` | **Sim** | **Sim** |
| Controle de Acesso | `maintenance.card.access_control` | **Sim** | **Sim** |
| Dashboard | `/dashboard` | **Sim** | — |
| Escalas — Solicitar troca autônoma | `scales.allow_swap` | **Sim** | **Sim** |
| Gestão de Campanhas | `maintenance.finance.campaigns` | **Sim** | — |
| Manutenção | `/maintenance-dashboard` | **Sim** | **Sim** |
| Manutenção — Cadastro / Recepção familiar | `maintenance.card.profile_cadastro` | **Sim** | **Sim** |
| Manutenção — Cronograma de eventos | `maintenance.card.events_gantt` | **Sim** | **Sim** |
| Manutenção — Insights preditivos | `maintenance.card.predictive_insights` | **Sim** | **Sim** |
| Manutenção — Mudança de papéis | `maintenance.card.mudanca_papeis` | **Sim** | **Sim** |
| Manutenção — Mural de Voluntários | `maintenance.volunteer.mural` | **Sim** | **Sim** |
| Manutenção — Orquestração do Evento | `maintenance.card.event_orchestration` | **Sim** | **Sim** |
| Manutenção — Programação de eventos | `maintenance.card.events` | **Sim** | **Sim** |
| Manutenção — Relatórios | `maintenance.card.relatorios` | **Sim** | **Sim** |
| Manutenção — Servidor de salas | `maintenance.card.sala_servidor` | **Sim** | **Sim** |
| Manutenção: Assistente IA | `maintenance.card.ai_assistant` | **Sim** | — |
| Manutenção: Programação de Escalas | `maintenance.card.scales` | **Sim** | **Sim** |
| Manutenção: Servos em Disponibilidade | `maintenance.card.scale_volunteers` | **Sim** | **Sim** |
| Manutenção: Tipos de Escala | `maintenance.card.scale_types` | **Sim** | **Sim** |
| Menu — Redes Sociais | `menu_redes_sociais` | **Sim** | — |
| Mural de Generosidade | `dashboard.card.generosity` | **Sim** | — |
| Presença | `maintenance.card.quorum_presence` | **Sim** | **Sim** |
| Prímicias | `dashboard.card.primicias` | **Sim** | — |
| Redes Sociais | `/redes-sociais` | **Sim** | **Sim** |
| Régua de Acolhimento | `maintenance.card.visitor_followup` | **Sim** | **Sim** |
| Tela — Mural de Generosidade | `/mural-generosidade` | **Sim** | — |
| Tela — Prímicias | `/primicias` | **Sim** | — |

### Tabelas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Atribuição de membros às salas | `user_room_assignment` | **Sim** | **Sim** |
| Avisos do culto (event_avisos) | `event_avisos` | **Sim** | **Sim** |
| Configuração de salas | `church_room_settings` | **Sim** | **Sim** |
| Empréstimos de livros | `emprestimos_livros` | **Sim** | **Sim** |
| Escalas | `scales` | **Sim** | **Sim** |
| Eventos | `events` | **Sim** | **Sim** |
| Inscrições em eventos | `event_registrations` | **Sim** | **Sim** |
| Livros doados | `livros` | **Sim** | **Sim** |
| Tipos de escala | `scale_types` | **Sim** | **Sim** |
| Voluntários de escala | `scale_volunteers` | **Sim** | **Sim** |

---

## Secretaria

- **Código:** `secretaria`
- **Descrição:** Operação da igreja: eventos, orquestração, escalas, salas, totem, células, recepção, avisos, trilha (temas), murais e campanhas. Sem Cuidado Pastoral nem tesouraria global.

### Telas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Autorização de imagem e voz | `/autorizacao-midia` | **Sim** | **Sim** |
| Cadastro | `/register` | **Sim** | **Sim** |
| Card — Administrativo | `dashboard.card.administrativo` | **Sim** | — |
| Card — Campanhas e Projetos | `dashboard.card.campaign` | **Sim** | — |
| Card — Mural de Oportunidades | `dashboard.card.opportunities` | **Sim** | — |
| Card Agenda da Família | `dashboard.card.event_alt` | **Sim** | **Sim** |
| Card Aniversariantes | `dashboard.card.birthdays` | **Sim** | — |
| Card Check In | `dashboard.card.qr` | **Sim** | — |
| Card Coração Aberto | `dashboard.card.pastoral` | **Sim** | **Sim** |
| Card Dízimos e Ofertas | `dashboard.card.offerings` | **Sim** | — |
| Card Escalas | `dashboard.card.vigilance_scales` | **Sim** | — |
| Card Estacionamento | `dashboard.card.parking_vehicle_v2` | **Sim** | — |
| Card Lista de Membros | `dashboard.card.members_list` | **Sim** | — |
| Card Menu | `dashboard.card.grouped_manage` | **Sim** | — |
| Card SALA(S) | `dashboard.card.kids_teens` | **Sim** | **Sim** |
| Configuração de salas | `/configuracao-salas` | **Sim** | **Sim** |
| Coração Aberto | `/pastoral` | **Sim** | **Sim** |
| Coração Aberto — Agendar atendimento | `dashboard.pastoral.schedule` | **Sim** | — |
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
| Escala: Ministério Infantil | `scale_type.ministerio_infantil` | **Sim** | **Sim** |
| Escalas — Solicitar troca autônoma | `scales.allow_swap` | **Sim** | **Sim** |
| Gerenciar família | `/manage-members` | **Sim** | **Sim** |
| Gestão de Campanhas | `maintenance.finance.campaigns` | **Sim** | **Sim** |
| Gestão de Prímicias | `maintenance.card.primicias_management` | **Sim** | **Sim** |
| LGPD | `/lgpd` | **Sim** | **Sim** |
| Login | `/` | **Sim** | **Sim** |
| Manutenção | `/maintenance-dashboard` | **Sim** | **Sim** |
| Manutenção — Cadastro / Recepção familiar | `maintenance.card.profile_cadastro` | **Sim** | **Sim** |
| Manutenção — Cronograma de eventos | `maintenance.card.events_gantt` | **Sim** | **Sim** |
| Manutenção — Mural de Voluntários | `maintenance.volunteer.mural` | **Sim** | **Sim** |
| Manutenção — Orquestração do Evento | `maintenance.card.event_orchestration` | **Sim** | **Sim** |
| Manutenção — Programação de eventos | `maintenance.card.events` | **Sim** | **Sim** |
| Manutenção — Relatórios | `maintenance.card.relatorios` | **Sim** | — |
| Manutenção — Servidor de salas | `maintenance.card.sala_servidor` | **Sim** | **Sim** |
| Manutenção: Programação de Escalas | `maintenance.card.scales` | **Sim** | **Sim** |
| Manutenção: Servos em Disponibilidade | `maintenance.card.scale_volunteers` | **Sim** | **Sim** |
| Manutenção: Tipos de Escala | `maintenance.card.scale_types` | **Sim** | **Sim** |
| Mapa de geolocalização | `/mapa-geolocalizacao` | **Sim** | — |
| Menu — Redes Sociais | `menu_redes_sociais` | **Sim** | — |
| Moderação do Mural | `maintenance.card.generosity_moderation` | **Sim** | **Sim** |
| Mural de Generosidade | `dashboard.card.generosity` | **Sim** | **Sim** |
| Orquestrador do evento | `/admin/orquestrador` | **Sim** | **Sim** |
| Presença | `maintenance.card.quorum_presence` | **Sim** | **Sim** |
| Prímicias | `dashboard.card.primicias` | **Sim** | — |
| Redes Sociais | `/redes-sociais` | **Sim** | **Sim** |
| Régua de Acolhimento | `maintenance.card.visitor_followup` | **Sim** | **Sim** |
| Tela — Mural de Generosidade | `/mural-generosidade` | **Sim** | **Sim** |
| Tela — Prímicias | `/primicias` | **Sim** | — |
| Temas da Trilha | `maintenance.card.discipleship_themes` | **Sim** | **Sim** |
| Totem de check-in | `/totem-checkin` | **Sim** | **Sim** |
| Trilha — Reconhecimentos | `maintenance.card.discipleship_alerts` | **Sim** | **Sim** |
| Trilha de Discipulado | `/trilha` | **Sim** | **Sim** |
| Trilha de Discipulado | `/trilha-discipulado` | **Sim** | **Sim** |
| Visitantes / Cadastro Rápido | `/visitantes-cadastro-rapido` | **Sim** | **Sim** |
| Visitantes / Cadastro Rápido | `dashboard.card.visitor_quick_checkin` | **Sim** | **Sim** |

### Tabelas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Atribuição de membros às salas | `user_room_assignment` | **Sim** | **Sim** |
| Avisos do culto (event_avisos) | `event_avisos` | **Sim** | **Sim** |
| Configuração de salas | `church_room_settings` | **Sim** | **Sim** |
| Empréstimos de livros | `emprestimos_livros` | **Sim** | **Sim** |
| Eventos | `events` | **Sim** | **Sim** |
| Famílias | `families` | **Sim** | — |
| Inscrições em eventos | `event_registrations` | **Sim** | **Sim** |
| Livros doados | `livros` | **Sim** | **Sim** |
| Membros da família | `members` | **Sim** | **Sim** |
| Orquestração do evento (event_control) | `event_control` | **Sim** | **Sim** |
| Parâmetros do app | `app_parameters` | **Sim** | — |
| Pedidos pastorais | `pastoral_requests` | **Sim** | **Sim** |
| Pequenos grupos | `small_groups` | **Sim** | **Sim** |
| Perfis | `profiles` | **Sim** | **Sim** |
| Registro de escalas | `escalas_log` | **Sim** | **Sim** |
| Relatórios de Despesas | `expense_reports` | **Sim** | **Sim** |
| Tabela — Anexos de suporte | `maintenance_support_attachments` | **Sim** | — |
| Tabela — Atas de assembleias | `maintenance_assembly_minutes` | **Sim** | **Sim** |
| Tabela — Comunicações de suporte | `maintenance_support_communications` | **Sim** | — |
| Tabela — Histórico de suporte | `maintenance_support_interactions` | **Sim** | — |
| Tabela — Solicitações de suporte | `maintenance_support_requests` | **Sim** | — |
| Tabela — Temas de suporte | `maintenance_support_themes` | **Sim** | — |
| Tipos de escala | `tipos_escala` | **Sim** | **Sim** |
| Veículos do perfil | `profile_vehicles` | **Sim** | **Sim** |
| Voluntários de escala | `voluntarios_escala` | **Sim** | **Sim** |

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
| Necessidades específicas | `profiles.special_needs` | **Sim** | **Sim** |
| Nome completo | `profiles.full_name` | **Sim** | **Sim** |
| Nome fantasia | `profiles.nome_fantasia` | **Sim** | **Sim** |
| Número | `profiles.address_number` | **Sim** | **Sim** |
| Observações adicionais | `profiles.additional_care_notes` | **Sim** | **Sim** |
| Rua | `profiles.address_street` | **Sim** | **Sim** |
| Telefone | `profiles.phone` | **Sim** | **Sim** |

---

## Acolhimento Recepção

- **Código:** `acolhimento_recepcao`
- **Descrição:** Operação de acolhimento na recepção: cadastro rápido e check-in de visitantes.

### Telas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Visitantes / Cadastro Rápido | `/visitantes-cadastro-rapido` | **Sim** | **Sim** |
| Visitantes / Cadastro Rápido | `dashboard.card.visitor_quick_checkin` | **Sim** | **Sim** |

---

## Acolhimento Estacionamento

- **Código:** `acolhimento_estacionamento`
- **Descrição:** Operação de acolhimento no estacionamento: cadastro rápido e check-in de visitantes.

### Telas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Visitantes / Cadastro Rápido | `/visitantes-cadastro-rapido` | **Sim** | **Sim** |
| Visitantes / Cadastro Rápido | `dashboard.card.visitor_quick_checkin` | **Sim** | **Sim** |

---

## Escala Ministério Infantil

- **Código:** `ministerio_infantil`
- **Descrição:** Servos do ministério infantil: cadastro rápido e check-in de visitantes nas salas.

### Telas

| Nome | Chave técnica | Ver | Editar |
| --- | --- | :---: | :---: |
| Visitantes / Cadastro Rápido | `/visitantes-cadastro-rapido` | **Sim** | **Sim** |
| Visitantes / Cadastro Rápido | `dashboard.card.visitor_quick_checkin` | **Sim** | **Sim** |

---
