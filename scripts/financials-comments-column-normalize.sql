-- Padroniza a coluna de observações para "comments" (minúsculo).
-- O Supabase/PostgREST e o app esperam: comments
-- Se a coluna foi criada como "Comments", execute este script uma vez.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'financials'
      and column_name = 'Comments'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'financials'
      and column_name = 'comments'
  ) then
    alter table public.financials rename column "Comments" to comments;
    raise notice 'Coluna "Comments" renomeada para comments.';
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'financials'
      and column_name = 'comments'
  ) then
    raise notice 'Coluna comments já existe; nada a fazer.';
  else
    alter table public.financials add column if not exists comments text;
    raise notice 'Coluna comments criada.';
  end if;
end $$;

comment on column public.financials.comments is 'Observações opcionais do lançamento.';
