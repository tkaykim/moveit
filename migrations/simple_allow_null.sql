-- Simplified ALTER TABLE statements to remove NOT NULL constraints
-- Based on currentDB.sql schema
-- 
-- IMPORTANT: This script only includes columns that exist in currentDB.sql
-- If a column doesn't exist, the statement will fail - check the error messages

-- academies table (has name_kr, name_en - NOT name)
-- All columns already nullable in currentDB.sql, but run these just in case
ALTER TABLE public.academies ALTER COLUMN owner_id DROP NOT NULL;

-- academy_instructors table (all columns already nullable)
ALTER TABLE public.academy_instructors ALTER COLUMN academy_id DROP NOT NULL;
ALTER TABLE public.academy_instructors ALTER COLUMN instructor_id DROP NOT NULL;

-- bookings table (all columns already nullable except id)
ALTER TABLE public.bookings ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN schedule_id DROP NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN user_ticket_id DROP NOT NULL;

-- branches table
ALTER TABLE public.branches ALTER COLUMN academy_id DROP NOT NULL;
ALTER TABLE public.branches ALTER COLUMN name DROP NOT NULL;
ALTER TABLE public.branches ALTER COLUMN address_primary DROP NOT NULL;

-- classes table
ALTER TABLE public.classes ALTER COLUMN academy_id DROP NOT NULL;
ALTER TABLE public.classes ALTER COLUMN title DROP NOT NULL;
ALTER TABLE public.classes ALTER COLUMN class_type DROP NOT NULL;

-- halls table
ALTER TABLE public.halls ALTER COLUMN branch_id DROP NOT NULL;
ALTER TABLE public.halls ALTER COLUMN name DROP NOT NULL;

-- schedules table
ALTER TABLE public.schedules ALTER COLUMN class_id DROP NOT NULL;
ALTER TABLE public.schedules ALTER COLUMN branch_id DROP NOT NULL;
ALTER TABLE public.schedules ALTER COLUMN hall_id DROP NOT NULL;
ALTER TABLE public.schedules ALTER COLUMN instructor_id DROP NOT NULL;
ALTER TABLE public.schedules ALTER COLUMN start_time DROP NOT NULL;
ALTER TABLE public.schedules ALTER COLUMN end_time DROP NOT NULL;
ALTER TABLE public.schedules ALTER COLUMN max_students DROP NOT NULL;

-- tickets table
ALTER TABLE public.tickets ALTER COLUMN academy_id DROP NOT NULL;
ALTER TABLE public.tickets ALTER COLUMN name DROP NOT NULL;
ALTER TABLE public.tickets ALTER COLUMN ticket_type DROP NOT NULL;
ALTER TABLE public.tickets ALTER COLUMN price DROP NOT NULL;

-- user_tickets table
ALTER TABLE public.user_tickets ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.user_tickets ALTER COLUMN ticket_id DROP NOT NULL;

-- users table
ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN name DROP NOT NULL;

-- instructors table (has name_kr, name_en - NOT stage_name)
-- All columns already nullable in currentDB.sql

