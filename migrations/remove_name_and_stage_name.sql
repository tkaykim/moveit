-- Migration: Remove name and stage_name fields, use only name_kr and name_en
-- Date: 2025-01-XX

-- Remove name column from academies table
ALTER TABLE public.academies
DROP COLUMN IF EXISTS name;

-- Remove stage_name column from instructors table
ALTER TABLE public.instructors
DROP COLUMN IF EXISTS stage_name;

