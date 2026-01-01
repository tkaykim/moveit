-- Migration: Add image fields for branches and instructors
-- Date: 2025-01-XX

-- Add image_url to branches table (지점별 이미지)
ALTER TABLE public.branches
ADD COLUMN IF NOT EXISTS image_url text;

-- Add profile_image_url to instructors table (강사 프로필 이미지)
ALTER TABLE public.instructors
ADD COLUMN IF NOT EXISTS profile_image_url text;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_branches_image_url ON public.branches(image_url);
CREATE INDEX IF NOT EXISTS idx_instructors_profile_image_url ON public.instructors(profile_image_url);

