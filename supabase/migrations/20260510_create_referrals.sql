create table if not exists public.referrals (
  id uuid default gen_random_uuid() primary key,
  referrer_name text not null,
  referrer_phone text not null,
  referrer_email text not null,
  payment_method text not null,
  lead_name text not null,
  lead_phone text not null,
  lead_email text,
  property_address text not null,
  property_type text not null,
  service_needed text not null,
  notes text,
  status text not null default 'pending',
  created_at timestamptz default now()
);

-- RLS: only service role can insert (edge function uses service role key)
alter table public.referrals enable row level security;

-- No public access policies — only service_role bypasses RLS
