# Scripts SQL pendentes (Supabase)

Execute **manualmente** no SQL Editor do Supabase, **nesta ordem**:

1. `scripts/members-list-active-membership-out.sql`  
   — Exclui perfis com `membership_out` das listas, mapa e diretórios.

2. `scripts/events-somente-membros.sql`  
   — Habilita o toggle **Somente Membros** nos eventos.

Opcional:

- `scripts/import-profiles-membership-out-visitors.sql` — perfis de teste importados da planilha.

Sem o passo 1, a lista de membros no dashboard continua mostrando desligados.  
Sem o passo 2, o toggle Somente Membros na manutenção não persiste.
