-- Importa perfis com histórico de membresia (visitantes / ex-membros) — família IBN0000.
-- IMPORTANTE: este arquivo NÃO roda no Cloudflare — execute manualmente no SQL Editor do Supabase.
-- O push para main só publica o PWA; a importação dos perfis é sempre manual aqui.
-- Execute no SQL Editor do Supabase após:
--   scripts/normalize-full-name-fields.sql (format_full_name_ptbr)
--   scripts/access-control-pastoral-membership-date.sql
--   scripts/access-control-pastoral-membership-out.sql
--   scripts/access-control-visitantes-auto-assign.sql (ensure_profile_visitantes_role)
--
-- Origem: planilha com 10 registros (membership_date + membership_out).
-- Telefone (12) 99999-9999 é placeholder → gravado como NULL (evita duplicata em phone).
-- Papel "visitor" → apenas visitantes em profile_access_roles (remove member/congregado).

do $$
declare
  r record;
  v_profile_id uuid;
  v_full_name text;
begin
  for r in
    select *
    from (
      values
        ('ALINE GUELLA', '24/10/2025', '14/03/2025'),
        ('ANDRÉ FILIPE RAMOS DA SILVA', '24/10/2025', '14/03/2025'),
        ('CRISTIANE CALDERAN', '28/02/2026', '14/03/2025'),
        ('DANIELE DOS SANTOS VELOSO COSTA BORGES', '21/11/2025', '27/10/2024'),
        ('DÉBORA MOREIRA DE PAULA', '28/02/2026', '27/10/2024'),
        ('DOUGLAS SANTANA DA SILVA', '28/02/2026', '14/03/2025'),
        ('FERNANDO CÉSAR DE OLIVEIRA MARTINS', '28/02/2026', '14/03/2025'),
        ('GUILHERME GONÇALVES BORGES', '21/11/2025', '27/10/2024'),
        ('JESSICA PRISCILA LANCIERI RAMOS', '24/10/2025', '14/03/2025'),
        ('RUI CARLOS DE PAULA', '28/02/2026', '27/10/2024')
    ) as t(full_name_raw, membership_out_br, membership_date_br)
    order by t.full_name_raw
  loop
    v_full_name := public.format_full_name_ptbr(r.full_name_raw);

    select p.id
      into v_profile_id
      from public.profiles p
     where lower(trim(coalesce(p.full_name, ''))) = lower(trim(v_full_name))
     order by p.updated_at desc nulls last
     limit 1;

    if v_profile_id is null then
      insert into public.profiles (
        full_name,
        phone,
        family_id,
        codigo_membro,
        membership_date,
        membership_out,
        lgpd_accepted,
        is_active
      )
      values (
        v_full_name,
        null,
        'IBN0000',
        'IBN0000',
        to_date(r.membership_date_br, 'DD/MM/YYYY'),
        to_date(r.membership_out_br, 'DD/MM/YYYY'),
        true,
        true
      )
      returning id into v_profile_id;
    else
      update public.profiles p
         set full_name = v_full_name,
             family_id = 'IBN0000',
             codigo_membro = 'IBN0000',
             membership_date = to_date(r.membership_date_br, 'DD/MM/YYYY'),
             membership_out = to_date(r.membership_out_br, 'DD/MM/YYYY'),
             updated_at = now()
       where p.id = v_profile_id;
    end if;

    delete from public.profile_access_roles par
     using public.access_roles ar
     where par.profile_id = v_profile_id
       and par.role_id = ar.id
       and ar.code in ('member', 'congregado', 'family_acceptor');

    perform public.ensure_profile_visitantes_role(v_profile_id);
  end loop;
end;
$$;

-- Conferência
select
  p.full_name,
  p.phone,
  p.family_id,
  p.codigo_membro,
  p.membership_date,
  p.membership_out,
  public.resolve_basic_role_code_for_profile(p.id) as role_code
from public.profiles p
where lower(trim(coalesce(p.full_name, ''))) in (
  lower('Aline Guella'),
  lower('André Filipe Ramos da Silva'),
  lower('Cristiane Calderan'),
  lower('Daniele dos Santos Veloso Costa Borges'),
  lower('Débora Moreira de Paula'),
  lower('Douglas Santana da Silva'),
  lower('Fernando César de Oliveira Martins'),
  lower('Guilherme Gonçalves Borges'),
  lower('Jessica Priscila Lancieri Ramos'),
  lower('Rui Carlos de Paula')
)
order by p.full_name;

notify pgrst, 'reload schema';
