-- Data de casamento em members (mesmo tipo date de birth_date).
-- Aplica: npx supabase db query --linked -f scripts/members-marriage-date.sql

alter table public.members
  add column if not exists marriage_date date;

comment on column public.members.marriage_date is
  'Data de casamento (AAAA-MM-DD). Mesmo padrão de members.birth_date.';

alter table public.recepcao_cadastro_familiar
  add column if not exists marriage_date date;

comment on column public.recepcao_cadastro_familiar.marriage_date is
  'Data de casamento informada no formulário público (AAAA-MM-DD).';

-- ---------------------------------------------------------------------------
-- RPC upsert: passa a gravar marriage_date (assinatura nova; drop da antiga).
-- ---------------------------------------------------------------------------

drop function if exists public.upsert_family_member(text, text, text, date, text, boolean);

create or replace function public.upsert_family_member(
  p_family_id text,
  p_full_name text,
  p_phone text default null,
  p_birth_date date default null,
  p_relationship text default 'Outros',
  p_accepted boolean default true,
  p_marriage_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id text;
  v_full_name text;
  v_phone text;
  v_relationship text;
  v_member_id uuid;
  v_created boolean := false;
  v_member public.members%rowtype;
begin
  v_family_id := public.normalize_member_family_id(p_family_id);
  v_full_name := nullif(trim(coalesce(p_full_name, '')), '');
  v_phone := nullif(trim(coalesce(p_phone, '')), '');
  v_relationship := nullif(trim(coalesce(p_relationship, '')), '');

  if v_family_id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Código de família inválido.'
    );
  end if;

  if v_full_name is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Nome do integrante é obrigatório.'
    );
  end if;

  if v_relationship is null then
    v_relationship := 'Outros';
  end if;

  v_member_id := public.find_member_id_in_family(v_family_id, v_phone, v_full_name);

  if v_member_id is not null then
    update public.members m
       set full_name = v_full_name,
           phone = coalesce(v_phone, m.phone),
           birth_date = coalesce(p_birth_date, m.birth_date),
           marriage_date = coalesce(p_marriage_date, m.marriage_date),
           relationship = coalesce(v_relationship, m.relationship),
           family_id = v_family_id,
           accepted = coalesce(p_accepted, m.accepted)
     where m.id = v_member_id
     returning * into v_member;
  else
    insert into public.members (
      full_name,
      phone,
      birth_date,
      marriage_date,
      relationship,
      family_id,
      accepted
    ) values (
      v_full_name,
      v_phone,
      p_birth_date,
      p_marriage_date,
      v_relationship,
      v_family_id,
      coalesce(p_accepted, true)
    )
    returning * into v_member;

    v_created := true;
  end if;

  return jsonb_build_object(
    'success', true,
    'created', v_created,
    'member_id', v_member.id,
    'member', to_jsonb(v_member)
  );
exception
  when unique_violation then
    v_member_id := public.find_member_id_in_family(v_family_id, v_phone, v_full_name);

    if v_member_id is null then
      return jsonb_build_object(
        'success', false,
        'message', sqlerrm
      );
    end if;

    select * into v_member from public.members where id = v_member_id;

    return jsonb_build_object(
      'success', true,
      'created', false,
      'member_id', v_member.id,
      'member', to_jsonb(v_member)
    );
  when others then
    return jsonb_build_object(
      'success', false,
      'message', sqlerrm
    );
end;
$$;

grant execute on function public.upsert_family_member(text, text, text, date, text, boolean, date)
  to anon, authenticated;

-- Alinhamento RL ↔ Cônjuge: scripts/members-sync-couple-marriage-date.sql

