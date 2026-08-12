-- =============================================================================
-- Storage: libera financial-summaries no bucket financial-docs por tenant
-- =============================================================================

create or replace function public.storage_object_matches_session_tenant(
  p_bucket text,
  p_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_tenant uuid := public.current_session_tenant_id();
  v_parts text[];
  v_fin uuid;
  v_report uuid;
begin
  if v_tenant is null or nullif(trim(coalesce(p_bucket, '')), '') is null
     or nullif(trim(coalesce(p_name, '')), '') is null then
    return false;
  end if;

  v_parts := storage.foldername(p_name);

  -- Novo padrão: {tenant_id}/...
  if coalesce(array_length(v_parts, 1), 0) >= 1
     and v_parts[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    return v_parts[1]::uuid = v_tenant;
  end if;

  if p_bucket = 'financial-docs' then
    -- Relatório analítico: financial-summaries/{tenant_id}/arquivo.jpg
    if coalesce(array_length(v_parts, 1), 0) >= 2
       and v_parts[1] = 'financial-summaries'
       and v_parts[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then
      return v_parts[2]::uuid = v_tenant;
    end if;

    -- Legado: receipts/rd/{report_id}/...
    if coalesce(array_length(v_parts, 1), 0) >= 3
       and v_parts[1] = 'receipts'
       and v_parts[2] = 'rd'
    then
      begin
        v_report := v_parts[3]::uuid;
      exception
        when others then
          return false;
      end;

      return exists (
        select 1
          from public.expense_reports r
         where r.id = v_report
           and r.tenant_id = v_tenant
      );
    end if;

    -- Legado: receipts/{financial_id}/...
    if coalesce(array_length(v_parts, 1), 0) >= 2 and v_parts[1] = 'receipts' then
      begin
        v_fin := v_parts[2]::uuid;
      exception
        when others then
          return false;
      end;

      return exists (
        select 1
          from public.financials f
         where f.id = v_fin
           and f.tenant_id = v_tenant
      );
    end if;

    return false;
  end if;

  if p_bucket = 'assembly-minutes' then
    return exists (
      select 1
        from public.maintenance_assembly_minutes m
       where m.storage_path = p_name
         and m.tenant_id = v_tenant
    );
  end if;

  if p_bucket = 'maintenance-support' then
    return exists (
      select 1
        from public.maintenance_support_attachments a
       where a.storage_path = p_name
         and a.tenant_id = v_tenant
         and coalesce(a.is_active, true)
    );
  end if;

  return false;
end;
$fn$;

notify pgrst, 'reload schema';

select 'financial-summaries-storage-path: ok' as status;
