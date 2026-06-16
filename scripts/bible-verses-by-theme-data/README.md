# Versículos por tema — execução no Supabase

Execute **nesta ordem** no SQL Editor:

1. `../bible-verses-by-theme.sql` — cria tabelas, view e RPC (só na 1ª vez)
2. `../bible-verses-by-theme-clear.sql` — **limpa todos os dados** (temas e versículos)
3. `00-truncate-themes.sql` — insere os 161 temas
4. `01-verses-part-01.sql`
5. `02-verses-part-02.sql`
6. `03-verses-part-03.sql`
7. `04-verses-part-04.sql`
8. `05-verses-part-05.sql`
9. `06-verses-part-06.sql`
10. `07-verses-part-07.sql`
11. `08-verses-part-08.sql`
12. `09-verses-part-09.sql`
13. `10-verses-part-10.sql`
14. `11-verses-part-11.sql`
15. `12-verses-part-12.sql`
16. `13-verses-part-13.sql`
17. `14-verses-part-14.sql`

**Não** execute `import-dailyverses-themes.mjs` no Supabase (é JavaScript).

Arquivos gerados por `node scripts/split-bible-verses-sql.mjs`.
Fonte: -- Themes: 161, Verses: 5247

## Aplicação automática (terminal)

1. Crie `.env.local` na raiz com `SUPABASE_DATABASE_URL` (URI do Postgres no Supabase).
2. `npm install`
3. `npm run apply:bible-verses`

Opções: `--schema-only`, `--data-only`, `--dry-run`.
