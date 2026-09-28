-- Ícone «i» da Lista de Famílias, no mesmo padrão da Lista de Membros.
-- Execute: npx supabase db query --linked -f scripts/knowledge-base-lista-familias.sql

begin;

create or replace function public._seed_knowledge_article(
  p_slug text,
  p_title text,
  p_question text,
  p_body text,
  p_route_key text,
  p_roles text[],
  p_sort_order integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id
    from public.knowledge_articles
   where tenant_id is null
     and lower(slug) = lower(p_slug);

  if v_id is null then
    insert into public.knowledge_articles (
      slug, title, question, body, route_key, tenant_id, is_published, sort_order
    )
    values (
      p_slug, p_title, p_question, p_body, p_route_key, null, true, p_sort_order
    )
    returning id into v_id;
  else
    update public.knowledge_articles
       set title = p_title,
           question = p_question,
           body = p_body,
           route_key = p_route_key,
           is_published = true,
           sort_order = p_sort_order,
           updated_at = now()
     where id = v_id;
  end if;

  delete from public.knowledge_article_roles where article_id = v_id;
  insert into public.knowledge_article_roles (article_id, role_code)
  select v_id, code from unnest(p_roles) as code;
end;
$$;

do $$
declare
  v_ops text[] := array[
    'pastoral', 'tesoureiro', 'secretaria', 'events_admin',
    'gestor_controle_acesso', 'super_admin'
  ];
begin
  perform public._seed_knowledge_article(
    'lista-familias',
    'Lista de Famílias',
    'Como vejo os integrantes de uma família desta igreja?',
    $body$## Quando usar
Secretaria e liderança: abrir uma família pelo código e conferir parentesco e nome completo.

## Escolha
A caixa lista só famílias desta igreja. Com mais de um integrante, o rótulo é «código. Família de {representante ou cônjuge}». Com uma pessoa só, aparece o código e o nome.

## Reconhecer e editar
O visto confirma que a pessoa pertence à família. O lápis abre a mesma ficha de Gerenciar Família. Quem sai do reconhecimento recebe um código novo.$body$,
    '/lista-familias',
    v_ops,
    215
  );
end;
$$;

commit;
