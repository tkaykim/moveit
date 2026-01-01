-- Migration: Add instructor_favorites table
-- Date: 2025-01-XX
-- Purpose: Track user favorites for instructors to enable "HOT instructors" feature

-- Create instructor_favorites table
CREATE TABLE IF NOT EXISTS public.instructor_favorites (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  instructor_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT instructor_favorites_pkey PRIMARY KEY (id),
  CONSTRAINT instructor_favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT instructor_favorites_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructors(id) ON DELETE CASCADE,
  CONSTRAINT instructor_favorites_unique UNIQUE (user_id, instructor_id)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_instructor_favorites_user_id ON public.instructor_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_instructor_favorites_instructor_id ON public.instructor_favorites(instructor_id);
CREATE INDEX IF NOT EXISTS idx_instructor_favorites_created_at ON public.instructor_favorites(created_at);

