-- ============================================
-- Supabase Storage RLS 정책 설정 (간단 버전)
-- ============================================
-- 개발 환경에서 사용하기 위한 가장 간단한 정책
-- 이 파일은 Supabase SQL Editor에서 실행하세요

-- ============================================
-- 기존 정책 삭제
-- ============================================
DROP POLICY IF EXISTS "Public read access for academy-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow upload to academy-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow update in academy-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete from academy-images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for instructor-profiles" ON storage.objects;
DROP POLICY IF EXISTS "Allow upload to instructor-profiles" ON storage.objects;
DROP POLICY IF EXISTS "Allow update in instructor-profiles" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete from instructor-profiles" ON storage.objects;

-- ============================================
-- academy-images Bucket 정책 (간단 버전)
-- ============================================
-- 모든 작업 허용 (개발 환경용)

CREATE POLICY "Allow all operations for academy-images"
ON storage.objects
FOR ALL
USING (bucket_id = 'academy-images')
WITH CHECK (bucket_id = 'academy-images');

-- ============================================
-- instructor-profiles Bucket 정책 (간단 버전)
-- ============================================
-- 모든 작업 허용 (개발 환경용)

CREATE POLICY "Allow all operations for instructor-profiles"
ON storage.objects
FOR ALL
USING (bucket_id = 'instructor-profiles')
WITH CHECK (bucket_id = 'instructor-profiles');

