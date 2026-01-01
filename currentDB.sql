-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.academies (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  owner_id character varying NOT NULL,
  business_registration_number character varying,
  logo_url text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  name_kr character varying,
  name_en character varying,
  tags text,
  CONSTRAINT academies_pkey PRIMARY KEY (id)
);
CREATE TABLE public.academy_instructors (
  academy_id uuid NOT NULL,
  instructor_id uuid NOT NULL,
  memo text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT academy_instructors_pkey PRIMARY KEY (academy_id, instructor_id),
  CONSTRAINT academy_instructors_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id),
  CONSTRAINT academy_instructors_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructors(id)
);
CREATE TABLE public.bookings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  schedule_id uuid NOT NULL,
  user_ticket_id uuid NOT NULL,
  status character varying DEFAULT 'CONFIRMED'::character varying,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT bookings_pkey PRIMARY KEY (id),
  CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT bookings_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.schedules(id),
  CONSTRAINT bookings_user_ticket_id_fkey FOREIGN KEY (user_ticket_id) REFERENCES public.user_tickets(id)
);
CREATE TABLE public.branches (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  academy_id uuid NOT NULL,
  name character varying NOT NULL,
  address_primary character varying NOT NULL,
  address_detail character varying,
  contact_number character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  image_url text,
  CONSTRAINT branches_pkey PRIMARY KEY (id),
  CONSTRAINT branches_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id)
);
CREATE TABLE public.classes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  academy_id uuid NOT NULL,
  title character varying NOT NULL,
  description text,
  difficulty_level character varying,
  genre character varying,
  class_type character varying NOT NULL,
  thumbnail_url text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  price integer DEFAULT 0,
  instructor_id uuid,
  CONSTRAINT classes_pkey PRIMARY KEY (id),
  CONSTRAINT classes_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id),
  CONSTRAINT classes_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructors(id)
);
CREATE TABLE public.halls (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  branch_id uuid NOT NULL,
  name character varying NOT NULL,
  capacity integer DEFAULT 0,
  floor_info character varying,
  CONSTRAINT halls_pkey PRIMARY KEY (id),
  CONSTRAINT halls_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id)
);
CREATE TABLE public.instructors (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  bio text,
  instagram_url character varying,
  specialties text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  name_kr character varying,
  name_en character varying,
  profile_image_url text,
  CONSTRAINT instructors_pkey PRIMARY KEY (id),
  CONSTRAINT instructors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.schedules (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  class_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  hall_id uuid NOT NULL,
  instructor_id uuid NOT NULL,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  max_students integer NOT NULL,
  current_students integer DEFAULT 0,
  is_canceled boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT schedules_pkey PRIMARY KEY (id),
  CONSTRAINT schedules_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT schedules_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT schedules_hall_id_fkey FOREIGN KEY (hall_id) REFERENCES public.halls(id),
  CONSTRAINT schedules_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructors(id)
);
CREATE TABLE public.tickets (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  academy_id uuid NOT NULL,
  name character varying NOT NULL,
  price integer NOT NULL DEFAULT 0,
  ticket_type character varying NOT NULL,
  total_count integer,
  valid_days integer,
  target_class_id uuid,
  is_on_sale boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tickets_pkey PRIMARY KEY (id),
  CONSTRAINT tickets_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id),
  CONSTRAINT tickets_target_class_id_fkey FOREIGN KEY (target_class_id) REFERENCES public.classes(id)
);
CREATE TABLE public.user_tickets (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  ticket_id uuid NOT NULL,
  remaining_count integer,
  start_date date,
  expiry_date date,
  status character varying DEFAULT 'ACTIVE'::character varying,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_tickets_pkey PRIMARY KEY (id),
  CONSTRAINT user_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_tickets_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  email character varying NOT NULL UNIQUE,
  name character varying NOT NULL,
  nickname character varying,
  phone character varying,
  profile_image text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);