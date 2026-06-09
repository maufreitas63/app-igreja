-- 50 perfis fictícios para testes de geolocalização (Caraguatatuba - SP).
-- Campos completos para onboarding: cpf, email, cep e endereço.
-- Prefixo [GEO] no nome e e-mail *@caraguatatuba.demo para remoção segura.
--
-- Pré-requisitos: public.format_phone_like_profiles, public.reserve_next_family_id()
-- (scripts/import-profiles-batch-seed.sql e register-member-atomic.sql).
--
-- Executar no SQL Editor do Supabase.

delete from public.profiles
where email like '%@caraguatatuba.demo'
   or full_name like '[GEO]%';

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
        (1, 'Ana Paula Ferreira', '90010010001', 'geo01@caraguatatuba.demo', '12970010001', '14/03/1988', '11660-010', 'Av. Arthur Costa e Silva', '120', 'Centro'),
        (2, 'Bruno Henrique Silva', '90010010002', 'geo02@caraguatatuba.demo', '12970010002', '22/07/1992', '11660-050', 'Rua Frei Galvão', '45', 'Centro'),
        (3, 'Carla Mendes Oliveira', '90010010003', 'geo03@caraguatatuba.demo', '12970010003', '05/11/1975', '11660-100', 'Rua Antonio Roberto de Oliveira', '310', 'Centro'),
        (4, 'Daniel Costa Santos', '90010010004', 'geo04@caraguatatuba.demo', '12970010004', '30/01/2001', '11660-150', 'Rua Maria Vitória Penna Franco', '88', 'Centro'),
        (5, 'Elena Rodrigues Lima', '90010010005', 'geo05@caraguatatuba.demo', '12970010005', '18/09/1968', '11660-200', 'Rua José Pereira da Costa', '502', 'Centro'),
        (6, 'Felipe Augusto Rocha', '90010010006', 'geo06@caraguatatuba.demo', '12970010006', '12/06/1985', '11661-010', 'Rua das Orquídeas', '15', 'Jardim Britânia'),
        (7, 'Gabriela Souza Martins', '90010010007', 'geo07@caraguatatuba.demo', '12970010007', '25/12/1996', '11661-100', 'Rua dos Coqueiros', '220', 'Jardim Britânia'),
        (8, 'Henrique Alves Pinto', '90010010008', 'geo08@caraguatatuba.demo', '12970010008', '03/04/1979', '11661-200', 'Rua São João', '67', 'Jardim Britânia'),
        (9, 'Isabela Campos Nunes', '90010010009', 'geo09@caraguatatuba.demo', '12970010009', '17/08/2010', '11662-010', 'Av. Marginal', '1450', 'Martim de Sá'),
        (10, 'João Pedro Barbosa', '90010010010', 'geo10@caraguatatuba.demo', '12970010010', '09/02/1983', '11662-100', 'Rua das Pitangueiras', '33', 'Martim de Sá'),
        (11, 'Karina Duarte Freitas', '90010010011', 'geo11@caraguatatuba.demo', '12970010011', '21/05/1990', '11663-010', 'Rua José Carij', '190', 'Pegorelli'),
        (12, 'Lucas Mendonça Vieira', '90010010012', 'geo12@caraguatatuba.demo', '12970010012', '11/10/1972', '11663-100', 'Rua Manoel da Costa', '74', 'Pegorelli'),
        (13, 'Mariana Teixeira Lopes', '90010010013', 'geo13@caraguatatuba.demo', '12970010013', '28/07/2005', '11664-010', 'Rua das Baleias', '410', 'Golfinhos'),
        (14, 'Nicolas Prado Cardoso', '90010010014', 'geo14@caraguatatuba.demo', '12970010014', '16/01/1994', '11664-100', 'Rua dos Golfinhos', '28', 'Golfinhos'),
        (15, 'Olivia Ramos Cunha', '90010010015', 'geo15@caraguatatuba.demo', '12970010015', '02/12/1980', '11665-010', 'Av. Marginal', '2100', 'Indaiá'),
        (16, 'Paulo Sérgio Moura', '90010010016', 'geo16@caraguatatuba.demo', '12970010016', '19/06/1965', '11665-100', 'Rua Ieda Rosa da Cruz', '156', 'Indaiá'),
        (17, 'Quitéria Nascimento', '90010010017', 'geo17@caraguatatuba.demo', '12970010017', '07/03/1959', '11665-200', 'Rua das Acácias', '91', 'Indaiá'),
        (18, 'Rafaela Borges Dias', '90010010018', 'geo18@caraguatatuba.demo', '12970010018', '23/09/1998', '11666-010', 'Rua Manuel Nardy', '340', 'Sumaré'),
        (19, 'Samuel Gomes Azevedo', '90010010019', 'geo19@caraguatatuba.demo', '12970010019', '15/04/1987', '11666-100', 'Rua dos Ipês', '12', 'Sumaré'),
        (20, 'Tatiana Farias Rezende', '90010010020', 'geo20@caraguatatuba.demo', '12970010020', '31/08/1977', '11667-010', 'Rua do Porto', '580', 'Porto Novo'),
        (21, 'Ubirajara Lins Neto', '90010010021', 'geo21@caraguatatuba.demo', '12970010021', '06/11/1991', '11667-100', 'Rua Beira Mar', '1024', 'Porto Novo'),
        (22, 'Valéria Pacheco Melo', '90010010022', 'geo22@caraguatatuba.demo', '12970010022', '27/02/1984', '11668-010', 'Rua do Morro', '77', 'Morro do Algodão'),
        (23, 'Wagner Silveira Torres', '90010010023', 'geo23@caraguatatuba.demo', '12970010023', '13/07/1970', '11669-010', 'Estrada Rio do Ouro', 'Km 2', 'Rio do Ouro'),
        (24, 'Ximena Andrade Brito', '90010010024', 'geo24@caraguatatuba.demo', '12970010024', '20/10/2003', '11670-010', 'Rua das Palmeiras', '265', 'Jardim das Palmeiras'),
        (25, 'Yuri Cavalcanti Paiva', '90010010025', 'geo25@caraguatatuba.demo', '12970010025', '08/05/1995', '11670-100', 'Rua Santa Clara', '44', 'Jardim das Palmeiras'),
        (26, 'Zilda Monteiro Faria', '90010010026', 'geo26@caraguatatuba.demo', '12970010026', '01/01/1962', '11671-010', 'Rua da Capela', '18', 'Capelinha'),
        (27, 'Adriano César Luna', '90010010027', 'geo27@caraguatatuba.demo', '12970010027', '24/04/1989', '11672-010', 'Rua Santa Rosa', '630', 'Santa Rosa'),
        (28, 'Beatriz Honorato Cruz', '90010010028', 'geo28@caraguatatuba.demo', '12970010028', '10/09/2008', '11673-010', 'Av. Pontal Santa Marina', '155', 'Pontal Santa Marina'),
        (29, 'César Augusto Viana', '90010010029', 'geo29@caraguatatuba.demo', '12970010029', '29/06/1976', '11674-010', 'Rua da Barranca', '203', 'Barranca'),
        (30, 'Débora Santana Rios', '90010010030', 'geo30@caraguatatuba.demo', '12970010030', '14/02/1993', '11675-010', 'Rua Colorado', '89', 'Colorado'),
        (31, 'Eduardo Pinheiro Maia', '90010010031', 'geo31@caraguatatuba.demo', '12970010031', '26/11/1981', '11676-010', 'Rodovia Dr. Manoel Hipólito do Rego', '1200', 'Massaguaçu'),
        (32, 'Fabiana Lacerda Pires', '90010010032', 'geo32@caraguatatuba.demo', '12970010032', '04/08/1997', '11676-100', 'Rua da Praia de Massaguaçu', '55', 'Massaguaçu'),
        (33, 'Gustavo Neri Fonseca', '90010010033', 'geo33@caraguatatuba.demo', '12970010033', '18/03/1969', '11677-010', 'Estrada da Cocanha', '450', 'Cocanha'),
        (34, 'Helena Moura Bastos', '90010010034', 'geo34@caraguatatuba.demo', '12970010034', '22/12/2000', '11678-010', 'Estrada do Travessão', '780', 'Travessão'),
        (35, 'Igor Veloso Marques', '90010010035', 'geo35@caraguatatuba.demo', '12970010035', '07/07/1986', '11679-010', 'Rua da Praia', '312', 'Praia das Palmeiras'),
        (36, 'Juliana Ribeiro Peixoto', '90010010036', 'geo36@caraguatatuba.demo', '12970010036', '16/05/1974', '11680-010', 'Estrada do Caminho do Mar', '95', 'Caminho do Mar'),
        (37, 'Kleber Antunes Soares', '90010010037', 'geo37@caraguatatuba.demo', '12970010037', '30/10/1992', '11680-100', 'Rua Tinga', '140', 'Tinga'),
        (38, 'Larissa Coelho Braga', '90010010038', 'geo38@caraguatatuba.demo', '12970010038', '12/01/2006', '11660-120', 'Rua Francisco Loup', '56', 'Centro'),
        (39, 'Marcelo Dutra Campos', '90010010039', 'geo39@caraguatatuba.demo', '12970010039', '25/09/1982', '11661-150', 'Rua Prof. João Mendes', '401', 'Jardim Britânia'),
        (40, 'Natália Espíndola Reis', '90010010040', 'geo40@caraguatatuba.demo', '12970010040', '03/06/1999', '11662-150', 'Rua Martim de Sá', '1180', 'Martim de Sá'),
        (41, 'Otávio Guimarães Leal', '90010010041', 'geo41@caraguatatuba.demo', '12970010041', '19/04/1967', '11663-150', 'Rua Pegorelli', '22', 'Pegorelli'),
        (42, 'Patrícia Holanda Siqueira', '90010010042', 'geo42@caraguatatuba.demo', '12970010042', '11/08/1991', '11664-150', 'Rua Oceânica', '707', 'Golfinhos'),
        (43, 'Renato Ibiapina Torres', '90010010043', 'geo43@caraguatatuba.demo', '12970010043', '28/02/1978', '11665-150', 'Rua Indaiá Mirim', '333', 'Indaiá'),
        (44, 'Simone Jardim Xavier', '90010010044', 'geo44@caraguatatuba.demo', '12970010044', '06/12/1988', '11666-150', 'Rua Sumaré', '168', 'Sumaré'),
        (45, 'Thiago Keller Zanetti', '90010010045', 'geo45@caraguatatuba.demo', '12970010045', '21/07/2002', '11667-150', 'Rua Porto Grande', '92', 'Porto Novo'),
        (46, 'Úrsula Lemos Vargas', '90010010046', 'geo46@caraguatatuba.demo', '12970010046', '09/03/1955', '11668-100', 'Rua Vista Mar', '17', 'Morro do Algodão'),
        (47, 'Vitor Macedo Aguiar', '90010010047', 'geo47@caraguatatuba.demo', '12970010047', '17/11/1996', '11669-100', 'Rua Rio do Ouro', '244', 'Rio do Ouro'),
        (48, 'Wanessa Nogueira Pessoa', '90010010048', 'geo48@caraguatatuba.demo', '12970010048', '02/05/1980', '11670-150', 'Alameda das Palmeiras', '501', 'Jardim das Palmeiras'),
        (49, 'Xavier Oliveira Quintino', '90010010049', 'geo49@caraguatatuba.demo', '12970010049', '14/10/1973', '11671-100', 'Rua Capelinha', '63', 'Capelinha'),
        (50, 'Yasmin Pereira Rabelo', '90010010050', 'geo50@caraguatatuba.demo', '12970010050', '26/06/2012', '11672-100', 'Rua Santa Rosa', '890', 'Santa Rosa')
    ) as t(
      seq,
      full_name,
      cpf_raw,
      email,
      phone_raw,
      dob_br,
      cep,
      address_street,
      address_number,
      address_neighborhood
    )
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
      is_active,
      cep,
      address_street,
      address_number,
      address_neighborhood,
      address_city,
      address_state
    )
    values (
      '[GEO] ' || btrim(r.full_name),
      nullif(regexp_replace(r.cpf_raw, '[^0-9]', '', 'g'), ''),
      lower(btrim(r.email)),
      v_phone,
      to_date(r.dob_br, 'DD/MM/YYYY'),
      v_family_id,
      v_family_id,
      true,
      true,
      btrim(r.cep),
      btrim(r.address_street),
      btrim(r.address_number),
      btrim(r.address_neighborhood),
      'Caraguatatuba',
      'SP'
    );
  end loop;
end;
$$;

select
  p.full_name,
  p.phone,
  p.email,
  p.cpf,
  p.birth_date,
  p.cep,
  p.address_street,
  p.address_number,
  p.address_neighborhood,
  p.address_city,
  p.address_state,
  p.family_id
from public.profiles p
where p.email like '%@caraguatatuba.demo'
order by p.email;
