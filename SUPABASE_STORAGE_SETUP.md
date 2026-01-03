# Supabase Storage 설정 가이드

## 1. Storage Bucket 생성

### 학원 이미지용 Bucket (academy-images)

1. Supabase Dashboard에 로그인
2. **Storage** 메뉴로 이동
3. **New bucket** 클릭
4. 다음 정보 입력:
   - **Name**: `academy-images` (소문자, 하이픈 사용)
   - **Public bucket**: ✅ 체크 (공개 접근 허용)
   - **File size limit**: 5MB (또는 원하는 크기)
   - **Allowed MIME types**: `image/jpeg,image/png,image/gif,image/webp,image/tiff,image/tif,image/bmp,image/svg+xml` (또는 `image/*` - 모든 이미지 타입 허용)

5. **Create bucket** 클릭

### 강사 프로필 이미지용 Bucket (instructor-profiles)

1. 동일한 Storage 메뉴에서
2. **New bucket** 클릭
3. 다음 정보 입력:
   - **Name**: `instructor-profiles` (소문자, 하이픈 사용)
   - **Public bucket**: ✅ 체크 (공개 접근 허용)
   - **File size limit**: 5MB (또는 원하는 크기)
   - **Allowed MIME types**: `image/jpeg,image/png,image/gif,image/webp,image/tiff,image/tif,image/bmp,image/svg+xml` (또는 `image/*` - 모든 이미지 타입 허용)

4. **Create bucket** 클릭

## 2. Storage Policies 설정 (RLS)

각 bucket에 대해 RLS 정책을 설정해야 합니다. **중요: 이 단계를 반드시 수행해야 이미지 업로드가 가능합니다.**

### 방법 1: SQL Editor에서 한 번에 설정 (권장)

1. Supabase Dashboard → **SQL Editor** 메뉴로 이동
2. **New query** 클릭
3. `storage_policies.sql` 파일의 내용을 복사하여 붙여넣기
4. **Run** 버튼 클릭

### 방법 2: 각 Bucket의 Policies 탭에서 설정

#### academy-images Bucket

1. `academy-images` bucket 클릭
2. **Policies** 탭으로 이동
3. **New Policy** 클릭
4. **For full customization** 선택
5. 각 정책을 하나씩 추가:

```sql
-- 읽기 정책 (공개 읽기)
CREATE POLICY "Public read access for academy-images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'academy-images');

-- 업로드 정책 (모든 사용자 - 개발 환경용)
CREATE POLICY "Allow upload to academy-images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'academy-images'
  AND (name ~* '\.(jpg|jpeg|png|gif|webp|tiff|tif|bmp|svg)$')
);

-- 업데이트 정책
CREATE POLICY "Allow update in academy-images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'academy-images')
WITH CHECK (bucket_id = 'academy-images');

-- 삭제 정책
CREATE POLICY "Allow delete from academy-images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'academy-images');
```

### instructor-profiles Bucket

동일한 방식으로 `instructor-profiles` bucket에 대해 정책을 설정합니다:

```sql
-- 읽기 정책
CREATE POLICY "Public read access"
ON storage.objects
FOR SELECT
USING (bucket_id = 'instructor-profiles');

-- 업로드 정책
CREATE POLICY "Authenticated users can upload"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'instructor-profiles' 
  AND auth.role() = 'authenticated'
);

-- 업데이트 정책
CREATE POLICY "Authenticated users can update"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'instructor-profiles' 
  AND auth.role() = 'authenticated'
);

-- 삭제 정책
CREATE POLICY "Authenticated users can delete"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'instructor-profiles' 
  AND auth.role() = 'authenticated'
);
```

## 3. Bucket 이름 요약

- **학원 이미지**: `academy-images`
- **강사 프로필 이미지**: `instructor-profiles`

⚠️ **중요**: Bucket 이름은 정확히 위와 같이 입력해야 합니다 (대소문자 구분).

## 4. 파일 경로 구조

### 학원 이미지
```
academy-images/
  └── academies/
      └── {academy-id}/
          └── {timestamp}-{random}.jpg
```

### 강사 프로필 이미지
```
instructor-profiles/
  └── instructors/
      └── {instructor-id}/
          └── {timestamp}-{random}.jpg
```

## 5. 지원되는 이미지 파일 형식

다음 이미지 파일 형식을 지원합니다:
- **JPEG/JPG** (`.jpg`, `.jpeg`)
- **PNG** (`.png`)
- **GIF** (`.gif`)
- **WebP** (`.webp`)
- **TIFF/TIF** (`.tiff`, `.tif`)
- **BMP** (`.bmp`)
- **SVG** (`.svg`)

## 6. 확인 방법

1. Storage 메뉴에서 두 bucket이 생성되었는지 확인
2. 각 bucket의 **Policies** 탭에서 정책이 설정되었는지 확인
3. SQL Editor에서 정책이 생성되었는지 확인:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'objects';
   ```
4. 관리자 페이지에서 이미지 업로드를 시도하여 정상 작동 확인

## 7. 문제 해결

### "Bucket not found" 오류
- Bucket 이름이 정확한지 확인 (`academy-images`, `instructor-profiles`)
- Supabase Dashboard → Storage에서 bucket이 생성되어 있는지 확인

### "new row violates row-level security policy" 오류
- `storage_policies.sql` 파일의 SQL을 SQL Editor에서 실행했는지 확인
- 각 bucket의 Policies 탭에서 정책이 설정되어 있는지 확인

### 이미지 업로드 실패
- Bucket의 **Public bucket** 옵션이 체크되어 있는지 확인
- **Allowed MIME types**에 업로드하려는 이미지 형식이 포함되어 있는지 확인

