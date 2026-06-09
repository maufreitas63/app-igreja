-- Celular EXCLUSIVO do dispositivo totem (não cadastrar em profiles).
-- Login: senha fixa 9999, sem cadastro, LGPD nem PIN de membro.
-- Substitua pelo número real do tablet (somente dígitos ou com máscara).

insert into public.app_parameters (parameter, value)
values ('cel_totem', '11999999999')
on conflict (parameter) do update
set value = excluded.value;
