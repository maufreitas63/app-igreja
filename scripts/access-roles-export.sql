-- Exportação para o PDF de papéis (telas, tabelas e colunas).
-- Execute no Supabase SQL Editor e use o resultado com build-access-roles-pdf.mjs,
-- ou rode diretamente: node scripts/build-access-roles-pdf.mjs

select
  ar.code as papel_codigo,
  ar.name as papel_nome,
  ar.description as papel_descricao,
  res.resource_type as tipo,
  res.resource_key as chave,
  coalesce(nullif(trim(res.label), ''), res.resource_key) as rotulo,
  g.can_view as pode_ver,
  g.can_update as pode_editar
from public.access_grants g
join public.access_roles ar on ar.id = g.role_id
join public.access_resources res on res.id = g.resource_id
where g.role_id is not null
  and coalesce(res.is_active, true) = true
  and (g.can_view = true or g.can_update = true)
order by
  public.access_role_display_order(ar.code),
  ar.name,
  res.resource_type,
  res.resource_key;
