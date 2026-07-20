-- T1 — 멤버십·주문 도메인 스키마 (additive only)
create table if not exists public.class_groups (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  key text not null,
  name text not null,
  is_special boolean not null default false,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint class_groups_academy_key_uniq unique (academy_id, key)
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  key text not null,
  name text not null,
  visibility text not null default 'hidden',
  is_active boolean not null default true,
  bundled_ticket_id uuid null references public.tickets(id),
  perks_text text[] null,
  description text null,
  created_at timestamptz not null default now(),
  constraint memberships_academy_key_uniq unique (academy_id, key),
  constraint memberships_visibility_chk check (visibility in ('hidden', 'locked'))
);

create table if not exists public.ticket_coverage (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id),
  class_group_id uuid not null references public.class_groups(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint ticket_coverage_ticket_group_uniq unique (ticket_id, class_group_id)
);
create index if not exists ticket_coverage_class_group_id_idx on public.ticket_coverage (class_group_id);

create table if not exists public.membership_discounts (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id),
  class_group_id uuid null references public.class_groups(id),
  ticket_id uuid null references public.tickets(id),
  percent int not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint membership_discounts_percent_chk check (percent between 1 and 100),
  constraint membership_discounts_target_xor_chk check (
    (class_group_id is not null)::int + (ticket_id is not null)::int = 1
  )
);
create index if not exists membership_discounts_membership_id_idx on public.membership_discounts (membership_id);
create index if not exists membership_discounts_class_group_id_idx on public.membership_discounts (class_group_id);
create index if not exists membership_discounts_ticket_id_idx on public.membership_discounts (ticket_id);

create table if not exists public.student_memberships (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  user_id uuid not null references public.users(id),
  membership_id uuid not null references public.memberships(id),
  status text not null,
  start_date date not null,
  end_date date null,
  bundled_user_ticket_id uuid null references public.user_tickets(id),
  granted_by uuid null,
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_memberships_status_chk check (status in ('ACTIVE', 'SUSPENDED', 'EXPIRED'))
);
create unique index if not exists student_memberships_active_uniq
  on public.student_memberships (academy_id, user_id) where status = 'ACTIVE';
create index if not exists student_memberships_membership_status_idx
  on public.student_memberships (membership_id, status);

create table if not exists public.order_groups (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  user_id uuid null references public.users(id),
  method text not null,
  status text not null,
  currency text not null default 'KRW',
  original_amount int not null,
  discount_amount int not null default 0,
  total_amount int not null,
  provider_order_id text not null,
  payment_key text null,
  payment_approved_at timestamptz null,
  expires_at timestamptz null,
  fulfillment_error_code text null,
  fulfillment_error_message text null,
  retry_count int not null default 0,
  orderer_name text null,
  orderer_phone text null,
  orderer_email text null,
  confirmed_at timestamptz null,
  confirmed_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_groups_provider_order_id_uniq unique (provider_order_id),
  constraint order_groups_method_chk check (method in ('BANK', 'TOSS', 'ONSITE')),
  constraint order_groups_status_chk check (status in (
    'DRAFT', 'PENDING_PAYMENT', 'PAYMENT_APPROVED', 'CONFIRMED',
    'FULFILLMENT_FAILED', 'CANCELED', 'EXPIRED'
  )),
  constraint order_groups_original_amount_chk check (original_amount >= 0),
  constraint order_groups_discount_amount_chk check (discount_amount >= 0),
  constraint order_groups_total_amount_chk check (total_amount >= 0),
  constraint order_groups_amount_math_chk check (total_amount = original_amount - discount_amount)
);
create index if not exists order_groups_user_created_idx on public.order_groups (user_id, created_at desc);
create index if not exists order_groups_academy_status_created_idx on public.order_groups (academy_id, status, created_at);
create index if not exists order_groups_pending_expiry_idx on public.order_groups (status, expires_at) where status = 'PENDING_PAYMENT';

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_group_id uuid not null references public.order_groups(id),
  item_type text not null,
  ticket_id uuid null references public.tickets(id),
  schedule_id uuid null references public.schedules(id),
  class_id uuid null references public.classes(id),
  fixed_class_id uuid null references public.classes(id),
  count_option_index int null,
  ticket_name_snapshot text null,
  ticket_type_snapshot text null,
  grant_count_snapshot int null,
  valid_days_snapshot int null,
  start_mode_snapshot text null,
  original_amount int not null,
  discount_amount int not null default 0,
  final_amount int not null,
  discount_membership_id uuid null references public.memberships(id),
  discount_percent int null,
  source_purchase_item_id uuid null references public.order_items(id),
  result_user_ticket_id uuid null references public.user_tickets(id),
  result_booking_id uuid null references public.bookings(id),
  created_at timestamptz not null default now(),
  constraint order_items_item_type_chk check (item_type in ('TICKET_PURCHASE', 'SCHEDULE_BOOKING')),
  constraint order_items_discount_percent_chk check (discount_percent is null or discount_percent between 1 and 100),
  constraint order_items_ticket_purchase_chk check (item_type <> 'TICKET_PURCHASE' or ticket_id is not null),
  constraint order_items_schedule_booking_chk check (item_type <> 'SCHEDULE_BOOKING' or schedule_id is not null),
  constraint order_items_original_amount_chk check (original_amount >= 0),
  constraint order_items_discount_amount_chk check (discount_amount >= 0),
  constraint order_items_final_amount_chk check (final_amount >= 0)
);
create index if not exists order_items_order_group_id_idx on public.order_items (order_group_id);
create index if not exists order_items_schedule_id_idx on public.order_items (schedule_id);

create table if not exists public.booking_events (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  event_type text not null,
  schedule_id uuid not null references public.schedules(id),
  status text not null default 'PENDING',
  attempts int not null default 0,
  last_error text null,
  processed_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint booking_events_event_type_chk check (event_type in ('CLASS_CANCELED', 'SCHEDULE_CREATED')),
  constraint booking_events_status_chk check (status in ('PENDING', 'PROCESSED', 'FAILED'))
);
create index if not exists booking_events_status_created_idx on public.booking_events (status, created_at);

alter table public.academies add column if not exists booking_policy jsonb null;
alter table public.classes   add column if not exists booking_policy jsonb null;
alter table public.tickets add column if not exists is_fixed_weekly boolean not null default false;
alter table public.tickets add column if not exists start_mode text not null default 'IMMEDIATE';
alter table public.tickets add column if not exists valid_months int null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tickets_start_mode_chk') then
    alter table public.tickets add constraint tickets_start_mode_chk check (start_mode in ('IMMEDIATE', 'FIRST_BOOKING'));
  end if;
end $$;

alter table public.user_tickets add column if not exists fixed_class_id uuid null;
alter table public.user_tickets add column if not exists source_membership_id uuid null;
alter table public.bookings add column if not exists order_group_id uuid null;
alter table public.bookings add column if not exists hold_expires_at timestamptz null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_tickets_fixed_class_id_fkey') then
    alter table public.user_tickets add constraint user_tickets_fixed_class_id_fkey foreign key (fixed_class_id) references public.classes(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'user_tickets_source_membership_id_fkey') then
    alter table public.user_tickets add constraint user_tickets_source_membership_id_fkey foreign key (source_membership_id) references public.memberships(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bookings_order_group_id_fkey') then
    alter table public.bookings add constraint bookings_order_group_id_fkey foreign key (order_group_id) references public.order_groups(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'classes_audience_membership_id_fkey') then
    alter table public.classes add constraint classes_audience_membership_id_fkey foreign key (audience_membership_id) references public.memberships(id);
  end if;
end $$;

create index if not exists bookings_order_group_id_idx on public.bookings (order_group_id);

alter table public.class_groups         enable row level security;
alter table public.ticket_coverage      enable row level security;
alter table public.memberships          enable row level security;
alter table public.membership_discounts enable row level security;
alter table public.student_memberships  enable row level security;
alter table public.order_groups         enable row level security;
alter table public.order_items          enable row level security;
alter table public.booking_events       enable row level security;

drop policy if exists class_groups_all_staff on public.class_groups;
create policy class_groups_all_staff on public.class_groups
  for all to authenticated
  using (is_academy_staff(academy_id) or is_super_admin())
  with check (is_academy_staff(academy_id) or is_super_admin());

drop policy if exists memberships_all_staff on public.memberships;
create policy memberships_all_staff on public.memberships
  for all to authenticated
  using (is_academy_staff(academy_id) or is_super_admin())
  with check (is_academy_staff(academy_id) or is_super_admin());

drop policy if exists membership_discounts_all_staff on public.membership_discounts;
create policy membership_discounts_all_staff on public.membership_discounts
  for all to authenticated
  using (is_super_admin() or is_academy_staff((select m.academy_id from public.memberships m where m.id = membership_discounts.membership_id)))
  with check (is_super_admin() or is_academy_staff((select m.academy_id from public.memberships m where m.id = membership_discounts.membership_id)));

drop policy if exists booking_events_all_staff on public.booking_events;
create policy booking_events_all_staff on public.booking_events
  for all to authenticated
  using (is_academy_staff(academy_id) or is_super_admin())
  with check (is_academy_staff(academy_id) or is_super_admin());

drop policy if exists ticket_coverage_select_auth on public.ticket_coverage;
create policy ticket_coverage_select_auth on public.ticket_coverage
  for select to authenticated using (true);

drop policy if exists ticket_coverage_write_staff on public.ticket_coverage;
create policy ticket_coverage_write_staff on public.ticket_coverage
  for all to authenticated
  using (is_super_admin() or is_academy_staff((select t.academy_id from public.tickets t where t.id = ticket_coverage.ticket_id)))
  with check (is_super_admin() or is_academy_staff((select t.academy_id from public.tickets t where t.id = ticket_coverage.ticket_id)));

drop policy if exists student_memberships_select on public.student_memberships;
create policy student_memberships_select on public.student_memberships
  for select to authenticated
  using (user_id = auth.uid() or is_academy_staff(academy_id) or is_super_admin());

drop policy if exists student_memberships_write_staff on public.student_memberships;
create policy student_memberships_write_staff on public.student_memberships
  for all to authenticated
  using (is_academy_staff(academy_id) or is_super_admin())
  with check (is_academy_staff(academy_id) or is_super_admin());

drop policy if exists order_groups_select on public.order_groups;
create policy order_groups_select on public.order_groups
  for select to authenticated
  using (user_id = auth.uid() or is_academy_staff(academy_id) or is_super_admin());

drop policy if exists order_groups_write_staff on public.order_groups;
create policy order_groups_write_staff on public.order_groups
  for all to authenticated
  using (is_academy_staff(academy_id) or is_super_admin())
  with check (is_academy_staff(academy_id) or is_super_admin());

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select to authenticated
  using (exists (select 1 from public.order_groups og where og.id = order_items.order_group_id and (og.user_id = auth.uid() or is_academy_staff(og.academy_id) or is_super_admin())));

drop policy if exists order_items_write_staff on public.order_items;
create policy order_items_write_staff on public.order_items
  for all to authenticated
  using (exists (select 1 from public.order_groups og where og.id = order_items.order_group_id and (is_academy_staff(og.academy_id) or is_super_admin())))
  with check (exists (select 1 from public.order_groups og where og.id = order_items.order_group_id and (is_academy_staff(og.academy_id) or is_super_admin())));
;