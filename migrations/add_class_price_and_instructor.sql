-- Migration: Add price and instructor_id to classes table
-- Date: 2025-01-XX

-- Add price column to classes table
ALTER TABLE public.classes 
ADD COLUMN IF NOT EXISTS price integer DEFAULT 0;

-- Add instructor_id column to classes table
ALTER TABLE public.classes 
ADD COLUMN IF NOT EXISTS instructor_id uuid;

-- Add foreign key constraint for instructor_id
ALTER TABLE public.classes 
ADD CONSTRAINT classes_instructor_id_fkey 
FOREIGN KEY (instructor_id) 
REFERENCES public.instructors(id);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_classes_instructor_id ON public.classes(instructor_id);
CREATE INDEX IF NOT EXISTS idx_classes_price ON public.classes(price);

