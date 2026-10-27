-- Private Lending for Claude Code: borrowers, loans, securities, the loan ledger,
-- investor allocations and loan conditions for a private lender or mortgage fund.
-- Money is integer cents. Rates are basis points (1,000 bps = 10%). Interest is actual/365.

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create or replace function reject_change() returns trigger language plpgsql as $$
begin raise exception '% records cannot be changed or deleted; post a correcting entry instead', tg_table_name; end $$;

create table borrowers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  entity_type text not null default 'company' check (entity_type in ('company','trust','partnership','individual')),
  contact text not null default '',
  email text not null default '',
  kyc_verified_on date,
  kyc_method text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table investors (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  investor_type text not null check (investor_type in ('wholesale','sophisticated','retail')),
  certificate_on date,
  kyc_verified_on date,
  email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table loans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  borrower_id uuid not null references borrowers(id),
  purpose text not null,
  loan_type text not null check (loan_type in ('term','bridging','construction','land','line')),
  status text not null default 'application' check (status in ('application','approved','settled','default','discharged','withdrawn')),
  limit_cents bigint not null check (limit_cents > 0),
  rate_bps integer not null check (rate_bps between 0 and 10000),
  default_rate_bps integer not null default 0 check (default_rate_bps between 0 and 10000),
  repayment text not null default 'interest_only' check (repayment in ('interest_only','capitalised')),
  max_lvr_bps integer not null default 8000 check (max_lvr_bps between 1 and 10000),
  currency text not null default 'NZD',
  settled_on date,
  maturity_on date,
  interest_to date,
  default_on date,
  business_purpose_on date,
  manager text not null default '',
  source text,
  source_id text,
  source_payload jsonb,
  reviewed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id)
);

create table securities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  loan_id uuid not null references loans(id),
  address text not null,
  security_type text not null default 'first_mortgage' check (security_type in ('first_mortgage','second_mortgage','gsa','guarantee')),
  market_value_cents bigint check (market_value_cents >= 0),
  complete_value_cents bigint check (complete_value_cents >= 0),
  valued_on date,
  valuer text not null default '',
  valuer_independent boolean not null default false,
  insurance_expires_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every movement on a loan. Amounts are positive; kind decides the direction.
-- drawdown, interest, fee and adjustment add to the balance. payment reduces it.
create table ledger (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans(id),
  posted_on date not null,
  kind text not null check (kind in ('drawdown','interest','fee','payment','adjustment')),
  amount_cents bigint not null check (amount_cents > 0),
  period_from date,
  period_to date,
  evidence text not null default '',
  note text not null default '',
  event_key text not null unique,
  created_at timestamptz not null default now()
);

create table allocations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  loan_id uuid not null references loans(id),
  investor_id uuid not null references investors(id),
  amount_cents bigint not null check (amount_cents > 0),
  investor_rate_bps integer not null check (investor_rate_bps between 0 and 10000),
  allocated_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (loan_id, investor_id)
);

create table conditions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  loan_id uuid not null references loans(id),
  title text not null,
  owner text not null default '',
  due_on date not null,
  met_on date,
  evidence text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table audit_events (
  id bigserial primary key,
  entity_id uuid,
  action text not null,
  actor text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create trigger borrowers_touch before update on borrowers for each row execute function touch_updated_at();
create trigger investors_touch before update on investors for each row execute function touch_updated_at();
create trigger loans_touch before update on loans for each row execute function touch_updated_at();
create trigger securities_touch before update on securities for each row execute function touch_updated_at();
create trigger allocations_touch before update on allocations for each row execute function touch_updated_at();
create trigger conditions_touch before update on conditions for each row execute function touch_updated_at();
create trigger ledger_immutable before update or delete on ledger for each row execute function reject_change();
create trigger audit_immutable before update or delete on audit_events for each row execute function reject_change();

create index ledger_loan on ledger(loan_id, posted_on);
create index securities_loan on securities(loan_id);
create index allocations_loan on allocations(loan_id);
create index conditions_loan on conditions(loan_id);

-- Balances: what was drawn, charged and paid. Payments clear interest and fees first, then principal.
create view v_balances as
select l.id loan_id,
  coalesce(sum(g.amount_cents) filter (where g.kind='drawdown'),0)::bigint drawn_cents,
  coalesce(sum(g.amount_cents) filter (where g.kind in ('interest','fee')),0)::bigint charged_cents,
  coalesce(sum(g.amount_cents) filter (where g.kind='adjustment'),0)::bigint adjusted_cents,
  coalesce(sum(g.amount_cents) filter (where g.kind='payment'),0)::bigint paid_cents,
  coalesce(sum(case when g.kind='payment' then -g.amount_cents else g.amount_cents end),0)::bigint balance_cents,
  max(g.posted_on) filter (where g.kind='payment') last_payment_on,
  count(*) filter (where g.kind='drawdown' and g.evidence='')::int draws_without_evidence
from loans l left join ledger g on g.loan_id=l.id and g.posted_on<=current_date
group by l.id;

-- Arrears: charges past their due day (posted before today) not covered by payments, oldest first.
-- Capitalised loans add interest to the balance, so they are never in arrears on interest.
create view v_arrears_calc as
with charges as (
  select g.loan_id, g.posted_on,
    sum(g.amount_cents) over (partition by g.loan_id order by g.posted_on, g.created_at, g.id) cum_cents
  from ledger g where g.kind in ('interest','fee') and g.posted_on < current_date
), due as (
  select l.id loan_id, l.repayment,
    coalesce((select sum(amount_cents) from ledger g where g.loan_id=l.id and g.kind in ('interest','fee') and g.posted_on < current_date),0) due_cents,
    coalesce((select sum(amount_cents) from ledger g where g.loan_id=l.id and g.kind='payment' and g.posted_on <= current_date),0) paid_cents
  from loans l
)
select d.loan_id,
  case when d.repayment='interest_only' then greatest(d.due_cents - d.paid_cents, 0) else 0 end::bigint arrears_cents,
  case when d.repayment='interest_only' then (select min(c.posted_on) from charges c where c.loan_id=d.loan_id and c.cum_cents > d.paid_cents) end oldest_unpaid_on
from due d;

create view v_security as
select l.id loan_id,
  count(s.id)::int securities,
  sum(s.market_value_cents)::bigint market_value_cents,
  sum(s.complete_value_cents)::bigint complete_value_cents,
  min(s.valued_on) oldest_valuation_on,
  bool_or(s.market_value_cents is null) missing_value,
  bool_or(not s.valuer_independent) not_independent,
  min(s.insurance_expires_on) insurance_expires_on
from loans l left join securities s on s.loan_id=l.id
group by l.id;

create view v_funding as
select l.id loan_id,
  coalesce(sum(a.amount_cents),0)::bigint allocated_cents,
  count(a.id)::int investors
from loans l left join allocations a on a.loan_id=l.id
group by l.id;

create view v_loans as
select l.id, l.code, br.code borrower_code, br.name borrower, l.purpose, l.loan_type, l.status, l.currency,
  l.limit_cents, b.drawn_cents, b.balance_cents, b.charged_cents, b.paid_cents,
  greatest(l.limit_cents - b.drawn_cents, 0)::bigint undrawn_cents,
  l.rate_bps, l.default_rate_bps, l.repayment, l.max_lvr_bps,
  case when l.loan_type='construction' then 7000 else 8000 end benchmark_lvr_bps,
  s.market_value_cents, s.complete_value_cents,
  case when l.loan_type='construction' then round(l.limit_cents*10000.0/nullif(s.complete_value_cents,0))::int
       else round(l.limit_cents*10000.0/nullif(s.market_value_cents,0))::int end committed_lvr_bps,
  case when l.loan_type='construction' then round(b.balance_cents*10000.0/nullif(s.complete_value_cents,0))::int
       else round(b.balance_cents*10000.0/nullif(s.market_value_cents,0))::int end current_lvr_bps,
  s.oldest_valuation_on, s.not_independent, s.missing_value, s.insurance_expires_on,
  l.settled_on, l.maturity_on, (l.maturity_on - current_date) days_to_maturity, l.interest_to,
  a.arrears_cents, a.oldest_unpaid_on,
  case when a.arrears_cents > 0 then current_date - a.oldest_unpaid_on else 0 end days_in_arrears,
  b.last_payment_on, b.draws_without_evidence,
  f.allocated_cents, f.investors,
  l.business_purpose_on, br.kyc_verified_on borrower_kyc_on, l.manager, l.source, l.source_id, l.reviewed_on, l.borrower_id
from loans l
join borrowers br on br.id=l.borrower_id
join v_balances b on b.loan_id=l.id
join v_arrears_calc a on a.loan_id=l.id
join v_security s on s.loan_id=l.id
join v_funding f on f.loan_id=l.id;

create view v_arrears as
select code, borrower, status, balance_cents, arrears_cents, oldest_unpaid_on, days_in_arrears, last_payment_on, manager
from v_loans where status in ('settled','default') and arrears_cents > 0;

create view v_maturities as
select code, borrower, loan_type, status, maturity_on, days_to_maturity, balance_cents, arrears_cents, manager
from v_loans where status in ('settled','default') and maturity_on <= current_date + 90;

create view v_lvr as
select code, borrower, loan_type, status, limit_cents, balance_cents, market_value_cents, complete_value_cents,
  committed_lvr_bps, current_lvr_bps, max_lvr_bps, benchmark_lvr_bps,
  (greatest(coalesce(committed_lvr_bps,0), coalesce(current_lvr_bps,0)) > max_lvr_bps) over_policy,
  (coalesce(committed_lvr_bps,0) > benchmark_lvr_bps) over_benchmark
from v_loans where status in ('approved','settled','default');

create view v_valuations as
select s.code, l.code loan, s.address, s.security_type, s.market_value_cents, s.complete_value_cents, s.valued_on,
  (current_date - s.valued_on) age_days, s.valuer, s.valuer_independent, s.insurance_expires_on
from securities s join loans l on l.id=s.loan_id
where l.status in ('approved','settled','default');

create view v_conditions as
select c.code, l.code loan, br.name borrower, c.title, c.owner, c.due_on, (current_date - c.due_on) days_overdue
from conditions c join loans l on l.id=c.loan_id join borrowers br on br.id=l.borrower_id
where c.met_on is null and l.status not in ('discharged','withdrawn');

create view v_investor_funding as
select l.code, l.borrower, l.status, l.drawn_cents, l.limit_cents, l.allocated_cents, l.investors,
  (l.drawn_cents - l.allocated_cents)::bigint unfunded_cents
from v_loans l where l.status in ('approved','settled','default');

create view v_attention as
select code, 'arrears' issue, oldest_unpaid_on due_on, 'Unpaid ' || to_char(arrears_cents/100.0,'FM999G999G990D00') || ' for ' || days_in_arrears || ' days' detail
  from v_loans where status in ('settled','default') and arrears_cents > 0
union all
select code, case when days_to_maturity < 0 then 'matured, not repaid' else 'maturing' end, maturity_on, 'Balance ' || to_char(balance_cents/100.0,'FM999G999G990D00')
  from v_loans where status in ('settled','default') and maturity_on <= current_date + 60
union all
select code, 'over LVR limit', current_date, 'LVR ' || round(greatest(coalesce(committed_lvr_bps,0),coalesce(current_lvr_bps,0))/100.0,1) || '% against a limit of ' || round(max_lvr_bps/100.0,1) || '%'
  from v_loans where status in ('approved','settled','default') and greatest(coalesce(committed_lvr_bps,0),coalesce(current_lvr_bps,0)) > max_lvr_bps
union all
select l.code, 'valuation over 12 months old', s.valued_on + 365, s.code || ' valued ' || s.valued_on
  from securities s join loans l on l.id=s.loan_id where l.status in ('approved','settled','default') and s.valued_on < current_date - 365
union all
select l.code, 'insurance expiring', s.insurance_expires_on, s.code || ' ' || s.address
  from securities s join loans l on l.id=s.loan_id where l.status in ('approved','settled','default') and s.security_type in ('first_mortgage','second_mortgage') and (s.insurance_expires_on is null or s.insurance_expires_on <= current_date + 30)
union all
select loan, 'condition overdue', due_on, code || ' ' || title from v_conditions where due_on < current_date
union all
select code, 'interest not accrued', interest_to + 35, 'Interest accrued to ' || coalesce(interest_to::text,'never')
  from v_loans where status in ('settled','default') and (interest_to is null or interest_to < current_date - 35)
union all
select code, 'drawn beyond investor funding', current_date, 'Unfunded ' || to_char((drawn_cents-allocated_cents)/100.0,'FM999G999G990D00')
  from v_loans where status in ('settled','default') and investors > 0 and drawn_cents > allocated_cents
union all
select code, 'imported, not reviewed', current_date, 'Source ' || source || ' row ' || source_id
  from v_loans where source is not null and reviewed_on is null;

-- Evidence checks. Each rule is explained, with its source, in docs/compliance.md.
create view v_compliance as
select l.code, 'AML-CDD' rule, 'Borrower identity not verified' issue, br.name subject
  from loans l join borrowers br on br.id=l.borrower_id where l.status in ('approved','settled','default') and br.kyc_verified_on is null
union all
select l.code, 'AML-REVIEW', 'Borrower identity check older than 2 years', br.name
  from loans l join borrowers br on br.id=l.borrower_id where l.status in ('settled','default') and br.kyc_verified_on < current_date - 730
union all
select i.code, 'AML-CDD', 'Investor identity not verified', i.name from investors i
  where i.kyc_verified_on is null and exists (select 1 from allocations a where a.investor_id=i.id)
union all
select code, 'BUSINESS-PURPOSE', 'No business purpose declaration recorded', borrower
  from v_loans where status in ('approved','settled','default') and business_purpose_on is null
union all
select code, 'BUSINESS-PURPOSE', 'Declaration dated after settlement', borrower
  from v_loans where status in ('settled','default') and business_purpose_on > settled_on
union all
select i.code, 'WHOLESALE-CERT', 'Investor certificate missing or older than 2 years', i.name from investors i
  where i.investor_type in ('wholesale','sophisticated') and (i.certificate_on is null or i.certificate_on < current_date - 730)
union all
select i.code, 'RETAIL-INVESTOR', 'Retail investor holds an allocation', i.name from investors i
  where i.investor_type='retail' and exists (select 1 from allocations a where a.investor_id=i.id)
union all
select l.code, 'RG45-B5-INDEPENDENT', 'Valuer not recorded as independent', s.code || ' ' || s.address
  from securities s join loans l on l.id=s.loan_id where l.status in ('approved','settled','default') and s.security_type in ('first_mortgage','second_mortgage') and not s.valuer_independent
union all
select l.code, 'RG45-B5-BEFORE-ISSUE', 'No valuation dated on or before settlement', s.code || ' ' || s.address
  from securities s join loans l on l.id=s.loan_id where l.status in ('settled','default') and s.security_type in ('first_mortgage','second_mortgage') and (s.valued_on is null or s.valued_on > l.settled_on)
union all
select l.code, 'RG45-B5-AS-IF-COMPLETE', 'Development loan without an as if complete value', s.code || ' ' || s.address
  from securities s join loans l on l.id=s.loan_id where l.status in ('approved','settled','default') and l.loan_type='construction' and s.complete_value_cents is null
union all
select code, 'RG45-B6-LVR', 'Committed LVR ' || round(committed_lvr_bps/100.0,1) || '% above the ' || round(benchmark_lvr_bps/100.0) || '% benchmark', borrower
  from v_loans where status in ('approved','settled','default') and committed_lvr_bps > benchmark_lvr_bps
union all
select code, 'RG45-B6-STAGED', draws_without_evidence || ' construction draw(s) without progress evidence', borrower
  from v_loans where loan_type='construction' and draws_without_evidence > 0;

revoke all on all tables in schema public from public;
alter table borrowers enable row level security;
alter table investors enable row level security;
alter table loans enable row level security;
alter table securities enable row level security;
alter table ledger enable row level security;
alter table allocations enable row level security;
alter table conditions enable row level security;
alter table audit_events enable row level security;
