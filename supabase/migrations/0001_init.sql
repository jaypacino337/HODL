-- ATTENTION MARKETS — core schema.
-- Run with: supabase db push   (or paste into the Supabase SQL editor)
--
-- Lamport/token amounts are numeric so nothing overflows signed bigint.

-- ── fee engine ─────────────────────────────────────────────────────────

create table if not exists public.fee_claims (
  id bigint generated always as identity primary key,
  claimed_at timestamptz not null default now(),
  source text not null,
  lamports numeric not null,
  tx_signature text not null
);

create table if not exists public.buybacks (
  id bigint generated always as identity primary key,
  executed_at timestamptz not null default now(),
  lamports_spent numeric not null,
  tokens_bought numeric,
  tx_signature text,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  note text
);

-- Every internal money movement, so pools are pure accounting over one
-- treasury wallet: positive = into the named pool, negative = out.
create table if not exists public.ledger (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  pool text not null check (pool in ('buyback', 'rewards', 'dev')),
  lamports numeric not null,
  reason text not null,
  ref text
);

-- ── attention points ───────────────────────────────────────────────────

create table if not exists public.epochs (
  id bigint generated always as identity primary key,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'paid')),
  rewards_pool_lamports numeric not null default 0
);

create table if not exists public.social_posts (
  id bigint generated always as identity primary key,
  wallet text not null,
  url text not null unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  points integer not null default 0,
  epoch_id bigint references public.epochs (id),
  signature text not null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  note text
);

create table if not exists public.epoch_payouts (
  id bigint generated always as identity primary key,
  epoch_id bigint not null references public.epochs (id) on delete cascade,
  wallet text not null,
  points integer not null,
  amount_lamports numeric not null,
  tx_signature text,
  status text not null check (status in ('sent', 'failed'))
);

-- ── ads ────────────────────────────────────────────────────────────────

create table if not exists public.ads (
  id bigint generated always as identity primary key,
  wallet text not null,
  headline text not null,
  url text not null,
  days integer not null check (days between 1 and 30),
  price_lamports numeric not null,
  booking_code text not null unique,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'active', 'expired', 'rejected')),
  payment_signature text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── attention scanner ──────────────────────────────────────────────────

create table if not exists public.scans (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  sources jsonb not null default '[]'::jsonb
);

create table if not exists public.scan_items (
  id bigint generated always as identity primary key,
  scan_id bigint not null references public.scans (id) on delete cascade,
  rank integer not null,
  source text not null,
  symbol text not null,
  name text not null,
  score numeric not null,
  price_usd numeric,
  change_24h numeric,
  volume_24h_usd numeric,
  url text
);

create index if not exists idx_posts_wallet on public.social_posts (wallet);
create index if not exists idx_posts_epoch on public.social_posts (epoch_id);
create index if not exists idx_payouts_wallet on public.epoch_payouts (wallet);
create index if not exists idx_scan_items_scan on public.scan_items (scan_id);
create index if not exists idx_ads_status on public.ads (status);
create index if not exists idx_ledger_pool on public.ledger (pool);

-- The engine writes with the service-role key (bypasses RLS); the world
-- reads.
alter table public.fee_claims enable row level security;
alter table public.buybacks enable row level security;
alter table public.ledger enable row level security;
alter table public.epochs enable row level security;
alter table public.social_posts enable row level security;
alter table public.epoch_payouts enable row level security;
alter table public.ads enable row level security;
alter table public.scans enable row level security;
alter table public.scan_items enable row level security;

create policy "public read fee_claims" on public.fee_claims for select using (true);
create policy "public read buybacks" on public.buybacks for select using (true);
create policy "public read ledger" on public.ledger for select using (true);
create policy "public read epochs" on public.epochs for select using (true);
create policy "public read social_posts" on public.social_posts for select using (true);
create policy "public read epoch_payouts" on public.epoch_payouts for select using (true);
create policy "public read ads" on public.ads for select using (true);
create policy "public read scans" on public.scans for select using (true);
create policy "public read scan_items" on public.scan_items for select using (true);

-- ── aggregations ───────────────────────────────────────────────────────

create or replace view public.attention_leaderboard
with (security_invoker = on) as
select
  wallet,
  sum(points) as lifetime_points,
  count(*) filter (where status = 'approved') as approved_posts
from public.social_posts
where status = 'approved'
group by wallet
order by lifetime_points desc
limit 100;

create or replace view public.platform_totals
with (security_invoker = on) as
select
  (select coalesce(sum(lamports), 0) from public.fee_claims) as fees_claimed_lamports,
  (select coalesce(sum(lamports_spent), 0) from public.buybacks where status = 'sent') as buyback_spent_lamports,
  (select coalesce(sum(amount_lamports), 0) from public.epoch_payouts where status = 'sent') as rewards_paid_lamports,
  (select coalesce(sum(price_lamports), 0) from public.ads where status in ('active', 'expired')) as ad_revenue_lamports,
  (select coalesce(sum(-lamports), 0) from public.ledger where pool = 'dev' and lamports < 0) as dev_paid_lamports,
  (select coalesce(sum(lamports), 0) from public.ledger where pool = 'buyback') as buyback_pool_lamports;
