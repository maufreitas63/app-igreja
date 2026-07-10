-- =============================================================================
-- Multi-tenancy 05-C — Checklist priorizado de correção (catálogo do app)
-- =============================================================================
-- Use como ordem operacional de patches. Não altera o banco.
-- =============================================================================

select *
from (
  values
    (10, 'pastoral-maintenance-rpc.sql', 'listar/atualizar pedidos pastorais', 'Filtrar pastoral_requests por tenant_id da sessão'),
    (20, 'financials-maintenance-rpc.sql', 'CRUD financeiro manutenção', 'Filtrar financials por tenant_id'),
    (30, 'financials-import-rpc.sql', 'importação de lançamentos', 'Gravar/ler só do tenant da sessão'),
    (40, 'expense-reports-rpc.sql', 'relatórios de despesa', 'expense_reports/items por tenant'),
    (50, 'escalas-maintenance-rpc.sql', 'programação de escalas', 'tipos_escala / escalas_log por tenant'),
    (60, 'escalas-volunteers-rpc.sql', 'servos em disponibilidade', 'voluntarios_escala por tenant'),
    (70, 'escalas-apply-cycle-batch.sql', 'lote de escalas', 'não gerar para outro tenant'),
    (80, 'escalas-tipos-maintenance-rpc.sql', 'tipos de escala', 'tipos_escala por tenant'),
    (90, 'media-authorization-rpc.sql', 'autorização de mídia', 'pending/authorizations por tenant'),
    (100, 'members-accepted-functions.sql', 'membros aceitos / listagens', 'members + profiles por tenant'),
    (110, 'list-profiles-family-directory.sql', 'diretório familiar', 'profiles/members por tenant'),
    (120, 'events-maintenance-rls.sql / replicate-event', 'manutenção de eventos', 'events por tenant'),
    (130, 'event-control-orchestration.sql', 'orquestrador', 'event_control por tenant'),
    (140, 'event-avisos-schema.sql', 'avisos de evento', 'event_avisos por tenant'),
    (150, 'events-quorum-registry.sql', 'quórum', 'event_quorum_registry por tenant'),
    (160, 'checkins-totem-flow.sql / geo-checkin', 'check-ins', 'checkins por tenant'),
    (170, 'recepcao-cadastro-familiar.sql', 'recepção familiar', 'filas por tenant'),
    (180, 'maintenance-support-suggestions.sql', 'suporte/vigilância', 'maintenance_support_* por tenant'),
    (190, 'assembly-minutes.sql', 'atas', 'maintenance_assembly_minutes por tenant'),
    (200, 'salvar-app-parameter-admin.sql', 'parâmetros', 'app_parameters por tenant (Parm_entidade etc.)'),
    (210, 'access-control-admin-rpc.sql', 'ACL admin', 'access_grants / profile_access_roles por tenant'),
    (220, 'access-control-pastoral-role-change.sql', 'mudança de papéis', 'não alterar perfil de outro tenant'),
    (230, 'register-profile-atomic.sql / register-member', 'cadastro', 'criar vínculo profile_igreja_vinculos + tenant_id'),
    (240, 'complete-initial-profile-registration-rpc.sql', 'cadastro inicial', 'vínculo + tenant no profile'),
    (250, 'delete-profile-complete-rpc.sql', 'exclusão de perfil', 'só no tenant da sessão'),
    (260, 'profile-access-insights.sql', 'insights de acesso', 'eventos de acesso por tenant'),
    (270, 'ministerial-profile-questionnaire.sql', 'questionário', 'respostas/resultados por tenant'),
    (900, 'verificar-login.sql / profile-sessions', 'login/sessão', 'OK se só autentica; ao emitir sessão, profile já deve ter vínculo'),
    (910, 'password-recovery-*.sql', 'recuperação PIN', 'buscar profile só no tenant correto se multi-igreja no mesmo DB'),
    (920, 'get-app-parameter-value.sql', 'leitura de parâmetro', 'filtrar app_parameters.tenant_id')
) as t(priority, script_area, rpc_area, remediation)
order by priority;
