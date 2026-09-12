-- Catálogos separados: menu do membro vs engrenagem (manutenção).
-- Ghost continua fora dos dois catálogos.
-- Execute: npx supabase db query --linked -f scripts/knowledge-base-split-catalogs.sql

drop function if exists public.list_knowledge_articles(text);

create or replace function public.list_knowledge_articles(
  p_query text default null,
  p_catalog text default 'member'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile uuid := public.current_session_profile_id();
  v_tenant uuid;
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
  v_catalog text := lower(btrim(coalesce(p_catalog, 'member')));
  v_member_keys text[] := array[
    'home',
    'login',
    'sair',
    '/perfil',
    '/ofertas',
    '/pastoral',
    '/escalas',
    '/financial',
    '/pequeno-grupo',
    '/mural-oportunidades',
    '/mural-generosidade',
    '/suggestions-improvements',
    '/avisos',
    '/primicias',
    '/trilha-discipulado',
    '/expense-report',
    '/redes-sociais',
    '/sobre-conecta',
    '/livros-doados'
  ];
  v_rows jsonb;
begin
  if v_profile is null then
    return jsonb_build_object('success', false, 'articles', '[]'::jsonb);
  end if;

  if v_catalog not in ('member', 'maintenance') then
    v_catalog := 'member';
  end if;

  v_tenant := public.require_session_tenant_id();

  select coalesce(jsonb_agg(public.knowledge_article_to_json(x.id) order by x.sort_order, x.title), '[]'::jsonb)
    into v_rows
    from (
      select distinct on (a.slug)
             a.id, a.sort_order, a.title, a.slug
        from public.knowledge_articles a
       where a.is_published = true
         and a.slug is distinct from 'modo-ghost'
         and (a.tenant_id is null or a.tenant_id = v_tenant)
         and exists (
           select 1
             from public.knowledge_article_roles r
            where r.article_id = a.id
              and r.role_code = any (public.knowledge_actor_role_codes(v_profile))
         )
         and (
           (v_catalog = 'member' and a.route_key = any (v_member_keys))
           or (v_catalog = 'maintenance' and a.route_key <> all (v_member_keys))
         )
         and (
           v_q is null
           or a.title ilike '%' || v_q || '%'
           or a.question ilike '%' || v_q || '%'
           or a.body ilike '%' || v_q || '%'
           or a.slug ilike '%' || v_q || '%'
         )
       order by a.slug, (a.tenant_id is not null) desc, a.sort_order
    ) x;

  return jsonb_build_object('success', true, 'articles', v_rows);
end;
$$;

grant execute on function public.list_knowledge_articles(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
