-- Atualiza o texto da lição 5.1 para orientar o Perfil Ministerial (multi-tenant).

update public.discipleship_lessons l
   set content =
         'Nesta etapa você descobre seus dons espirituais preenchendo o Perfil Ministerial. '
         || 'Use o botão «Perfil Ministerial» para responder ao questionário e, em seguida, conclua a lição.',
       video_url = null,
       updated_at = now()
  from public.discipleship_modules m
 where l.module_id = m.id
   and l.tenant_id = m.tenant_id
   and m.sort_order = 5
   and l.sort_order = 1
   and (
     lower(trim(l.title)) like '%descobrindo meus dons%'
     or l.is_seed = true
   );

select 'discipleship-lesson-5-1-ministerial: ok' as status;
