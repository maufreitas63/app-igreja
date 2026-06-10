# TstMax — Carga massiva de testes

Script: [`scripts/tstmax-massive-seed.sql`](scripts/tstmax-massive-seed.sql)

**Atualizado em:** 10/06/2026

---

## Objetivo

Popular o Supabase com dados **fictícios** e **interligados** para teste integrado:

- **Mínimo 80 pessoas** (94 membros na carga padrão)
- **30 famílias** (`TstMaxF001` … `TstMaxF030`) com tamanhos variados (1 a 4 membros)
- **20 individuais** (`TstMaxI001` … `TstMaxI020`) — sem filhos
- **CEPs** distribuídos entre **Caraguatatuba**, **Ubatuba** e **São Sebastião** (SP)
- Sem alterar `financials` nem dados fora do prefixo TstMax

---

## Como executar

**Opção A — terminal (recomendado):**

```bash
node scripts/run-tstmax-seed.mjs
```

Usa a API REST/RPC do projeto `bldbrsuiwctoaxzcrjoc` (não precisa de senha do banco).

**Opção B — SQL Editor do Supabase:**

1. Executar `scripts/tstmax-massive-seed.sql`
2. Conferir contagens no final (inclui `pessoas_members` e distribuição por cidade)

Reexecutável: limpa só dados `TstMax%` e recria.

**Remover todos os dados TstMax (sem recriar):**

```bash
-- SQL Editor do Supabase:
scripts/tstmax-purge-all.sql
```

---

## População (padrão)

| Tipo | Quantidade | Código | Pessoas |
|------|------------|--------|---------|
| Famílias | 30 | `TstMaxF001`–`TstMaxF030` | 74 membros |
| Individuais | 20 | `TstMaxI001`–`TstMaxI020` | 20 membros |
| **Total** | 50 unidades | — | **94** |

### Lista de membros no app

A lista usa a RPC `list_profiles_members_directory`, que **exclui perfis sem papel ACL** (tratados como visitante). O seed atribui automaticamente o papel **`member`** a todos os perfis `TstMax%`.

### Composição das famílias (exemplos)

| Situação | Onde |
|----------|------|
| Só representante (sem filhos) | Famílias com tamanho 1 |
| Filhos KIDS / TEENS | Membros pares/ímpares no loop |
| KIDS + TEENS na mesma família | Famílias tamanho ≥ 3 |
| Cônjuge | Famílias tamanho 2 quando `F%5=0` |
| Membro pendente (`accepted=false`) | `TstMaxF006` último membro |

### Cidades (rotação)

| Cidade | CEP (faixa) | Famílias (ex.) |
|--------|-------------|----------------|
| Caraguatatuba | `11660-xxx` | F001, F004, F007… |
| Ubatuba | `11680-xxx` | F002, F005, F008… |
| São Sebastião | `11600-xxx` | F003, F006, F009… |

Individuais alternam as três cidades (`11660-2xx`, `11680-2xx`, `11600-2xx`).

---

## Login de teste (amostra)

| Perfil | family_id | PIN |
|--------|-----------|-----|
| 1ª família | `TstMaxF001` | `1001` |
| 3ª família (teen) | `TstMaxF003` | `1003` |
| 10º individual | `TstMaxI010` | `3010` |

Celulares: famílias `1299000xxxxx`; individuais `12990050xxx`.

---

## Eventos, escalas, pastoral

- 6 eventos TstMax (totem/quórum/kids/teens + 2 no mesmo dia)
- Inscrições no evento principal para todos os membros aceitos
- Totem confirmado: `TstMaxF001`, `TstMaxF004`, `TstMaxF010`, `TstMaxI005`
- Escalas `tstmax_vigilancia` (equipe) e `tstmax_intercessao` (individual)
- 2 pedidos pastorais (amostra F001 e F003)

---

## O que NÃO é alterado

- `financials` e lançamentos existentes
- Contador `last_family_id` / `reserve_next_family_id()` (IDs manuais `TstMaxF*` / `TstMaxI*`)

---

## Testes sugeridos

1. **Mapa** — pins nas três cidades após geocodificar CEPs
2. **Lista de membros** — 92 registros `accepted=true` (exceto pendente F006)
3. **Agenda** — KIDS/TEENS por idade no evento principal
4. **Login em massa** — PINs `1001`–`1030` e `3001`–`3020`
