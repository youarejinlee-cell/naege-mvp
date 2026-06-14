alter table public.entries
drop constraint if exists entries_energy_check;

update public.entries
set energy = case
  when energy between 0 and 100 and energy % 10 = 0 then energy
  when energy between 1 and 5 then energy * 20
  when energy between 1 and 7 then greatest(10, least(100, round((energy::numeric / 7) * 10) * 10))::integer
  else greatest(0, least(100, round((energy::numeric / 10) * 10)))::integer
end;

alter table public.entries
add constraint entries_energy_check
check (energy between 0 and 100 and energy % 10 = 0);
