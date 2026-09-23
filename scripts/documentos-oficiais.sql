-- Documentos oficiais da igreja (atas e similares).
-- Consulta só para o papel member, na instância da sessão.
-- Execute: npx supabase db query --linked -f scripts/documentos-oficiais.sql

create table if not exists public.church_official_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id),
  title text not null,
  document_kind text not null default 'ata_assembleia',
  assembly_date date,
  summary text,
  file_url text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  constraint church_official_documents_kind_check
    check (document_kind in ('ata_assembleia', 'estatuto', 'regimento', 'outro'))
);

create index if not exists church_official_documents_tenant_date_idx
  on public.church_official_documents (tenant_id, assembly_date desc nulls last, title);

alter table public.church_official_documents enable row level security;

drop policy if exists church_official_documents_select_member on public.church_official_documents;

create policy church_official_documents_select_member
  on public.church_official_documents
  for select
  to anon, authenticated
  using (
    is_published
    and public.session_tenant_matches(tenant_id)
    and public.profile_has_role_code(public.current_session_profile_id(), 'member')
  );

grant select on public.church_official_documents to anon, authenticated;

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values (
  'screen',
  '/documentos-oficiais',
  'Documentos oficiais',
  'Atas de assembleia e demais documentos oficiais da igreja. Somente membros.',
  true
)
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

delete from public.access_grants g
 using public.access_resources res, public.access_roles r
 where g.resource_id = res.id
   and g.role_id = r.id
   and res.resource_type = 'screen'
   and res.resource_key = '/documentos-oficiais'
   and r.code is distinct from 'member';

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, false
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = '/documentos-oficiais'
 where r.code = 'member'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = true,
      can_update = false,
      updated_at = now();

do $$
declare
  v_id uuid;
  v_member text[] := array['member'];
begin
  select id into v_id
    from public.knowledge_articles
   where tenant_id is null
     and lower(slug) = 'documentos-oficiais';

  if v_id is null then
    insert into public.knowledge_articles (
      slug, title, question, body, route_key, tenant_id, is_published, sort_order
    )
    values (
      'documentos-oficiais',
      'Documentos oficiais',
      'Onde vejo as atas de assembleia da igreja?',
      $body$## O que aparece
A lista mostra os documentos oficiais publicados nesta igreja: atas de assembleia, estatuto, regimento e outros registros.

## Quem vê
Somente quem tem o papel de membro. Visitante, congregado e demais papéis não abrem esta tela.

## Arquivo
Quando o documento tem arquivo, o toque abre o original.$body$,
      '/documentos-oficiais',
      null,
      true,
      22
    )
    returning id into v_id;
  else
    update public.knowledge_articles
       set title = 'Documentos oficiais',
           question = 'Onde vejo as atas de assembleia da igreja?',
           body = $body$## O que aparece
A lista mostra os documentos oficiais publicados nesta igreja: atas de assembleia, estatuto, regimento e outros registros.

## Quem vê
Somente quem tem o papel de membro. Visitante, congregado e demais papéis não abrem esta tela.

## Arquivo
Quando o documento tem arquivo, o toque abre o original.$body$,
           route_key = '/documentos-oficiais',
           is_published = true,
           sort_order = 22,
           updated_at = now()
     where id = v_id;
  end if;

  delete from public.knowledge_article_roles where article_id = v_id;
  insert into public.knowledge_article_roles (article_id, role_code)
  select v_id, code from unnest(v_member) as code;
end;
$$;

notify pgrst, 'reload schema';
