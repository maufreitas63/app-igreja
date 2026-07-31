-- =============================================================================
-- Patch: garante os 5 módulos da Trilha em igrejas já seedadas com 1–3
-- + remove tabelas órfãs discipleship_trail_* (rascunho anterior)
-- =============================================================================
-- Pré-requisito: scripts/discipleship-trail-schema.sql (com seed de 5 módulos)
-- =============================================================================

-- Limpa rascunho anterior (se existir)
drop function if exists public.list_my_discipleship_trail();
drop function if exists public.complete_discipleship_lesson(uuid, text);
drop function if exists public.list_discipleship_trail_recognitions(text);
drop function if exists public.acknowledge_discipleship_trail_recognition(uuid);
drop function if exists public.session_can_manage_discipleship_trail();
drop function if exists public.seed_discipleship_trail_for_tenant(uuid);
drop table if exists public.discipleship_trail_progress cascade;
drop table if exists public.discipleship_trail_recognitions cascade;
drop table if exists public.discipleship_trail_lessons cascade;
drop table if exists public.discipleship_trail_modules cascade;

create or replace function public.ensure_discipleship_trail_five_modules(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_mod4 uuid;
  v_mod5 uuid;
begin
  if p_tenant_id is null then
    return;
  end if;

  perform set_config('app.bypass_tenant_guard', 'on', true);

  -- Se não há seed algum, usa o seed completo
  if not exists (
    select 1 from public.discipleship_modules m
     where m.tenant_id = p_tenant_id and m.is_seed = true
  ) then
    perform public.seed_default_discipleship_trail(p_tenant_id);
    return;
  end if;

  if not exists (
    select 1 from public.discipleship_modules m
     where m.tenant_id = p_tenant_id and m.sort_order = 4 and m.is_seed = true
  ) then
    insert into public.discipleship_modules (
      tenant_id, title, description, sort_order, is_active, is_seed
    ) values (
      p_tenant_id,
      'Comunhão e Pertença (A Igreja Local e os Pequenos Grupos)',
      'Compromisso com a igreja local e conexão com pequenos grupos nos lares.',
      4, true, true
    )
    returning id into v_mod4;

    insert into public.discipleship_lessons (
      tenant_id, module_id, title, content, video_url, reflection_question, sort_order, is_active, is_seed
    ) values
      (p_tenant_id, v_mod4, 'O Que Significa Ser Membro de uma Igreja Local',
       'Ser membro é compromisso de comunhão, cuidado mútuo e missão compartilhada.',
       null, null, 1, true, true),
      (p_tenant_id, v_mod4, 'A Vida em Comunidade',
       'A vida cristã floresce em comunidade — oração, partilha e serviço juntos.',
       null, null, 2, true, true),
      (p_tenant_id, v_mod4, 'Encontre seu Pequeno Grupo',
       'Os pequenos grupos nos lares são espaço de crescimento e cuidado próximo.',
       null,
       'Qual dia da semana funciona melhor para você participar de um grupo nos lares?',
       3, true, true);
  end if;

  if not exists (
    select 1 from public.discipleship_modules m
     where m.tenant_id = p_tenant_id and m.sort_order = 5 and m.is_seed = true
  ) then
    insert into public.discipleship_modules (
      tenant_id, title, description, sort_order, is_active, is_seed
    ) values (
      p_tenant_id,
      'Servindo com Propósito (Ministérios e Mordomia)',
      'Dons, mordomia cristã e integração aos ministérios da igreja.',
      5, true, true
    )
    returning id into v_mod5;

    insert into public.discipleship_lessons (
      tenant_id, module_id, title, content, video_url, reflection_question, sort_order, is_active, is_seed
    ) values
      (p_tenant_id, v_mod5, 'Descobrindo meus Dons',
       'Nesta etapa você descobre seus dons espirituais preenchendo o Perfil Ministerial. Use o botão «Perfil Ministerial» para responder ao questionário e, em seguida, conclua a lição.',
       null, null, 1, true, true),
      (p_tenant_id, v_mod5, 'Mordomia Cristã',
       'Mordomia é administrar com fidelidade tempo, talentos e recursos para a glória de Deus.',
       null, null, 2, true, true),
      (p_tenant_id, v_mod5, 'Conhecendo os Ministérios da Igreja',
       'Conheça os ministérios e descubra onde pode servir com alegria.',
       null,
       'Em qual área ou ministério você sente maior desejo de servir?',
       3, true, true);
  end if;
end;
$$;

grant execute on function public.ensure_discipleship_trail_five_modules(uuid)
  to anon, authenticated, service_role;

do $$
declare
  r record;
begin
  for r in select id from public.igrejas
  loop
    perform public.ensure_discipleship_trail_five_modules(r.id);
  end loop;
end $$;

notify pgrst, 'reload schema';

select 'discipleship-trail-five-modules-patch: ok' as status;
