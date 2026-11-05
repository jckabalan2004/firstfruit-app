-- Firstfruit Commitment App: run this once in Supabase > SQL Editor.

create table if not exists public.members (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  commitment  numeric(12,2) not null default 0 check (commitment >= 0),
  created_at  timestamptz not null default now()
);

create table if not exists public.contributions (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  sunday      date not null check (extract(dow from sunday) = 0),
  amount      numeric(12,2) not null default 0 check (amount >= 0),
  created_at  timestamptz not null default now(),
  unique (member_id, sunday)
);

create index if not exists contributions_member_idx on public.contributions(member_id);
create index if not exists contributions_sunday_idx on public.contributions(sunday);

-- Per-member totals used by the public monitoring page.
create or replace view public.member_progress
with (security_invoker = true) as
select m.id,
       m.name,
       m.commitment,
       coalesce(sum(c.amount), 0)::numeric(12,2) as given,
       count(c.id) filter (where c.amount > 0)   as sundays_given
from public.members m
left join public.contributions c on c.member_id = m.id
group by m.id;

-- Row Level Security.
-- Everyone (members, via the public anon key) can READ.
-- Only a signed-in Supabase user (the admin) can WRITE.
-- Create the admin in Supabase > Authentication > Users, and turn OFF public sign-ups
-- (Authentication > Sign In / Providers > Email > disable "Allow new users to sign up").
alter table public.members       enable row level security;
alter table public.contributions enable row level security;

drop policy if exists "public read members"        on public.members;
drop policy if exists "public write members"       on public.members;
drop policy if exists "admin write members"        on public.members;
drop policy if exists "public read contributions"  on public.contributions;
drop policy if exists "public write contributions" on public.contributions;
drop policy if exists "admin write contributions"  on public.contributions;

create policy "public read members"  on public.members
  for select to anon, authenticated using (true);
create policy "admin write members" on public.members
  for all to authenticated using (true) with check (true);

create policy "public read contributions"  on public.contributions
  for select to anon, authenticated using (true);
create policy "admin write contributions" on public.contributions
  for all to authenticated using (true) with check (true);

grant select on public.member_progress to anon, authenticated;
