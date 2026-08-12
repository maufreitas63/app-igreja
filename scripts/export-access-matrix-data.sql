-- Extrai dados para matriz de acessos (usuários × papéis/menu/engrenagem).
-- Saída em JSON para scripts/generate-access-matrix-report.mjs

select jsonb_build_object(
  'generated_at', now(),
  'roles', (
    select coalesce(jsonb_agg(row_to_json(r) order by r.display_order, r.name), '[]'::jsonb)
    from (
      select
        ar.id,
        ar.code,
        ar.name,
        ar.description,
        public.access_role_display_order(ar.code) as display_order
      from public.access_roles ar
    ) r
  ),
  'role_grants', (
    select coalesce(jsonb_agg(row_to_json(g) order by g.role_code, g.resource_key), '[]'::jsonb)
    from (
      select
        ar.code as role_code,
        ar.name as role_name,
        res.resource_type,
        res.resource_key,
        coalesce(res.label, res.resource_key) as resource_label,
        coalesce(ag.can_view, false) as can_view,
        coalesce(ag.can_update, false) as can_update
      from public.access_roles ar
      join public.access_grants ag on ag.role_id = ar.id
      join public.access_resources res on res.id = ag.resource_id
      where coalesce(ag.can_view, false) or coalesce(ag.can_update, false)
    ) g
  ),
  'scale_types', (
    select coalesce(jsonb_agg(row_to_json(s) order by s.nome), '[]'::jsonb)
    from (
      select te.id, te.nome, te.codigo
      from public.tipos_escala te
    ) s
  ),
  'users', (
    select coalesce(jsonb_agg(row_to_json(u) order by u.full_name), '[]'::jsonb)
    from (
      select
        p.id,
        trim(coalesce(p.full_name, '')) as full_name,
        nullif(trim(coalesce(p.phone, '')), '') as phone,
        public.profile_directory_family_code(p.family_id, p.codigo_membro) as family_id,
        (p.membership_out is null) as has_active_membership,
        exists (
          select 1
          from public.profile_access_roles par
          join public.access_roles ar on ar.id = par.role_id
          where par.profile_id = p.id
            and lower(ar.code) = 'super_admin'
        ) as is_super_admin,
        (
          select coalesce(jsonb_agg(ar.code order by public.access_role_display_order(ar.code), ar.name), '[]'::jsonb)
          from public.profile_access_roles par
          join public.access_roles ar on ar.id = par.role_id
          where par.profile_id = p.id
        ) as role_codes,
        (
          select coalesce(jsonb_agg(ar.name order by public.access_role_display_order(ar.code), ar.name), '[]'::jsonb)
          from public.profile_access_roles par
          join public.access_roles ar on ar.id = par.role_id
          where par.profile_id = p.id
        ) as role_names,
        (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'tipo_escala_id', psl.tipo_escala_id,
                'nome', te.nome,
                'codigo', te.codigo
              )
              order by te.nome
            ),
            '[]'::jsonb
          )
          from public.profile_scale_leadership psl
          join public.tipos_escala te on te.id = psl.tipo_escala_id
          where psl.profile_id = p.id
        ) as scale_leadership
      from public.profiles p
      where p.full_name is not null
        and trim(p.full_name) <> ''
        and exists (
          select 1 from public.profile_access_roles par where par.profile_id = p.id
        )
    ) u
  )
) as report;
