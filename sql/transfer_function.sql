-- =============================================================================
-- AirBus Kenya: Core Transactional Ledger & Wallet Security Definer Function
-- Enforces:
-- 1. Atomic debit/credit operations
-- 2. Idempotency keys (anti double-spending)
-- 3. Invariant check: sum(all wallets) = sum(topups) - sum(withdrawals)
-- =============================================================================

-- Ensure wallets table exists with balance non-negative constraints
create table if not exists wallets (
  id uuid primary key default gen_random_uuid(),
  user_email text unique not null,
  balance numeric(14,2) not null default 0 check (balance >= 0),
  hold_balance numeric(14,2) not null default 0 check (hold_balance >= 0 and hold_balance <= balance),
  lifetime_earnings numeric(14,2) not null default 0,
  lifetime_spent numeric(14,2) not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table wallets enable row level security;

-- Ledger entries table: append-only audit trail
create table if not exists ledger_entries (
  id text primary key,
  from_wallet text not null,
  to_wallet text not null,
  amount numeric(14,2) not null check (amount > 0),
  type text not null, -- 'topup', 'withdrawal', 'subscription', 'ad_payment', 'ad_revenue', 'ad_fee', 'referral_commission', 'promotion'
  reference_id text,
  description text,
  idempotency_key text unique,
  created_at timestamptz default now()
);

alter table ledger_entries enable row level security;

create index if not exists idx_ledger_from_wallet on ledger_entries (from_wallet);
create index if not exists idx_ledger_to_wallet on ledger_entries (to_wallet);
create index if not exists idx_ledger_idempotency_key on ledger_entries (idempotency_key);

-- Seed System Treasury & M-Pesa accounts
insert into wallets (user_email, balance, hold_balance)
values
  ('treasury', 0, 0),
  ('external_mpesa', 0, 0),
  ('withdrawal_payout', 0, 0)
on conflict (user_email) do nothing;

-- -----------------------------------------------------------------------------
-- SECURITY DEFINER Function: transfer
-- -----------------------------------------------------------------------------
create or replace function transfer(
  p_from_wallet text,
  p_to_wallet text,
  p_amount numeric,
  p_type text,
  p_reference_id text default null,
  p_description text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_ledger ledger_entries%rowtype;
  v_from_bal numeric;
  v_from_hold numeric;
  v_ledger_id text;
  v_clean_from text := lower(trim(p_from_wallet));
  v_clean_to text := lower(trim(p_to_wallet));
  v_total_wallets numeric;
  v_total_topups numeric;
  v_total_withdrawals numeric;
begin
  -- 1. Idempotency Check: prevent double-spending
  if p_idempotency_key is not null and length(trim(p_idempotency_key)) > 0 then
    select * into v_existing_ledger
    from ledger_entries
    where idempotency_key = p_idempotency_key;

    if found then
      return jsonb_build_object(
        'status', 'idempotent_duplicate',
        'message', 'Transaction already executed with idempotency key.',
        'ledger_id', v_existing_ledger.id,
        'amount', v_existing_ledger.amount,
        'type', v_existing_ledger.type
      );
    end if;
  end if;

  -- 2. Input validation
  if p_amount is null or p_amount <= 0 then
    raise exception 'Transfer amount must be strictly positive (got %)', p_amount;
  end if;

  if v_clean_from = v_clean_to then
    raise exception 'Self-transfers not allowed: from and to wallets cannot be identical (%)', v_clean_from;
  end if;

  -- 3. Ensure wallet records exist for both parties
  insert into wallets (user_email, balance, hold_balance)
  values (v_clean_from, 0, 0)
  on conflict (user_email) do nothing;

  insert into wallets (user_email, balance, hold_balance)
  values (v_clean_to, 0, 0)
  on conflict (user_email) do nothing;

  -- 4. Sender Balance Check and Debit (with Row-Level Lock for Atomicity)
  if v_clean_from not in ('external_mpesa', 'system_mint') then
    select balance, hold_balance into v_from_bal, v_from_hold
    from wallets
    where user_email = v_clean_from
    for update;

    if (v_from_bal - v_from_hold) < p_amount then
      raise exception 'Insufficient available funds in %: Balance=%, Hold=%, Requested=%',
        v_clean_from, v_from_bal, v_from_hold, p_amount;
    end if;

    update wallets
    set balance = balance - p_amount,
        lifetime_spent = lifetime_spent + p_amount,
        updated_at = now()
    where user_email = v_clean_from;
  end if;

  -- 5. Recipient Credit
  if v_clean_to not in ('withdrawal_payout', 'system_burn') then
    update wallets
    set balance = balance + p_amount,
        lifetime_earnings = lifetime_earnings + p_amount,
        updated_at = now()
    where user_email = v_clean_to;
  end if;

  -- 6. Insert Atomic Ledger Entry
  v_ledger_id := 'ledg_' || extract(epoch from clock_timestamp())::bigint || '_' || substr(md5(random()::text), 1, 6);

  insert into ledger_entries (
    id,
    from_wallet,
    to_wallet,
    amount,
    type,
    reference_id,
    description,
    idempotency_key,
    created_at
  ) values (
    v_ledger_id,
    v_clean_from,
    v_clean_to,
    p_amount,
    p_type,
    p_reference_id,
    coalesce(p_description, 'Transfer ' || p_amount || ' KES (' || p_type || ')'),
    p_idempotency_key,
    now()
  );

  -- 7. Enforce Balance Invariant:
  -- sum of all user and treasury wallets = sum of all top-ups - sum of all withdrawals
  select coalesce(sum(balance), 0) into v_total_wallets
  from wallets
  where user_email not in ('external_mpesa', 'withdrawal_payout');

  select coalesce(sum(amount), 0) into v_total_topups
  from ledger_entries
  where type = 'topup' or from_wallet = 'external_mpesa';

  select coalesce(sum(amount), 0) into v_total_withdrawals
  from ledger_entries
  where type = 'withdrawal' or to_wallet = 'withdrawal_payout';

  if abs(v_total_wallets - (v_total_topups - v_total_withdrawals)) > 0.01 then
    raise exception 'Balance invariant violated! Total in wallets: %, Expected net platform deposits: % (Topups=% - Withdrawals=%)',
      v_total_wallets, (v_total_topups - v_total_withdrawals), v_total_topups, v_total_withdrawals;
  end if;

  return jsonb_build_object(
    'status', 'success',
    'ledger_id', v_ledger_id,
    'from_wallet', v_clean_from,
    'to_wallet', v_clean_to,
    'amount', p_amount,
    'type', p_type,
    'balance_invariant_verified', true,
    'idempotency_key', p_idempotency_key
  );
end;
$$;
