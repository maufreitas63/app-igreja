# Multi-tenancy — onboarding da 2ª igreja

Pré-requisito: IBN validada (passos 01–07) + **passo 09/10** (sessão multi-tenant).

## Preferido: pelo aplicativo

1. Execute no Supabase (SQL Editor), nesta ordem:
   - `scripts/multi-tenant-09-active-tenant-header.sql`
   - `scripts/multi-tenant-10-onboard-igreja-rpc.sql`
2. Hard refresh no app e entre com o **mesmo celular** do super_admin
3. Menu lateral → **Instâncias (Igrejas)**
4. Informe código (ex. `IBC`) e nome → **Criar instância**
5. Toque na nova igreja para **ativar** (ou use `/selecionar-igreja` no próximo login se houver 2+)

O mesmo telefone continua em **um** `profiles.id`. O super_admin lista todas as igrejas; ao ativar uma, a sessão envia `x-tenant-id`.

## Alternativa: SQL manual

Arquivo: `scripts/multi-tenant-08-onboard-igreja.sql` (editar CONFIG → executar).

## Limitações

- Usuários comuns só veem igrejas com vínculo em `profile_igreja_vinculos`
- Login por telefone resolve **um** profile; multi-igreja = múltiplos vínculos (ou super_admin)
- Após criar, cadastre tipos de escala / categorias pastorais na nova instância
