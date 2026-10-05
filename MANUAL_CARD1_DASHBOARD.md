# Manual — Agenda da Família (Início)

**Pacotes:** [`PACOTE_5_MANUAL_PAINEL.md`](PACOTE_5_MANUAL_PAINEL.md) (membro) · [`PACOTE_2_OPERACAO.md`](PACOTE_2_OPERACAO.md) (operação) · **Índice:** [`INDICE_DOCUMENTACAO.md`](INDICE_DOCUMENTACAO.md)

**Atualizado em:** 05/10/2026

> O antigo **Card 1** do carrossel `/(tabs)/dashboard` está **congelado** e fora da publicação. A experiência publicada é **Início** (`/(tabs)`) → toque em **Próximos Eventos** → modal **Agenda da Família** (`FamilyAgendaModal`).

## Objetivo

Concentrar, em um único fluxo a partir do Início, a seleção do evento, a visualização de vagas e o registro da audiência da família — incluindo integração com geofence, totem, salas Kids/Teens, Google Agenda e arquivo `.ics`.

Este fluxo permite:

- escolher o culto ou evento a partir da lista publicada no Início;
- verificar data, horário e local;
- identificar selos de salas (**Kids** / **Teens**) quando o evento as habilita;
- acompanhar ocupação de vagas (quando o evento tem capacidade);
- registrar ou remover individualmente integrantes do núcleo familiar;
- marcar ou desmarcar todos de uma vez (quando permitido);
- adicionar o compromisso ao **Google Agenda** ou baixar **`.ics`** (Apple Calendar / Outlook), no fuso da igreja (`America/Sao_Paulo`).

## Estrutura do modal

### 1. Evento selecionado

- nome do evento;
- data e horário;
- local;
- indicadores de salas, quando aplicável.

Se nenhum evento estiver selecionado, a mensagem orienta a escolher um item em **Próximos Eventos** no Início.

### 2. Vagas

Quando o evento possui `max_capacity`:

- vagas restantes;
- relação inscritos / total;
- indicador visual de ocupação.

Eventos sem capacidade definida não exibem contador de copo — a audiência continua disponível.

### 3. Trocar evento

Lista eventos ativos (hoje e futuros, desbloqueados). Ao tocar:

1. o evento passa a ser o contexto da audiência;
2. vagas e selos são recalculados;
3. check-in (geofence/totem) passa a referir-se a esse evento.

### 4. Audiência

Integrantes elegíveis do núcleo (**membro** / **congregado** e dependentes reconhecidos). Cada linha tem checkbox; inscritos exibem confirmação visual. Modo **quórum** restringe marcação individual após confirmação no totem.

## Como usar

### Registrar participantes

1. Abra **Início** (`/(tabs)`).
2. Toque no evento em **Próximos Eventos**.
3. No modal, confira evento, local e horário; troque de evento se necessário.
4. Marque os integrantes na **Audiência** (ou use o checkbox geral).
5. Aceite **Adicionar** no diálogo de agenda para Google Agenda / `.ics`.

**Resultado esperado:** pré-check-in registrado; vagas atualizadas; geofence e totem reconhecem a audiência no dia do evento.

### Remover participantes

Desmarque o checkbox do integrante (respeitando travas de quórum e check-in já confirmado).

## Regras de funcionamento

### Eventos exibidos no Início

- eventos do dia e futuros, publicados e não bloqueados (`is_locked`);
- filtrados por visibilidade e tenant da igreja ativa.

### Geofence e totem

- **Geofence:** exige audiência prévia, local favorito com coordenadas, flag `geofence_ativo` e parâmetros de raio/janela.
- **Totem:** confirma quem já está na audiência; QR/carteirinha em **Perfil**.

### Modo Ghost

Com auditoria ativa, família, telefone e permissões seguem o **perfil-alvo**; o operador real não substitui o alvo na audiência.

## Integração operacional (engrenagem)

| Necessidade | Onde configurar |
|-------------|-----------------|
| Criar/editar evento, capacidade, salas, geofence | **Programação de Eventos** |
| Coordenadas do templo | **Locais favoritos** / `event_local` |
| Presença oficial / quórum | **Presença** |
| Check-in no hall | **Totem de check-in** |

## Mensagens comuns

- Erro ao carregar evento / família não vinculada
- Selecione um evento para registrar participantes
- Carregando participantes já registrados…

## Resumo operacional

1. Publicar evento na engrenagem.
2. Membro abre **Início** e toca no evento.
3. Marca audiência da família.
4. No culto: geofence e/ou totem confirmam presença conforme regras do evento.

*Não treinar o carrossel legado do Painel — use sempre Início + Agenda da Família.*
