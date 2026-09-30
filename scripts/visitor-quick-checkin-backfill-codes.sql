-- Backfill de códigos de check-in visitante para eventos próximos.
update public.events e
set visitor_checkin_code = lpad((abs(hashtext(e.id::text)) % 10000)::text, 4, '0')
where visitor_checkin_code is null
  and (e.event_date at time zone 'America/Sao_Paulo')::date between current_date - 1 and current_date + 14;

do $$
declare
  r record;
  v_code text;
  v_n int;
begin
  for r in
    select e.id, e.tenant_id, e.visitor_checkin_code
      from public.events e
      join (
        select tenant_id, visitor_checkin_code
          from public.events
         where visitor_checkin_code is not null
         group by tenant_id, visitor_checkin_code
        having count(*) > 1
      ) d on d.tenant_id is not distinct from e.tenant_id
         and d.visitor_checkin_code = e.visitor_checkin_code
  loop
    v_n := 0;
    loop
      v_n := v_n + 1;
      v_code := lpad(((abs(hashtext(r.id::text)) + v_n) % 10000)::text, 4, '0');
      exit when not exists (
        select 1 from public.events x
         where x.visitor_checkin_code = v_code
           and x.tenant_id is not distinct from r.tenant_id
           and x.id <> r.id
      );
      exit when v_n > 50;
    end loop;
    update public.events set visitor_checkin_code = v_code where id = r.id;
  end loop;
end
$$;

select id, name, visitor_checkin_code,
       (event_date at time zone 'America/Sao_Paulo')::date as d
  from public.events
 where (event_date at time zone 'America/Sao_Paulo')::date between current_date - 1 and current_date + 2
 order by event_date;
