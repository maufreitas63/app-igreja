-- Módulo financeiro: card no dashboard, tela /financial e RD (/expense-report)
-- Execute no SQL Editor do Supabase quando "Card Financeiro" não aparecer em Papéis → Telas.
-- Pré-requisito: scripts/access-control-schema.sql (tabelas access_resources / access_grants)

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  (
    'screen',
    'dashboard.card.financial',
    'Card Financeiro (dashboard)',
    'Exibe o card Financeiro no carrossel do dashboard principal.',
    true
  ),
  (
    'screen',
    '/financial',
    'Tela Financeiro (relatórios)',
    'Abre a tela de relatórios financeiros ao tocar no card.',
    true
  ),
  (
    'screen',
    '/expense-report',
    'Relatório de Despesas (RD)',
    'Formulário de RD acessível pelo hub do card Financeiro.',
    true
  )
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

insert into public.access_resources (resource_type, resource_key, label, is_active)
values ('table', 'financials', 'Lançamentos financeiros', true)
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      is_active = true;

-- Papel member: acesso padrão ao card e à tela (ajuste outros papéis na UI Papéis)
insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, false
  from public.access_roles r
 cross join public.access_resources res
 where r.code = 'member'
   and (
     (res.resource_type = 'screen' and res.resource_key in (
       'dashboard.card.financial',
       '/financial',
       '/expense-report'
     ))
     or (res.resource_type = 'table' and res.resource_key = 'financials')
   )
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- Conferência: deve retornar 3 linhas (card, tela, RD)
select resource_type, resource_key, label, is_active
  from public.access_resources
 where resource_type = 'screen'
   and resource_key in ('dashboard.card.financial', '/financial', '/expense-report')
 order by resource_key;

notify pgrst, 'reload schema';
