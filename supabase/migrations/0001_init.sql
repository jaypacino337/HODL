-- HODL OR NO HODL — core schema.
-- Run with: supabase db push   (or paste into the Supabase SQL editor)
--
-- Token amounts are stored as numeric because SPL balances are u64 and can
-- overflow Postgres' signed bigint. Lamport amounts fit bigint, but numeric
-- everywhere keeps arithmetic in views loss-free.

create table if not exists public.rounds (
  id bigint generated always as identity primary key,
  round_number bigint not null unique,
  opened_at timestamptz not null default now(),
  locks_at timestamptz not null,
  settles_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'settled')),
  pot_lamports numeric not null default 0,
  winning_side text check (winning_side in ('HODL', 'NOHODL')),
  decision_blockhash text,
  settled_at timestamptz
);

create table if not exists public.picks (
  round_id bigint not null references public.rounds (id) on delete cascade,
  wallet text not null,
  side text not null check (side in ('HODL', 'NOHODL')),
  balance_at_pick numeric not null,
  signature text not null,
  picked_at timestamptz not null default now(),
  primary key (round_id, wallet)
);

create table if not exists public.payouts (
  id bigint generated always as identity primary key,
  round_id bigint not null references public.rounds (id) on delete cascade,
  wallet text not null,
  side text not null check (side in ('HODL', 'NOHODL')),
  weight numeric not null,
  amount_lamports numeric not null,
  tx_signature text,
  status text not null check (status in ('sent', 'failed'))
);

create table if not exists public.fee_claims (
  id bigint generated always as identity primary key,
  claimed_at timestamptz not null default now(),
  source text not null,
  lamports numeric not null,
  tx_signature text not null
);

create index if not exists idx_picks_round on public.picks (round_id);
create index if not exists idx_payouts_round on public.payouts (round_id);
create index if not exists idx_payouts_wallet on public.payouts (wallet);
create index if not exists idx_rounds_status on public.rounds (status);

-- The game-worker writes with the service-role key (bypasses RLS).
-- Everyone else — including the website if you ever point it straight at
-- Supabase — gets read-only access.
alter table public.rounds enable row level security;
alter table public.picks enable row level security;
alter table public.payouts enable row level security;
alter table public.fee_claims enable row level security;

create policy "public read rounds" on public.rounds for select using (true);
create policy "public read picks" on public.picks for select using (true);
create policy "public read payouts" on public.payouts for select using (true);
create policy "public read fee_claims" on public.fee_claims for select using (true);

-- Aggregations the API serves without doing group-bys in JS.

create or replace view public.round_summaries
with (security_invoker = on) as
select
  r.round_number,
  r.winning_side,
  r.decision_blockhash,
  r.pot_lamports,
  r.settled_at,
  count(p.id) filter (where p.status = 'sent') as winners_paid,
  coalesce(sum(p.amount_lamports) filter (where p.status = 'sent'), 0) as paid_lamports
from public.rounds r
left join public.payouts p on p.round_id = r.id
where r.status = 'settled'
group by r.id;

create or replace view public.leaderboard
with (security_invoker = on) as
select
  wallet,
  sum(amount_lamports) as total_won_lamports,
  count(*) as wins
from public.payouts
where status = 'sent'
group by wallet
order by total_won_lamports desc
limit 100;

create or replace view public.game_totals
with (security_invoker = on) as
select
  (select coalesce(sum(lamports), 0) from public.fee_claims) as total_claimed_lamports,
  (select coalesce(sum(amount_lamports), 0) from public.payouts where status = 'sent') as total_paid_lamports;
