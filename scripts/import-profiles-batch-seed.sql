-- Insere perfis de teste em public.profiles.
--
-- Pre-requisitos no Supabase:
-- - public.reserve_next_family_id() (scripts/register-member-atomic.sql), que usa
--   o parametro last_family_id em app_parameters (ultimo sufixo emitido) e mantem
--   family_ref = proximo indice para compatibilidade com o app.
-- - Prefixo do codigo (ex.: ABC0001): app_parameters.parm_entidade (funcao get_family_id_prefix no SQL).
-- - Colunas: full_name, cpf, email, phone, birth_date, family_id, codigo_membro,
--   lgpd_accepted, is_active (remova cpf/email do INSERT se nao existirem).
-- - Cada linha recebe family_id/codigo_membro sequenciais na ordem de `seq` (1..N),
--   uma chamada a public.reserve_next_family_id() por insert.
--
-- Telefone: mesmo padrao do app (manage-profile formatPhone) via format_phone_like_profiles.
-- CPF: apenas digitos (remove sufixo nao numerico, ex.: 27198106811x).
-- Data: DD/MM/AAAA -> date.

create or replace function public.format_phone_like_profiles(p_raw text)
returns text
language plpgsql
immutable
as $$
declare
  d text := regexp_replace(coalesce(p_raw, ''), '[^0-9]', '', 'g');
  n int := length(d);
begin
  if n = 0 then
    return '';
  end if;

  if n <= 2 then
    return d;
  end if;

  if n <= 6 then
    return '(' || substring(d from 1 for 2) || ') ' || substring(d from 3);
  end if;

  if n <= 10 then
    return '(' || substring(d from 1 for 2) || ') ' || substring(d from 3 for 4) || '-' || substring(d from 7);
  end if;

  return '(' || substring(d from 1 for 2) || ') ' || substring(d from 3 for 5) || '-' || substring(d from 8 for 4);
end;
$$;

grant execute on function public.format_phone_like_profiles(text) to anon;
grant execute on function public.format_phone_like_profiles(text) to authenticated;

-- Um family_id por linha, na ordem de `seq` (chama reserve_next_family_id uma vez por iteracao).
do $$
declare
  r record;
  v_family_id text;
  v_phone text;
begin
  for r in
    select *
    from (
      values
        (1, 'Armando Mello', '15026525873', 'carlos.ant@email.com', '(12) 99767-7123', '12/04/1975'),
        (2, 'Christian Alberto Magalhães', '27198106811x', 'madu.costa@email.com', '(12) 99790-8570', '25/08/1988'),
        (3, 'Daniel da Silva Araujo', '32033416895', 'jp.mendes@email.com', '(12) 97411-3377', '05/02/2001'),
        (4, 'Edu', '12448161836', 'ana.bea@email.com', '(12) 99123-3740', '30/12/1992'),
        (5, 'Filipe Alves Cavalcante', '45284248864', 'paulo.farias@email.com', '(11) 98534-6164', '14/07/1965'),
        (6, 'Gabriel Dias Alberti', '38281921811', 'lucia.fer@email.com', '(12) 98246-1546', '22/03/1958'),
        (7, 'Julio André Pereira da Silva', '89279042491', 'gab.oliver@email.com', '(12) 98823-4944', '02/01/1963'),
        (8, 'Marcio Fernandes Garcia', '04804123830', 'carla.souza@email.com', '(11) 97675-3628', '18/05/1982'),
        (9, 'Paulo Vitor Gottsfritz Borges', '08161083401', 'helena.matos@email.com', '(12) 99732-0944', '15/11/1970'),
        (10, 'Rafael Luiz dos Santos', '42754769803', 'sergio.m@email.com', '(12) 99143-7787', '30/06/1985'),
        (11, 'Tiago Noboru Ukei', '36921719863', 'paty.amaral@email.com', '(11) 96196-7663', '12/09/1990')
    ) as t(seq, full_name, cpf_raw, email, phone_raw, dob_br)
    order by t.seq
  loop
    v_phone := public.format_phone_like_profiles(r.phone_raw);
    if btrim(r.full_name) = '' or v_phone = '' then
      continue;
    end if;

    v_family_id := public.reserve_next_family_id();

    insert into public.profiles (
      full_name,
      cpf,
      email,
      phone,
      birth_date,
      family_id,
      codigo_membro,
      lgpd_accepted,
      is_active
    )
    values (
      btrim(r.full_name),
      nullif(regexp_replace(r.cpf_raw, '[^0-9]', '', 'g'), ''),
      nullif(lower(btrim(r.email)), ''),
      v_phone,
      to_date(r.dob_br, 'DD/MM/YYYY'),
      v_family_id,
      v_family_id,
      true,
      true
    );
  end loop;
end;
$$;

select
  p.full_name,
  p.phone,
  p.cpf,
  p.email,
  p.birth_date,
  p.family_id
from public.profiles p
where p.full_name in (
    'Armando Mello',
    'Christian Alberto Magalhães',
    'Daniel da Silva Araujo',
    'Edu',
    'Filipe Alves Cavalcante',
    'Gabriel Dias Alberti',
    'Julio André Pereira da Silva',
    'Marcio Fernandes Garcia',
    'Paulo Vitor Gottsfritz Borges',
    'Rafael Luiz dos Santos',
    'Tiago Noboru Ukei'
  )
order by p.family_id;
