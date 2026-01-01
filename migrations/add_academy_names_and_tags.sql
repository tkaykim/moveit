-- Migration: Add Korean/English names and tags to academies table
-- Date: 2025-01-XX

-- Add Korean name column
ALTER TABLE public.academies 
ADD COLUMN IF NOT EXISTS name_kr character varying;

-- Add English name column
ALTER TABLE public.academies 
ADD COLUMN IF NOT EXISTS name_en character varying;

-- Add tags column (comma-separated or JSON array)
ALTER TABLE public.academies 
ADD COLUMN IF NOT EXISTS tags text;

-- Migrate existing name data to name_kr
UPDATE public.academies 
SET name_kr = name 
WHERE name_kr IS NULL AND name IS NOT NULL;

-- Make name_kr NOT NULL after migration (optional, if you want to enforce it)
-- ALTER TABLE public.academies ALTER COLUMN name_kr SET NOT NULL;

-- Add index for better search performance
CREATE INDEX IF NOT EXISTS idx_academies_name_kr ON public.academies(name_kr);
CREATE INDEX IF NOT EXISTS idx_academies_name_en ON public.academies(name_en);
CREATE INDEX IF NOT EXISTS idx_academies_tags ON public.academies USING gin(to_tsvector('english', tags));

