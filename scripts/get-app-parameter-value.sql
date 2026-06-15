create or replace function public.get_app_parameter_value(p_parameter text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_value text;
begin
  select ap.value
  into v_value
  from public.app_parameters ap
  where lower(trim(ap.parameter)) = lower(trim(p_parameter))
  order by
    case when ap.parameter = trim(p_parameter) then 0 else 1 end,
    ap.parameter
  limit 1;

  return v_value;
end;
$$;

grant execute on function public.get_app_parameter_value(text) to anon;
grant execute on function public.get_app_parameter_value(text) to authenticated;
