-- Progresso da transcrição da pregação, gravado em partes para caber no tempo da função.

begin;

alter table public.weekly_sermon_archives
  add column if not exists transcript_complete boolean not null default false;

alter table public.weekly_sermon_archives
  add column if not exists transcript_offset_seconds integer not null default 0;

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
    'transcriptComplete', v_row.transcript_complete,
    'offsetSeconds', v_row.transcript_offset_seconds
  );
end;
$$;

revoke all on function public.weekly_quiz_sermon_archive(text) from public;
grant execute on function public.weekly_quiz_sermon_archive(text) to anon, authenticated, service_role;

drop function if exists public.weekly_quiz_save_transcript(text, text, timestamptz, text, boolean);

create or replace function public.weekly_quiz_save_transcript(
  p_video_id text,
  p_title text,
  p_sermon_published_at timestamptz,
  p_transcript text,
  p_complete boolean,
  p_offset_seconds integer default 0
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
  v_offset integer := greatest(coalesce(p_offset_seconds, 0), 0);
begin
  if v_video !~ '^[A-Za-z0-9_-]{6,20}$' then
    raise exception 'Vídeo do YouTube inválido.';
  end if;

  if v_title = '' or p_sermon_published_at is null then
    raise exception 'A pregação precisa de título e data de publicação.';
  end if;

  if coalesce(p_complete, false) and length(v_transcript) < 400 then
    raise exception 'A transcrição desta pregação está curta demais para gerar o quiz.';
  end if;

  if length(v_transcript) < 1 and v_offset <= 0 then
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
    tenant_id, video_id, title, sermon_published_at, transcript, transcript_complete, transcript_offset_seconds
  ) values (
    v_tenant,
    v_video,
    left(v_title, 300),
    p_sermon_published_at,
    left(v_transcript, 150000),
    coalesce(p_complete, false),
    v_offset
  )
  on conflict (tenant_id, video_id) do update
    set title = excluded.title,
        sermon_published_at = excluded.sermon_published_at,
        transcript = excluded.transcript,
        transcript_complete = excluded.transcript_complete,
        transcript_offset_seconds = excluded.transcript_offset_seconds,
        updated_at = now();

  return jsonb_build_object(
    'videoId', v_video,
    'chars', length(left(v_transcript, 150000)),
    'complete', coalesce(p_complete, false)
  );
end;
$$;

revoke all on function public.weekly_quiz_save_transcript(text, text, timestamptz, text, boolean, integer) from public;
grant execute on function public.weekly_quiz_save_transcript(text, text, timestamptz, text, boolean, integer) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
