create table if not exists public.referrals (
  id              bigserial primary key,
  referrer_name   text not null,
  referrer_phone  text not null,
  referrer_email  text not null,
  payout_method   text not null,
  new_name        text not null,
  new_phone       text not null,
  new_email       text,
  new_address     text not null,
  property_type   text not null,
  service_needed  text not null,
  notes           text,
  status          text not null default 'new',
  payout_status   text not null default 'pending',
  payout_amount   numeric default 500,
  paid_at         timestamptz,
  source          text default 'mechanicalenterprise.com/referral',
  ip_address      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists referrals_status_idx        on public.referrals (status);
create index if not exists referrals_payout_idx        on public.referrals (payout_status);
create index if not exists referrals_created_idx       on public.referrals (created_at desc);
create index if not exists referrals_referrer_phone_idx on public.referrals (referrer_phone);
create index if not exists referrals_new_phone_idx     on public.referrals (new_phone);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_referrals_updated on public.referrals;
create trigger trg_referrals_updated
  before update on public.referrals
  for each row execute function public.touch_updated_at();

alter table public.referrals enable row level security;

create or replace view public.referrals_payouts_owed as
select
  referrer_name, referrer_phone, referrer_email, payout_method,
  count(*) as referrals_owed,
  sum(payout_amount) as total_owed,
  min(created_at) as oldest_referral
from public.referrals
where payout_status = 'owed'
group by referrer_name, referrer_phone, referrer_email, payout_method
order by total_owed desc;
