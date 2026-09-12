-- Candidatura ao Mural de Oportunidades sem pré-requisito da Trilha.
-- O avaliador vê quem se candidatou mesmo sem Perfil Ministerial.
-- Execute: npx supabase db query --linked -f scripts/volunteer-opportunities-apply-without-trail.sql

begin;

create or replace function public.list_opportunity_matching_members(p_id uuid)
returns table (
  profile_id uuid,
  full_name text,
  phone text,
  perfil_vencedor text,
  perfil_label text,
  match_pct integer,
  lesson_completed boolean,
  interest_status text,
  interest_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_opp public.volunteer_opportunities%rowtype;
begin
  -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  if v_me is null or not public.session_can_manage_volunteer_mural() then
    return;
  end if;

  select * into v_opp
    from public.volunteer_opportunities o
   where o.id = p_id and o.tenant_id = v_tenant;

  if not found then
    return;
  end if;

  return query
  select
    q.profile_id,
    q.full_name,
    q.phone,
    q.perfil_vencedor,
    q.perfil_label,
    q.match_pct,
    q.lesson_completed,
    q.interest_status,
    q.interest_id
  from (
    (
      select distinct on (p.id)
        p.id as profile_id,
        p.full_name,
        p.phone,
        r.perfil_vencedor,
        public.ministerial_profile_label(r.perfil_vencedor) as perfil_label,
        public.volunteer_gift_match_pct(
          r.perfil_vencedor,
          r.pontuacao_detalhada,
          v_opp.required_gifts
        ) as match_pct,
        exists (
          select 1
            from public.user_discipleship_progress udp
            join public.discipleship_lessons dl on dl.id = udp.lesson_id
            join public.discipleship_modules dm on dm.id = dl.module_id
           where udp.profile_id = p.id
             and udp.status = 'completed'
             and public.is_discipleship_ministerial_gifts_lesson(dm.sort_order, dl.sort_order, dl.title)
        ) as lesson_completed,
        i.status as interest_status,
        i.id as interest_id
      from public.ministerial_resultados r
      join public.profiles p on p.id = r.profile_id
      left join public.volunteer_opportunity_interests i
        on i.opportunity_id = v_opp.id and i.profile_id = p.id
     where r.tenant_id = v_tenant
       and p.tenant_id = v_tenant
       and p.status = 'approved'
       and public.profile_visible_to_access_actor(v_me, p.id)
       and (
         r.perfil_vencedor = any(public.volunteer_gifts_normalized(v_opp.required_gifts))
         or public.volunteer_gift_match_pct(r.perfil_vencedor, r.pontuacao_detalhada, v_opp.required_gifts) >= 50
       )
     order by
       p.id,
       (r.perfil_vencedor = any(public.volunteer_gifts_normalized(v_opp.required_gifts))) desc,
       public.volunteer_gift_match_pct(r.perfil_vencedor, r.pontuacao_detalhada, v_opp.required_gifts) desc,
       r.completed_at desc nulls last
    )
    union all
    (
      select
        p.id as profile_id,
        p.full_name,
        p.phone,
        r.perfil_vencedor,
        coalesce(
          public.ministerial_profile_label(r.perfil_vencedor),
          'Ainda sem Perfil Ministerial'
        ) as perfil_label,
        coalesce(
          public.volunteer_gift_match_pct(
            r.perfil_vencedor,
            r.pontuacao_detalhada,
            v_opp.required_gifts
          ),
          0
        ) as match_pct,
        exists (
          select 1
            from public.user_discipleship_progress udp
            join public.discipleship_lessons dl on dl.id = udp.lesson_id
            join public.discipleship_modules dm on dm.id = dl.module_id
           where udp.profile_id = p.id
             and udp.status = 'completed'
             and public.is_discipleship_ministerial_gifts_lesson(dm.sort_order, dl.sort_order, dl.title)
        ) as lesson_completed,
        i.status as interest_status,
        i.id as interest_id
      from public.volunteer_opportunity_interests i
      join public.profiles p on p.id = i.profile_id
      left join lateral (
        select mr.perfil_vencedor, mr.pontuacao_detalhada
          from public.ministerial_resultados mr
         where mr.profile_id = p.id
           and mr.tenant_id = v_tenant
         order by mr.completed_at desc nulls last
         limit 1
      ) r on true
     where i.opportunity_id = v_opp.id
       and i.tenant_id = v_tenant
       and p.tenant_id = v_tenant
       and p.status = 'approved'
       and public.profile_visible_to_access_actor(v_me, p.id)
       and not exists (
         select 1
           from public.ministerial_resultados mr
          where mr.profile_id = p.id
            and mr.tenant_id = v_tenant
            and (
              mr.perfil_vencedor = any(public.volunteer_gifts_normalized(v_opp.required_gifts))
              or public.volunteer_gift_match_pct(
                mr.perfil_vencedor,
                mr.pontuacao_detalhada,
                v_opp.required_gifts
              ) >= 50
            )
       )
    )
  ) q
  order by
    (q.interest_status is not null) desc,
    (q.perfil_vencedor = any(public.volunteer_gifts_normalized(v_opp.required_gifts))) desc,
    q.match_pct desc,
    q.full_name;
end;
$$;

update public.knowledge_articles
   set body = $body$## O que aparece
Todas as vagas abertas. Não é preciso ter concluído a Trilha nem a Lição 5.1 para se candidatar. Se já houver Perfil Ministerial, o match só destaca vagas combinadas.

## Candidatar-se
Toque em Tenho Interesse. O aplicativo avisa o líder e, se houver telefone, pode abrir o WhatsApp. O avaliador caminha com você no processo da Trilha.

## Sem vagas
A igreja ainda não publicou oportunidades em Mural de Voluntários (engrenagem).$body$,
       updated_at = now()
 where tenant_id is null
   and lower(slug) = 'mural-oportunidades';

update public.knowledge_articles
   set body = $body$## Nova vaga
Título, descrição, ministério (tipo de escala), líder responsável (WhatsApp das candidaturas) e, se quiser, dons da Lição 5.1 para o match. Status: rascunho, aberta, pausada, concluída. Só Aberta aparece para o membro. A Trilha não é pré-requisito para o membro se candidatar.

## Privacidade
O perfil ministerial individual não vai para o mural público — só o cruzamento com a vaga, quando existir.

## Interesse
Candidatura avisa o líder, inclusive de quem ainda não fez a Trilha. Acompanhe a lista e caminhe com o candidato nesse processo. O membro usa Mural de Oportunidades.

## Depois
Sem tipo de escala, a vaga não se encaixa na programação. Cadastre o tipo em Tipos de Escala se a frente for nova.$body$,
       updated_at = now()
 where tenant_id is null
   and lower(slug) = 'mural-voluntarios-admin';

commit;
