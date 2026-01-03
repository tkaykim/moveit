-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.academies (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name_kr character varying,
  name_en character varying,
  address character varying,
  contact_number character varying,
  logo_url text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT academies_pkey PRIMARY KEY (id)
);
CREATE TABLE public.academy_images (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  academy_id uuid NOT NULL,
  image_url text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT academy_images_pkey PRIMARY KEY (id),
  CONSTRAINT academy_images_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id)
);
CREATE TABLE public.bookings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  schedule_id uuid NOT NULL,
  user_ticket_id uuid,
  hall_id uuid,
  status character varying DEFAULT 'CONFIRMED'::character varying CHECK (status::text = ANY (ARRAY['CONFIRMED'::character varying, 'CANCELLED'::character varying, 'COMPLETED'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT bookings_pkey PRIMARY KEY (id),
  CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT bookings_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.schedules(id),
  CONSTRAINT bookings_user_ticket_id_fkey FOREIGN KEY (user_ticket_id) REFERENCES public.user_tickets(id),
  CONSTRAINT bookings_hall_id_fkey FOREIGN KEY (hall_id) REFERENCES public.halls(id)
);
CREATE TABLE public.classes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  academy_id uuid NOT NULL,
  instructor_id uuid,
  hall_id uuid,
  song character varying,
  title character varying,
  description text,
  difficulty_level character varying,
  genre character varying,
  class_type character varying DEFAULT 'regular'::character varying CHECK (class_type::text = ANY (ARRAY['regular'::character varying, 'popup'::character varying, 'workshop'::character varying]::text[])),
  thumbnail_url text,
  price integer DEFAULT 0,
  max_students integer DEFAULT 0,
  current_students integer DEFAULT 0,
  status character varying DEFAULT '정상'::character varying CHECK (status::text = ANY (ARRAY['정상'::character varying, '연기됨'::character varying, '취소됨'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT classes_pkey PRIMARY KEY (id),
  CONSTRAINT classes_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id),
  CONSTRAINT classes_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructors(id),
  CONSTRAINT classes_hall_id_fkey FOREIGN KEY (hall_id) REFERENCES public.halls(id)
);
CREATE TABLE public.halls (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  academy_id uuid NOT NULL,
  name character varying NOT NULL,
  capacity integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT halls_pkey PRIMARY KEY (id),
  CONSTRAINT halls_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id)
);
CREATE TABLE public.instructors (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name_kr character varying,
  name_en character varying,
  profile_image_url text,
  instagram_url character varying,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT instructors_pkey PRIMARY KEY (id)
);
CREATE TABLE public.schedules (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  class_id uuid NOT NULL,
  hall_id uuid,
  instructor_id uuid,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  max_students integer DEFAULT 0,
  current_students integer DEFAULT 0,
  is_canceled boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT schedules_pkey PRIMARY KEY (id),
  CONSTRAINT schedules_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT schedules_hall_id_fkey FOREIGN KEY (hall_id) REFERENCES public.halls(id),
  CONSTRAINT schedules_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructors(id)
);
CREATE TABLE public.tickets (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  academy_id uuid NOT NULL,
  name character varying NOT NULL,
  price integer DEFAULT 0,
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
  remaining_count integer DEFAULT 0,
  start_date date,
  expiry_date date,
  status character varying DEFAULT 'ACTIVE'::character varying CHECK (status::text = ANY (ARRAY['ACTIVE'::character varying, 'EXPIRED'::character varying, 'USED'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_tickets_pkey PRIMARY KEY (id),
  CONSTRAINT user_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_tickets_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nickname character varying,
  name character varying,
  email character varying UNIQUE,
  phone character varying,
  profile_image text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);