-- ALTER TABLE statements to remove NOT NULL constraints
-- This allows all columns (except PRIMARY KEY) to accept NULL values
-- 
-- IMPORTANT: 
-- 1. DO NOT run currentDB.sql - it's for reference only!
-- 2. Copy and paste THIS script into Supabase SQL Editor and run it
-- 3. This script is based on currentDB.sql schema
-- 4. If a column already allows NULL or doesn't exist, the statement will fail safely
--
-- Note: Most columns in currentDB.sql already allow NULL (no NOT NULL constraint).
-- This script only includes columns that might have NOT NULL constraints in the actual database.

-- academies table
-- Note: academies table has name_kr, name_en (NOT name) - all columns already nullable in currentDB.sql
-- Only owner_id might need this if it has NOT NULL constraint in actual DB
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'academies' AND column_name = 'owner_id' AND is_nullable = 'NO') THEN
        ALTER TABLE public.academies ALTER COLUMN owner_id DROP NOT NULL;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- academy_instructors table  
-- All columns already nullable in currentDB.sql, but check just in case
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'academy_instructors' AND column_name = 'academy_id' AND is_nullable = 'NO') THEN
        ALTER TABLE public.academy_instructors ALTER COLUMN academy_id DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'academy_instructors' AND column_name = 'instructor_id' AND is_nullable = 'NO') THEN
        ALTER TABLE public.academy_instructors ALTER COLUMN instructor_id DROP NOT NULL;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- bookings table
-- All columns already nullable in currentDB.sql (except id)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'user_id' AND is_nullable = 'NO') THEN
        ALTER TABLE public.bookings ALTER COLUMN user_id DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'schedule_id' AND is_nullable = 'NO') THEN
        ALTER TABLE public.bookings ALTER COLUMN schedule_id DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'user_ticket_id' AND is_nullable = 'NO') THEN
        ALTER TABLE public.bookings ALTER COLUMN user_ticket_id DROP NOT NULL;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- branches table
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'academy_id' AND is_nullable = 'NO') THEN
        ALTER TABLE public.branches ALTER COLUMN academy_id DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'name' AND is_nullable = 'NO') THEN
        ALTER TABLE public.branches ALTER COLUMN name DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'address_primary' AND is_nullable = 'NO') THEN
        ALTER TABLE public.branches ALTER COLUMN address_primary DROP NOT NULL;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- classes table
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'academy_id' AND is_nullable = 'NO') THEN
        ALTER TABLE public.classes ALTER COLUMN academy_id DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'title' AND is_nullable = 'NO') THEN
        ALTER TABLE public.classes ALTER COLUMN title DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'class_type' AND is_nullable = 'NO') THEN
        ALTER TABLE public.classes ALTER COLUMN class_type DROP NOT NULL;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- halls table
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'halls' AND column_name = 'branch_id' AND is_nullable = 'NO') THEN
        ALTER TABLE public.halls ALTER COLUMN branch_id DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'halls' AND column_name = 'name' AND is_nullable = 'NO') THEN
        ALTER TABLE public.halls ALTER COLUMN name DROP NOT NULL;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- schedules table
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'class_id' AND is_nullable = 'NO') THEN
        ALTER TABLE public.schedules ALTER COLUMN class_id DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'branch_id' AND is_nullable = 'NO') THEN
        ALTER TABLE public.schedules ALTER COLUMN branch_id DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'hall_id' AND is_nullable = 'NO') THEN
        ALTER TABLE public.schedules ALTER COLUMN hall_id DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'instructor_id' AND is_nullable = 'NO') THEN
        ALTER TABLE public.schedules ALTER COLUMN instructor_id DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'start_time' AND is_nullable = 'NO') THEN
        ALTER TABLE public.schedules ALTER COLUMN start_time DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'end_time' AND is_nullable = 'NO') THEN
        ALTER TABLE public.schedules ALTER COLUMN end_time DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'max_students' AND is_nullable = 'NO') THEN
        ALTER TABLE public.schedules ALTER COLUMN max_students DROP NOT NULL;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- tickets table
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'academy_id' AND is_nullable = 'NO') THEN
        ALTER TABLE public.tickets ALTER COLUMN academy_id DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'name' AND is_nullable = 'NO') THEN
        ALTER TABLE public.tickets ALTER COLUMN name DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'ticket_type' AND is_nullable = 'NO') THEN
        ALTER TABLE public.tickets ALTER COLUMN ticket_type DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'price' AND is_nullable = 'NO') THEN
        ALTER TABLE public.tickets ALTER COLUMN price DROP NOT NULL;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- user_tickets table
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'user_tickets' AND column_name = 'user_id' AND is_nullable = 'NO') THEN
        ALTER TABLE public.user_tickets ALTER COLUMN user_id DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'user_tickets' AND column_name = 'ticket_id' AND is_nullable = 'NO') THEN
        ALTER TABLE public.user_tickets ALTER COLUMN ticket_id DROP NOT NULL;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- users table
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email' AND is_nullable = 'NO') THEN
        ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'name' AND is_nullable = 'NO') THEN
        ALTER TABLE public.users ALTER COLUMN name DROP NOT NULL;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- instructors table
-- Note: instructors table has name_kr, name_en (NOT stage_name) - all columns already nullable in currentDB.sql
-- This section is included in case the actual DB has different constraints
-- No stage_name column exists in currentDB.sql, so skipping it
