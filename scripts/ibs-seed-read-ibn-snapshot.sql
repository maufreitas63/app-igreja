-- Snapshot IBN rooms + books for IBS seed (read-only).
select jsonb_build_object(
  'rooms',
  (
    select coalesce(jsonb_agg(to_jsonb(r) order by r.sort_order, r.room_key), '[]'::jsonb)
    from public.church_room_settings r
    where r.tenant_id = 'a0000000-0000-4000-8000-000000000001'
  ),
  'livros',
  (
    select coalesce(jsonb_agg(jsonb_build_object(
      'isbn', l.isbn,
      'titulo', l.titulo,
      'autor', l.autor,
      'editora', l.editora,
      'ano', l.ano,
      'capa', l.capa
    ) order by l.titulo), '[]'::jsonb)
    from public.livros l
    where l.tenant_id = 'a0000000-0000-4000-8000-000000000001'
  ),
  'mauricio',
  (
    select jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'phone', p.phone,
      'roles', (
        select coalesce(jsonb_agg(ar.code), '[]'::jsonb)
        from public.profile_access_roles par
        join public.access_roles ar on ar.id = par.role_id
        where par.profile_id = p.id
      ),
      'vinculos', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'tenant_id', v.tenant_id,
          'code', i.code,
          'is_primary', v.is_primary,
          'is_active', v.is_active
        )), '[]'::jsonb)
        from public.profile_igreja_vinculos v
        join public.igrejas i on i.id = v.tenant_id
        where v.profile_id = p.id
      )
    )
    from public.profiles p
    where regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') = '19996166161'
    limit 1
  ),
  'ibs_counts',
  jsonb_build_object(
    'profiles', (select count(*) from public.profiles p join public.profile_igreja_vinculos v on v.profile_id = p.id where v.tenant_id = '81295e39-9167-40b4-a524-702439905e75' and v.is_active),
    'rooms', (select count(*) from public.church_room_settings where tenant_id = '81295e39-9167-40b4-a524-702439905e75'),
    'livros', (select count(*) from public.livros where tenant_id = '81295e39-9167-40b4-a524-702439905e75'),
    'events', (select count(*) from public.events where tenant_id = '81295e39-9167-40b4-a524-702439905e75')
  )
) as snapshot;
