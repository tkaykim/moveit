-- T7-1. 환불 제안(dry-run) → 직원 확인 감사 기록.
-- 이 단계에서 실제 환불은 자동 집행되지 않는다. 엔진 산출값과 직원 최종값을 모두 남긴다.
create table if not exists public.refund_proposals (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  revenue_transaction_id uuid references public.revenue_transactions(id) on delete set null,
  user_ticket_id uuid references public.user_tickets(id) on delete set null,
  user_id uuid,
  preset_key text not null,
  preset_source text not null,
  paid_amount integer not null,
  computed_amount integer not null,
  adjusted_amount integer,
  basis text,
  breakdown jsonb,
  status text not null default 'PROPOSED'
    check (status in ('PROPOSED','CONFIRMED','REJECTED','EXECUTED')),
  reason text,
  proposed_by uuid,
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_refund_proposals_academy on public.refund_proposals (academy_id, created_at desc);
create index if not exists idx_refund_proposals_rev on public.refund_proposals (revenue_transaction_id);

alter table public.refund_proposals enable row level security;

drop policy if exists refund_proposals_staff_select on public.refund_proposals;
create policy refund_proposals_staff_select on public.refund_proposals
  for select to authenticated
  using (public.is_academy_staff(academy_id) or public.is_super_admin());
;