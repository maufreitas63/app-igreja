-- =============================================================================
-- Pedidos para doação: doar / emprestar com nomes visíveis no card
-- Aplica: npx supabase db query --linked -f scripts/generosity-mural-offers-kind.sql
-- =============================================================================

alter table public.generosity_interests
  add column if not exists kind text null;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'generosity_interests_kind_check'
       and conrelid = 'public.generosity_interests'::regclass
  ) then
    alter table public.generosity_interests
      add constraint generosity_interests_kind_check
      check (kind is null or kind in ('doar', 'emprestar'));
  end if;
end
$$;

comment on column public.generosity_interests.kind is
  'doar | emprestar em pedidos. Nulo nas doações (interesse simples). Sem telefone no feed.';

drop function if exists public.express_generosity_interest(uuid);

create or replace function public.list_generosity_posts(p_tipo text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_tipo text := nullif(lower(trim(coalesce(p_tipo, ''))), '');
begin
  if v_me is null or not public.session_can_view_generosity_mural() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para o mural.');
  end if;

  if v_tipo is not null and v_tipo not in ('doacao', 'pedido') then
    v_tipo := null;
  end if;

  return jsonb_build_object(
    'success', true,
    'posts',
    coalesce(
      (
        select jsonb_agg(q.item order by q.created_at desc)
        from (
          select
            jsonb_build_object(
              'id', p.id,
              'tipo', p.tipo,
              'categoria', p.categoria,
              'titulo', p.titulo,
              'descricao', p.descricao,
              'foto_url', p.foto_url,
              'status', p.status,
              'created_at', p.created_at,
              'is_mine', (p.user_id = v_me),
              'my_interest', i.status,
              'my_interest_kind', i.kind,
              'offers',
              case
                when p.tipo = 'pedido' then coalesce(
                  (
                    select jsonb_agg(o.offer order by o.created_at)
                    from (
                      select
                        jsonb_build_object(
                          'profile_id', i2.user_id,
                          'name', coalesce(nullif(trim(pr.full_name), ''), 'Membro'),
                          'kind', i2.kind,
                          'at', i2.created_at
                        ) as offer,
                        i2.created_at
                      from public.generosity_interests i2
                      join public.profiles pr
                        on pr.id = i2.user_id
                     where i2.post_id = p.id
                       and i2.tenant_id = v_tenant
                       and i2.kind in ('doar', 'emprestar')
                    ) o
                  ),
                  '[]'::jsonb
                )
                else '[]'::jsonb
              end
            ) as item,
            p.created_at
          from public.generosity_posts p
          left join public.generosity_interests i
            on i.post_id = p.id
           and i.user_id = v_me
           and i.tenant_id = v_tenant
         where p.tenant_id = v_tenant
           and p.status = 'ativo'
           and (v_tipo is null or p.tipo = v_tipo)
        ) q
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.express_generosity_interest(
  p_post_id uuid,
  p_kind text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_post public.generosity_posts%rowtype;
  v_kind text := nullif(lower(trim(coalesce(p_kind, ''))), '');
  v_label text;
  v_existed boolean := false;
begin
  if v_me is null or not public.session_can_view_generosity_mural() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão.');
  end if;

  select * into v_post
    from public.generosity_posts p
   where p.id = p_post_id and p.tenant_id = v_tenant;

  if not found or v_post.status is distinct from 'ativo' then
    return jsonb_build_object('success', false, 'message', 'Este anúncio não está disponível.');
  end if;

  if v_post.user_id = v_me then
    return jsonb_build_object('success', false, 'message', 'Este anúncio é seu.');
  end if;

  if v_post.tipo = 'pedido' then
    if v_kind not in ('doar', 'emprestar') then
      return jsonb_build_object(
        'success', false,
        'message', 'Informe se você pode doar ou emprestar.'
      );
    end if;
  else
    v_kind := null;
  end if;

  select exists (
    select 1
      from public.generosity_interests i
     where i.post_id = v_post.id
       and i.user_id = v_me
       and i.tenant_id = v_tenant
  ) into v_existed;

  if v_existed then
    update public.generosity_interests
       set kind = v_kind
     where post_id = v_post.id
       and user_id = v_me
       and tenant_id = v_tenant;

    if v_post.tipo = 'pedido' then
      return jsonb_build_object(
        'success', true,
        'message',
        case
          when v_kind = 'emprestar' then 'Seu nome entrou na lista para emprestar.'
          else 'Seu nome entrou na lista para doar.'
        end
      );
    end if;

    return jsonb_build_object(
      'success', true,
      'message', 'Seu interesse já estava registrado. A liderança fará a ponte.'
    );
  end if;

  insert into public.generosity_interests (tenant_id, post_id, user_id, status, kind)
  values (v_tenant, v_post.id, v_me, 'pendente', v_kind);

  v_label := case when v_post.tipo = 'doacao' then 'doação' else 'pedido' end;

  insert into public.generosity_notices (tenant_id, profile_id, post_id, title, body)
  values (
    v_tenant,
    v_post.user_id,
    v_post.id,
    'Interesse no mural',
    case
      when v_kind = 'emprestar' then
        'Alguém da comunidade pode emprestar o item do seu pedido "'
        || v_post.titulo || '". Veja a lista no anúncio.'
      when v_kind = 'doar' then
        'Alguém da comunidade pode doar o item do seu pedido "'
        || v_post.titulo || '". Veja a lista no anúncio.'
      else
        'Alguém da comunidade demonstrou interesse no seu anúncio de '
        || v_label || ': "' || v_post.titulo
        || '". A liderança fará a ponte sem expor telefones no mural.'
    end
  );

  return jsonb_build_object(
    'success', true,
    'message',
    case
      when v_kind = 'emprestar' then 'Seu nome entrou na lista para emprestar.'
      when v_kind = 'doar' then 'Seu nome entrou na lista para doar.'
      else 'Interesse registrado. A liderança faz o contato com segurança, sem expor seu telefone.'
    end
  );
end;
$$;

create or replace function public.list_generosity_interests_admin()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  if not public.session_can_moderate_generosity() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão.');
  end if;

  return jsonb_build_object(
    'success', true,
    'interests',
    coalesce(
      (
        select jsonb_agg(q.item order by q.created_at desc)
        from (
          select
            jsonb_build_object(
              'id', i.id,
              'post_id', i.post_id,
              'post_titulo', p.titulo,
              'post_tipo', p.tipo,
              'kind', i.kind,
              'status', i.status,
              'created_at', i.created_at,
              'author_name', coalesce(nullif(trim(a.full_name), ''), 'Autor'),
              'author_phone', a.phone,
              'interested_name', coalesce(nullif(trim(m.full_name), ''), 'Membro'),
              'interested_phone', m.phone
            ) as item,
            i.created_at
          from public.generosity_interests i
          join public.generosity_posts p
            on p.id = i.post_id and p.tenant_id = i.tenant_id
          join public.profiles a
            on a.id = p.user_id and a.tenant_id = i.tenant_id
          join public.profiles m
            on m.id = i.user_id and m.tenant_id = i.tenant_id
         where i.tenant_id = v_tenant
           and i.status = 'pendente'
           and p.status = 'ativo'
        ) q
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.list_generosity_posts(text) to anon, authenticated;
grant execute on function public.express_generosity_interest(uuid, text) to anon, authenticated;
grant execute on function public.list_generosity_interests_admin() to anon, authenticated;

notify pgrst, 'reload schema';
