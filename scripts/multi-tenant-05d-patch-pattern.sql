-- =============================================================================
-- Multi-tenancy 05-D — Padrão de correção (referência; não executa nada)
-- =============================================================================
-- 1) No início da função:
--      v_tenant uuid := public.current_session_tenant_id();
--      if v_tenant is null then
--        raise exception 'Sessão sem igreja (tenant) vinculada.';
--      end if;
--
-- 2) Em todo SELECT/UPDATE/DELETE de tabela de dados:
--      ... where tenant_id = v_tenant and ...
--
-- 3) Em INSERT explícito (além do trigger):
--      insert into ... (..., tenant_id) values (..., v_tenant);
--
-- 4) Ao criar profile novo:
--      insert into profile_igreja_vinculos (profile_id, tenant_id, is_primary)
--      values (novo_id, v_tenant, true);
--
-- 5) Reexecute multi-tenant-05b-risk-missing-tenant-filter.sql após cada patch.
-- =============================================================================

select
  'Use este arquivo só como referência de patch.' as note,
  'Após corrigir um RPC, rode o 05-B de novo.' as next_step;
