-- Remove a linha do tempo da família (RPCs, ACL, artigo e tabela de flag).
-- O código TypeScript só some com git revert do commit da feature.
-- Execute: npx supabase db query --linked -f scripts/family-timeline-undo.sql

begin;

delete from public.knowledge_article_roles
 where article_id in (
   select id from public.knowledge_articles
    where tenant_id is null and slug = 'linha-tempo-familia'
 );

delete from public.knowledge_articles
 where tenant_id is null and slug = 'linha-tempo-familia';

delete from public.access_grants g
 using public.access_resources r
 where g.resource_id = r.id
   and r.resource_type = 'screen'
   and r.resource_key = 'maintenance.card.family_timeline';

delete from public.access_resources
 where resource_type = 'screen'
   and resource_key = 'maintenance.card.family_timeline';

drop function if exists public.get_family_timeline(text);
drop function if exists public.search_family_timeline(text);
drop function if exists public.set_family_timeline_feature(boolean);
drop function if exists public.family_timeline_feature_state();
drop function if exists public.session_can_see_family_timeline_giving();
drop function if exists public.session_can_view_family_timeline();
drop function if exists public.family_timeline_enabled_for_tenant(uuid);

drop table if exists public.family_timeline_settings;

notify pgrst, 'reload schema';

commit;
