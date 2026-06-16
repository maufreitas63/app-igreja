# Versículos por tema — execução no Supabase

Execute **nesta ordem** no SQL Editor:

1. `../bible-verses-by-theme.sql` — cria tabelas, view e RPC (só na 1ª vez)
2. `00-truncate-themes.sql` — limpa e insere os 161 temas
3. `01-verses-part-01.sql`
4. `02-verses-part-02.sql`
5. `03-verses-part-03.sql`
6. `04-verses-part-04.sql`
7. `05-verses-part-05.sql`
8. `06-verses-part-06.sql`
9. `07-verses-part-07.sql`
10. `08-verses-part-08.sql`
11. `09-verses-part-09.sql`
12. `10-verses-part-10.sql`
13. `11-verses-part-11.sql`
14. `12-verses-part-12.sql`
15. `13-verses-part-13.sql`
16. `14-verses-part-14.sql`

**Não** execute `import-dailyverses-themes.mjs` no Supabase (é JavaScript).

Arquivos gerados por `node scripts/split-bible-verses-sql.mjs`.
Fonte: -- Themes: 161, Verses: 5247

## Aplicação automática (terminal)

1. Crie `.env.local` na raiz com `SUPABASE_DATABASE_URL` (URI do Postgres no Supabase).
2. `npm install`
3. `npm run apply:bible-verses`

Opções: `--schema-only`, `--data-only`, `--dry-run`.
