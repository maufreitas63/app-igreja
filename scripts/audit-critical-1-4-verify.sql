-- Conferência pós-lockdown (somente leitura).
select
  p.proname as fn,
  has_function_privilege('anon', p.oid, 'execute') as anon_exec,
  has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'reconcile_campaign_deposits',
    'volunteer_opportunity_notify_matches'
  )
order by p.proname;

select pol.polname, c.relname, pol.polcmd
from pg_policy pol
join pg_class c on c.oid = pol.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('pastoral_slots', 'pastoral_slot_notices')
order by c.relname, pol.polname;
