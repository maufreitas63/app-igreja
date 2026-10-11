-- Progresso da transcrição da pregação, gravado em partes para caber no tempo da função.

begin;

alter table public.weekly_sermon_archives
  add column if not exists transcript_complete boolean not null default false;

create or replace function public.weekly_quiz_sermon_archive(p_video_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.weekly_quiz_assert_editor();
  v_video text := trim(coalesce(p_video_id, ''));
  v_row public.weekly_sermon_archives%rowtype;
begin
  if v_video !~ '^[A-Za-z0-9_-]{6,20}$' then
    return null;
  end if;

  select *
    into v_row
  from public.weekly_sermon_archives a
  where a.tenant_id = v_tenant
    and a.video_id = v_video;

  if v_row.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'videoId', v_row.video_id,
    'title', v_row.title,
    'sermonPublishedAt', v_row.sermon_published_at,
    'transcript', v_row.transcript,
    'contextSummary', v_row.context_summary,
    'transcriptComplete', v_row.transcript_complete
  );
end;
$$;

revoke all on function public.weekly_quiz_sermon_archive(text) from public;
grant execute on function public.weekly_quiz_sermon_archive(text) to anon, authenticated, service_role;

create or replace function public.weekly_quiz_save_transcript(
  p_video_id text,
  p_title text,
  p_sermon_published_at timestamptz,
  p_transcript text,
  p_complete boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.weekly_quiz_assert_editor();
  v_video text := trim(coalesce(p_video_id, ''));
  v_title text := trim(coalesce(p_title, ''));
  v_transcript text := trim(coalesce(p_transcript, ''));
begin
  if v_video !~ '^[A-Za-z0-9_-]{6,20}$' then
    raise exception 'Vídeo do YouTube inválido.';
  end if;

  if v_title = '' or p_sermon_published_at is null then
    raise exception 'A pregação precisa de título e data de publicação.';
  end if;

  if length(v_transcript) < 400 then
    raise exception 'A transcrição desta pregação está curta demais para gerar o quiz.';
  end if;

  if exists (
    select 1
      from public.weekly_quizzes q
     where q.tenant_id = v_tenant
       and q.video_id = v_video
  ) then
    raise exception 'Esta pregação já foi transformada em quiz.';
  end if;

  if exists (
    select 1
      from public.weekly_quizzes q
     where q.tenant_id = v_tenant
       and q.status = 'draft'
  ) then
    raise exception 'Já existe um quiz em prévia. Publique ou descarte antes de buscar outra pregação.';
  end if;

  insert into public.weekly_sermon_archives (
    tenant_id, video_id, title, sermon_published_at, transcript, transcript_complete
  ) values (
    v_tenant,
    v_video,
    left(v_title, 300),
    p_sermon_published_at,
    left(v_transcript, 150000),
    coalesce(p_complete, false)
  )
  on conflict (tenant_id, video_id) do update
    set title = excluded.title,
        sermon_published_at = excluded.sermon_published_at,
        transcript = excluded.transcript,
        transcript_complete = excluded.transcript_complete,
        updated_at = now();

  return jsonb_build_object(
    'videoId', v_video,
    'chars', length(left(v_transcript, 150000)),
    'complete', coalesce(p_complete, false)
  );
end;
$$;

revoke all on function public.weekly_quiz_save_transcript(text, text, timestamptz, text, boolean) from public;
grant execute on function public.weekly_quiz_save_transcript(text, text, timestamptz, text, boolean) to anon, authenticated, service_role;

commit;
