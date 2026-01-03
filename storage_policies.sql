-- ============================================
-- Supabase Storage RLS 정책 설정
-- ============================================
-- 이 파일은 Supabase SQL Editor에서 실행하세요
-- Supabase Dashboard -> SQL Editor -> New query -> 이 SQL 복사 붙여넣기 -> Run

-- ============================================
-- 기존 정책 삭제 (중복 방지)
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
-- academy-images Bucket 정책
-- ============================================

-- 1. 공개 읽기 정책 (모든 사용자가 이미지를 볼 수 있음)
CREATE POLICY "Public read access for academy-images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'academy-images');

-- 2. 업로드 정책 (모든 사용자가 업로드 가능 - 개발 환경용)
-- 프로덕션에서는 auth.role() = 'authenticated' 조건 추가 권장
CREATE POLICY "Allow upload to academy-images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'academy-images'
  -- 이미지 파일만 허용 (확장자 검사)
  AND (name ~* '\.(jpg|jpeg|png|gif|webp|tiff|tif|bmp|svg)$')
);

-- 3. 업데이트 정책
CREATE POLICY "Allow update in academy-images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'academy-images')
WITH CHECK (bucket_id = 'academy-images');

-- 4. 삭제 정책
CREATE POLICY "Allow delete from academy-images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'academy-images');

-- ============================================
-- instructor-profiles Bucket 정책
-- ============================================

-- 1. 공개 읽기 정책
CREATE POLICY "Public read access for instructor-profiles"
ON storage.objects
FOR SELECT
USING (bucket_id = 'instructor-profiles');

-- 2. 업로드 정책
CREATE POLICY "Allow upload to instructor-profiles"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'instructor-profiles'
  -- 이미지 파일만 허용 (확장자 검사)
  AND (name ~* '\.(jpg|jpeg|png|gif|webp|tiff|tif|bmp|svg)$')
);

-- 3. 업데이트 정책
CREATE POLICY "Allow update in instructor-profiles"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'instructor-profiles')
WITH CHECK (bucket_id = 'instructor-profiles');

-- 4. 삭제 정책
CREATE POLICY "Allow delete from instructor-profiles"
ON storage.objects
FOR DELETE
USING (bucket_id = 'instructor-profiles');


