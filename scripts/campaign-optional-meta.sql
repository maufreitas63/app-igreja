-- =============================================================================
-- Meta financeira opcional nas campanhas
-- =============================================================================
-- Sem valor cadastrado, a campanha não tem teto (progresso/marcos não se aplicam).
-- Aplica: npx supabase db query --linked -f scripts/campaign-optional-meta.sql
-- =============================================================================

alter table public.campaign_projects
  alter column meta_financeira drop not null;

alter table public.campaign_projects
  drop constraint if exists campaign_projects_meta_financeira_check;

alter table public.campaign_projects
  add constraint campaign_projects_meta_financeira_check
  check (meta_financeira is null or meta_financeira > 0);

comment on column public.campaign_projects.meta_financeira is
  'Meta opcional. Null = sem teto definido.';

create or replace function public.dispatch_campaign_milestones(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_row public.campaign_projects%rowtype;
  v_pct numeric;
  v_mark integer;
  v_title text;
  v_body text;
begin
  select * into v_row from public.campaign_projects where id = p_campaign_id;

  if v_row.id is null or coalesce(v_row.meta_financeira, 0) <= 0 then
    return;
  end if;

  v_pct := round((v_row.valor_arrecadado / v_row.meta_financeira) * 100, 1);

  foreach v_mark in array array[50, 90, 100]
  loop
    if v_pct < v_mark then
      continue;
    end if;

    if v_mark = 50 then
      v_title := 'Campanha na metade da meta';
      v_body := 'A campanha "' || v_row.titulo || '" já chegou à metade da meta. Continue contribuindo!';
    elsif v_mark = 90 then
      v_title := 'Faltam apenas 10%';
      v_body := 'Faltam apenas 10% para concluirmos "' || v_row.titulo || '"!';
    else
      v_title := 'Meta da campanha atingida';
      v_body := 'A campanha "' || v_row.titulo || '" atingiu a meta. Obrigado pela generosidade!';
    end if;

    insert into public.campaign_milestone_notices (
      tenant_id, campaign_id, milestone_pct, title, body
    ) values (
      v_row.tenant_id, v_row.id, v_mark, v_title, v_body
    )
    on conflict (campaign_id, milestone_pct) do nothing;

    if found then
      begin
        insert into public.event_avisos (
          tenant_id, title, body, sort_order, is_published, audience
        ) values (
          v_row.tenant_id, v_title, v_body, 0, true, 'all'
        );
      exception
        when others then
          null;
      end;
    end if;
  end loop;
end;
$$;

create or replace function public.upsert_campaign_project(
  p_id uuid default null,
  p_titulo text default null,
  p_descricao text default '',
  p_meta_financeira numeric default null,
  p_data_inicio date default null,
  p_data_fim date default null,
  p_status text default 'rascunho',
  p_centavos_referencia numeric default null,
  p_cover_url text default null,
  p_chave_pix_selecionada text default '1'
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_status text := lower(trim(coalesce(p_status, 'rascunho')));
  v_cents numeric(4, 2);
  v_slot text := public.normalize_pix_account_slot(p_chave_pix_selecionada);
  v_meta numeric(14, 2);
  v_id uuid;
  v_row public.campaign_projects%rowtype;
begin
  if v_actor is null or not public.session_can_manage_campaigns() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para gerir campanhas.');
  end if;

  if not (
    public.is_super_admin_profile(v_actor)
    or public.profile_has_access(
      v_actor,
      'screen',
      'maintenance.finance.campaigns',
      'update'
    )
  ) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para alterar campanhas.');
  end if;

  if v_status not in ('rascunho', 'ativo', 'concluido') then
    v_status := 'rascunho';
  end if;

  v_cents := round(coalesce(p_centavos_referencia, 0.01), 2);

  if v_cents < 0.01 or v_cents > 0.99 then
    return jsonb_build_object('success', false, 'message', 'Informe os centavos de referência entre 0,01 e 0,99.');
  end if;

  v_meta := case
    when p_meta_financeira is null or p_meta_financeira <= 0 then null
    else round(p_meta_financeira, 2)
  end;

  if p_id is null then
    if coalesce(trim(p_titulo), '') = '' then
      return jsonb_build_object('success', false, 'message', 'Informe o título da campanha.');
    end if;

    insert into public.campaign_projects (
      tenant_id, titulo, descricao, meta_financeira, data_inicio, data_fim,
      status, centavos_referencia, cover_url, chave_pix_selecionada, created_by_profile_id
    ) values (
      v_tenant,
      trim(p_titulo),
      coalesce(trim(p_descricao), ''),
      v_meta,
      coalesce(p_data_inicio, (timezone('America/Sao_Paulo', now()))::date),
      p_data_fim,
      v_status,
      v_cents,
      nullif(trim(coalesce(p_cover_url, '')), ''),
      v_slot,
      v_actor
    )
    returning * into v_row;
  else
    update public.campaign_projects c
       set titulo = coalesce(nullif(trim(coalesce(p_titulo, '')), ''), c.titulo),
           descricao = coalesce(p_descricao, c.descricao),
           meta_financeira = v_meta,
           data_inicio = coalesce(p_data_inicio, c.data_inicio),
           data_fim = p_data_fim,
           status = v_status,
           centavos_referencia = v_cents,
           cover_url = case
             when p_cover_url is null then c.cover_url
             when trim(p_cover_url) = '' then null
             else trim(p_cover_url)
           end,
           chave_pix_selecionada = v_slot,
           updated_at = now()
     where c.id = p_id
       and c.tenant_id = v_tenant
    returning * into v_row;

    if v_row.id is null then
      return jsonb_build_object('success', false, 'message', 'Campanha não encontrada.');
    end if;
  end if;

  v_id := v_row.id;
  perform public.reconcile_campaign_deposits(v_tenant);
  select * into v_row from public.campaign_projects where id = v_id;

  return jsonb_build_object('success', true, 'id', v_id, 'campaign', public.campaign_project_json(v_row));
exception
  when unique_violation then
    return jsonb_build_object(
      'success', false,
      'message', 'Já existe uma campanha ativa/rascunho com estes centavos de referência.'
    );
end;
$$;

grant execute on function public.upsert_campaign_project(
  uuid, text, text, numeric, date, date, text, numeric, text, text
) to anon, authenticated;

notify pgrst, 'reload schema';
