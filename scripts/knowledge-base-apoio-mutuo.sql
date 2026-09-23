-- Artigo do ícone «i» em Apoio Mútuo.
-- Execute: npx supabase db query --linked -f scripts/knowledge-base-apoio-mutuo.sql

do $$
declare
  v_id uuid;
  v_member text[] := array[
    'member', 'congregado', 'visitante', 'visitantes',
    'pastoral', 'tesoureiro', 'secretaria', 'events_admin',
    'gestor_controle_acesso', 'super_admin'
  ];
begin
  select id into v_id
    from public.knowledge_articles
   where tenant_id is null
     and lower(slug) = 'apoio-mutuo';

  if v_id is null then
    insert into public.knowledge_articles (
      slug, title, question, body, route_key, tenant_id, is_published, sort_order
    )
    values (
      'apoio-mutuo',
      'Apoio Mútuo',
      'Como encontro o trabalho de alguém da igreja e falo com a pessoa?',
      $body$## Vitrine
As categorias mostram quem publicou um serviço nesta igreja. Toque numa categoria com ofertas para ver os cartões.

## Contato
No cartão, o WhatsApp abre a conversa. Dá para salvar o contato direto na agenda do celular.

## Publicar o seu
No Perfil, o cartão de visitas liga ou desliga a publicação no Apoio Mútuo desta igreja.$body$,
      '/apoio-mutuo',
      null,
      true,
      25
    )
    returning id into v_id;
  else
    update public.knowledge_articles
       set title = 'Apoio Mútuo',
           question = 'Como encontro o trabalho de alguém da igreja e falo com a pessoa?',
           body = $body$## Vitrine
As categorias mostram quem publicou um serviço nesta igreja. Toque numa categoria com ofertas para ver os cartões.

## Contato
No cartão, o WhatsApp abre a conversa. Dá para salvar o contato direto na agenda do celular.

## Publicar o seu
No Perfil, o cartão de visitas liga ou desliga a publicação no Apoio Mútuo desta igreja.$body$,
           route_key = '/apoio-mutuo',
           is_published = true,
           sort_order = 25,
           updated_at = now()
     where id = v_id;
  end if;

  delete from public.knowledge_article_roles where article_id = v_id;
  insert into public.knowledge_article_roles (article_id, role_code)
  select v_id, code from unnest(v_member) as code;
end;
$$;
