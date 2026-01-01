-- Migration: Add Korean/English names to instructors table
-- Date: 2025-01-XX

-- Add Korean name column
ALTER TABLE public.instructors
ADD COLUMN IF NOT EXISTS name_kr character varying;

-- Add English name column
ALTER TABLE public.instructors
ADD COLUMN IF NOT EXISTS name_en character varying;

-- Migrate existing stage_name data to name_kr
UPDATE public.instructors
SET name_kr = stage_name
WHERE name_kr IS NULL AND stage_name IS NOT NULL;

-- Add index for better search performance
CREATE INDEX IF NOT EXISTS idx_instructors_name_kr ON public.instructors(name_kr);
CREATE INDEX IF NOT EXISTS idx_instructors_name_en ON public.instructors(name_en);

