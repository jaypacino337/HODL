-- OVERBID — oracle worker ledger.
-- Public read (the website reads via the worker API or the anon key),
-- service-role write (the worker only).

create table if not exists index_feeds (
  id text primary key,               -- e.g. 'parcl:price:miami'
  city text not null,                -- display name
  metric text not null,              -- e.g. 'price feed ($/sqft)'
  provider text not null default 'parcl-labs',
  provider_ref text,                 -- provider-side id (Parcl market id)
  created_at timestamptz not null default now()
);

create table if not exists index_observations (
  id bigint generated always as identity primary key,
  feed_id text not null references index_feeds (id),
  observed_on date not null,
  value numeric not null,
  fetched_at timestamptz not null default now(),
  unique (feed_id, observed_on)
);

create table if not exists markets (
  slug text primary key,
  question text not null,
  category text not null,
  rule jsonb not null,               -- SettlementRule from @overbid/shared
  outcomes jsonb not null,           -- [{id,label}]
  locks_at timestamptz not null,
  settles_at timestamptz not null,
  status text not null default 'open' check (status in ('open','locked','settled')),
  created_by text not null default 'protocol',
  seed_liquidity_usd numeric not null default 0,
  chain_address text,                -- OverbidMarket address once deployed
  created_at timestamptz not null default now()
);

create table if not exists settlements (
  market_slug text primary key references markets (slug),
  winning_outcome_id text not null,
  changes_pct jsonb not null,        -- {outcomeId: pctChange}
  evidence jsonb not null,           -- feed ids + window + start/end values used
  tx_hash text,                      -- on-chain resolveMarket tx, when live
  settled_at timestamptz not null default now()
);

-- RLS: world-readable, writes only via service role.
alter table index_feeds enable row level security;
alter table index_observations enable row level security;
alter table markets enable row level security;
alter table settlements enable row level security;

create policy "public read feeds" on index_feeds for select using (true);
create policy "public read observations" on index_observations for select using (true);
create policy "public read markets" on markets for select using (true);
create policy "public read settlements" on settlements for select using (true);
