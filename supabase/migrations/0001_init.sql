-- THE BOARDROOM — core schema.
-- Run with: supabase db push   (or paste into the Supabase SQL editor)
--
-- Write model: ONLY the engine writes, using the service-role key (bypasses
-- RLS). Everything a visitor can see on the site is world-readable; the
-- audit log and holder snapshot internals are service-role only.

-- ── sessions ───────────────────────────────────────────────────────────

create table if not exists public.sessions (
  id text primary key,
  number integer not null unique,
  stage text not null,
  stage_started_at timestamptz not null default now(),
  started_at timestamptz not null default now(),
  snapshot_id text,
  kind text not null default 'live' check (kind in ('live', 'demo')),
  model_id text not null,
  prompt_version_hash text not null
);

create table if not exists public.treasury_snapshots (
  id text primary key,
  taken_at timestamptz not null default now(),
  chain_id integer not null,
  treasury_address text,
  balances jsonb not null,
  total_usd numeric not null,
  available_usd numeric not null,
  reserved_liabilities_usd numeric not null default 0,
  recent_revenue_usd numeric not null default 0,
  previous_allocations jsonb not null default '[]'::jsonb,
  policy_version text not null,
  verified boolean not null default false
);

create table if not exists public.messages (
  id text primary key,
  session_id text not null,
  seq bigint not null,
  stage text not null,
  kind text not null,
  agent_id text,
  user_wallet text,
  ref_proposal_id text,
  body text not null,
  at timestamptz not null default now(),
  unique (session_id, seq)
);

-- ── proposals & votes ──────────────────────────────────────────────────

create table if not exists public.proposals (
  id text primary key,
  session_id text not null,
  agent_id text not null,
  revision integer not null default 1,
  title text not null,
  action_type text not null,
  asset text not null,
  recipient text,
  amount_usd numeric not null,
  pct_of_available numeric not null default 0,
  max_slippage_bps integer not null default 0,
  expires_at timestamptz not null,
  expected_result text not null,
  primary_risk text not null,
  supporting_data text not null,
  status text not null check (status in (
    'DRAFT','DEBATING','VOTING','PASSED','REJECTED','AWAITING_HOLDER_VOTE',
    'AWAITING_EXECUTION','EXECUTING','EXECUTED','FAILED','EXPIRED','CANCELLED')),
  created_at timestamptz not null default now(),
  policy_violation jsonb
);

-- one vote per agent per proposal, enforced by the primary key
create table if not exists public.agent_votes (
  proposal_id text not null references public.proposals (id),
  agent_id text not null,
  choice text not null check (choice in ('YES', 'NO', 'ABSTAIN')),
  explanation text not null,
  cast_at timestamptz not null default now(),
  primary key (proposal_id, agent_id)
);

-- ── holder governance ──────────────────────────────────────────────────

create table if not exists public.holder_snapshots (
  id bigint generated always as identity primary key,
  proposal_id text not null references public.proposals (id),
  snapshot_block bigint,
  taken_at timestamptz not null default now(),
  -- excluded classes recorded explicitly so exclusions are auditable
  excluded_wallets jsonb not null default '[]'::jsonb,
  total_power numeric not null default 0,
  quorum_power numeric not null default 0,
  active boolean not null default false
);

-- one holder vote per wallet per proposal
create table if not exists public.holder_votes (
  proposal_id text not null references public.proposals (id),
  wallet text not null,
  choice text not null check (choice in ('FOR', 'AGAINST', 'ABSTAIN')),
  power numeric not null default 0,
  delegate_of text,
  cast_at timestamptz not null default now(),
  primary key (proposal_id, wallet)
);

-- ── execution ──────────────────────────────────────────────────────────

create table if not exists public.execution_intents (
  id text primary key,
  proposal_id text not null references public.proposals (id),
  idempotency_key text not null unique,
  action_type text not null,
  asset text not null,
  recipient text,
  amount_usd numeric not null,
  max_slippage_bps integer not null,
  expires_at timestamptz not null,
  simulated boolean not null default false,
  status text not null check (status in ('PENDING','SIMULATED','SUBMITTED','CONFIRMED','FAILED','ABORTED')),
  created_at timestamptz not null default now()
);

create table if not exists public.receipts (
  proposal_id text primary key references public.proposals (id),
  tx_hash text not null,
  chain_id integer not null,
  block_number bigint not null,
  ts timestamptz not null,
  asset text not null,
  amount_usd numeric not null,
  recipient text,
  agent_votes jsonb not null,
  holder_tally jsonb,
  final_status text not null check (final_status in ('EXECUTED', 'FAILED'))
);

-- ── governance record keeping ──────────────────────────────────────────

create table if not exists public.policy_violations (
  id bigint generated always as identity primary key,
  session_id text not null,
  proposal_id text,
  agent_id text,
  rule text not null,
  rule_text text not null,
  at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  kind text not null,
  detail jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);

create index if not exists idx_messages_session on public.messages (session_id, seq);
create index if not exists idx_proposals_session on public.proposals (session_id);
create index if not exists idx_proposals_agent on public.proposals (agent_id);
create index if not exists idx_intents_proposal on public.execution_intents (proposal_id);
create index if not exists idx_violations_session on public.policy_violations (session_id);

-- ── RLS ────────────────────────────────────────────────────────────────

alter table public.sessions enable row level security;
alter table public.treasury_snapshots enable row level security;
alter table public.messages enable row level security;
alter table public.proposals enable row level security;
alter table public.agent_votes enable row level security;
alter table public.holder_snapshots enable row level security;
alter table public.holder_votes enable row level security;
alter table public.execution_intents enable row level security;
alter table public.receipts enable row level security;
alter table public.policy_violations enable row level security;
alter table public.audit_log enable row level security;

-- world-readable public record
create policy "public read sessions" on public.sessions for select using (true);
create policy "public read snapshots" on public.treasury_snapshots for select using (true);
create policy "public read messages" on public.messages for select using (true);
create policy "public read proposals" on public.proposals for select using (true);
create policy "public read agent_votes" on public.agent_votes for select using (true);
create policy "public read holder_votes" on public.holder_votes for select using (true);
create policy "public read intents" on public.execution_intents for select using (true);
create policy "public read receipts" on public.receipts for select using (true);
create policy "public read violations" on public.policy_violations for select using (true);

-- NOT world-readable: audit_log and holder snapshot internals (service role
-- bypasses RLS; no select policy = no anon access).
