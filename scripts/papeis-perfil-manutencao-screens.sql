-- =============================================================================
-- Papéis → Telas: itens do Perfil (produto) e manutenção com rótulos corretos
-- =============================================================================
-- Produto (bolinha azul):
--   • Ofereço meus Serviços (/ofereco-servicos)
--   • Reembolsos (/expense-report) — renomeia label legado RD
--   • Cantinho da Leitura (/cantinho-leitura)
-- Manutenção (bolinha laranja — já eram maintenance.card.* / rota manutenção):
--   • Livros doados (/livros-doados) — escopo no app via ACCESS_SCREEN_MAINTENANCE_EXTRA
--   • Presença (maintenance.card.quorum_presence)
--   • Gestão de Pequenos Grupos (maintenance.card.small_groups_management)
-- Aplica: npx supabase db query --linked -f scripts/papeis-perfil-manutencao-screens.sql
-- =============================================================================

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  (
    'screen',
    '/ofereco-servicos',
    'Ofereço meus Serviços',
    'Cadastro de serviços oferecidos pelo membro (Perfil).',
    true
  ),
  (
    'screen',
    '/cantinho-leitura',
    'Cantinho da Leitura',
    'Livros retirados / leitura do membro (Perfil).',
    true
  ),
  (
    'screen',
    '/expense-report',
    'Reembolsos',
    'Solicitação de reembolso / relatório de despesas (Perfil).',
    true
  ),
  (
    'screen',
    '/livros-doados',
    'Livros doados',
    'Acervo com busca ISBN e cadastro manual (menu Manutenção).',
    true
  ),
  (
    'screen',
    'maintenance.card.quorum_presence',
    'Presença',
    'Lista de presença (quórum) no painel de manutenção.',
    true
  ),
  (
    'screen',
    'maintenance.card.small_groups_management',
    'Gestão de Pequenos Grupos',
    'Gestão de pequenos grupos no painel de manutenção.',
    true
  )
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = coalesce(excluded.description, public.access_resources.description),
      is_active = true;

-- Ofereço e Cantinho: disponíveis aos papéis de membro (como Dados cadastrais / Trilha)
insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, false
  from public.access_roles r
 cross join public.access_resources res
 where r.code in (
   'member',
   'congregado',
   'visitantes',
   'pastoral',
   'secretaria',
   'super_admin'
 )
   and res.resource_type = 'screen'
   and res.resource_key in ('/ofereco-servicos', '/cantinho-leitura')
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = true,
      can_update = excluded.can_update,
      updated_at = now();

-- Reembolsos: restaura grant padrão do member (script financeiro)
insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, false
  from public.access_roles r
 cross join public.access_resources res
 where r.code in ('member', 'pastoral', 'secretaria', 'super_admin')
   and res.resource_type = 'screen'
   and res.resource_key = '/expense-report'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = true,
      updated_at = now();
