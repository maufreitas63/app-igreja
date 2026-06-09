# Índice da Documentação — App IBN

Documentação completa do **app-igreja** (Igreja Batista Norte) para entrega ao cliente.

Cada **pacote** é um arquivo **autocontido**: o texto integral dos documentos de referência está transcrito dentro do pacote (não é necessário abrir outros arquivos para ler o conteúdo).

**Atualizado em:** 09/06/2026

---

## Pacotes (entrega ao cliente)

| Pacote | Markdown | PDF | Público | Conteúdo integrado |
|--------|----------|-----|---------|-------------------|
| **Índice** | [`INDICE_DOCUMENTACAO.md`](INDICE_DOCUMENTACAO.md) | [`pdfs/INDICE_DOCUMENTACAO.pdf`](pdfs/INDICE_DOCUMENTACAO.pdf) | Todos | Capa e mapa da documentação |
| **1 — Visão geral** | [`PACOTE_1_VISAO_GERAL.md`](PACOTE_1_VISAO_GERAL.md) | [`pdfs/PACOTE_1_VISAO_GERAL.pdf`](pdfs/PACOTE_1_VISAO_GERAL.pdf) | Todos | Funcionalidades + Manual + FAQ |
| **2 — Operação** | [`PACOTE_2_OPERACAO.md`](PACOTE_2_OPERACAO.md) | [`pdfs/PACOTE_2_OPERACAO.pdf`](pdfs/PACOTE_2_OPERACAO.pdf) | Secretaria, líderes | Manutenção + Missão B4 + Card Agenda |
| **3 — Governança e TI** | [`PACOTE_3_GOVERNANCA_TI.md`](PACOTE_3_GOVERNANCA_TI.md) | [`pdfs/PACOTE_3_GOVERNANCA_TI.pdf`](pdfs/PACOTE_3_GOVERNANCA_TI.pdf) | Super admin, TI | ACL + Camadas de segurança + Blueprint |
| **4 — Anexo técnico** | [`PACOTE_4_ANEXO_TECNICO.md`](PACOTE_4_ANEXO_TECNICO.md) | [`pdfs/PACOTE_4_ANEXO_TECNICO.pdf`](pdfs/PACOTE_4_ANEXO_TECNICO.pdf) | TI / arquitetura | Arquitetura PWA + Cards |

---

## Ordem de leitura recomendada

1. `PACOTE_1_VISAO_GERAL.md`
2. `PACOTE_2_OPERACAO.md`
3. `PACOTE_3_GOVERNANCA_TI.md`
4. `PACOTE_4_ANEXO_TECNICO.md` *(opcional)*

---

## Entrega por perfil

| Perfil | Pacotes |
|--------|---------|
| Pastor / diretoria | Pacote 1 |
| Secretaria / eventos | Pacotes 1 + 2 |
| Líder de escala | Pacotes 1 + 2 (Parte 2 — Missão B4) |
| Super administrador / TI | Pacotes 1 + 2 + 3 (+ 4 se necessário) |

---

## Arquivos-fonte (manutenção do repositório)

Os pacotes são gerados a partir dos arquivos abaixo. Para atualizar os pacotes após editar um fonte, execute:

```bash
npm run build:docs:md    # regera PACOTE_*.md a partir dos fontes
npm run build:docs:pdf   # gera PDFs em pdfs/
npm run build:docs       # ambos em sequência
```

| Arquivo-fonte | Usado em |
|---------------|----------|
| `FUNCIONALIDADES.md` | Pacote 1 |
| `MANUAL_TREINAMENTO.md` | Pacote 1 (completo); Pacote 2 (Missão B4) |
| `FAQ.md` | Pacote 1 (completo); Pacote 2 (§17–18) |
| `MANUTENCAO_ECOSISTEMA.md` | Pacote 2 |
| `MANUAL_CARD1_DASHBOARD.md` | Pacote 2 |
| `MANUAL_CONTROLE_ACESSO.md` | Pacote 3 |
| `CONTROLE_ACESSO.md` | Pacote 3 |
| `CAMADAS_SEGURANCA.md` | Pacote 3 |
| `BLUEPRINT.md` | Pacote 3 |
| `ARQUITETURA_BLUEPRINT_PWA.md` | Pacote 4 |
| `DASHBOARD_CARDS.md` | Pacote 4 |

---

## Fora da entrega ao cliente

| Arquivo | Motivo |
|---------|--------|
| `Cópia (1)BLUEPRINT.md` | Cópia descontinuada |
| `AGENTS.md` / `CLAUDE.md` | Regras internas de desenvolvimento |
| `scripts/build-pacotes-md.mjs` | Script de geração dos pacotes |

---

*App IBN · Igreja Batista Norte · Documentação v2026-06-09*
