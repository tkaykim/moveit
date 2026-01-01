# Supabase Storage 설정 가이드

## 1. Storage Bucket 생성

### 학원 지점 이미지용 Bucket

1. Supabase Dashboard에 로그인
2. **Storage** 메뉴로 이동
3. **New bucket** 클릭
4. 다음 정보 입력:
   - **Name**: `academy-branches` (소문자, 하이픈 사용)
   - **Public bucket**: ✅ 체크 (공개 접근 허용)
   - **File size limit**: 5MB (또는 원하는 크기)
   - **Allowed MIME types**: `image/*` (모든 이미지 타입 허용)

5. **Create bucket** 클릭

### 강사 프로필 이미지용 Bucket

1. 동일한 Storage 메뉴에서
2. **New bucket** 클릭
3. 다음 정보 입력:
   - **Name**: `instructor-profiles` (소문자, 하이픈 사용)
   - **Public bucket**: ✅ 체크 (공개 접근 허용)
   - **File size limit**: 5MB (또는 원하는 크기)
   - **Allowed MIME types**: `image/*` (모든 이미지 타입 허용)

4. **Create bucket** 클릭

## 2. Storage Policies 설정 (RLS)

각 bucket에 대해 공개 읽기 정책을 설정해야 합니다.

### academy-branches Bucket

1. `academy-branches` bucket 클릭
2. **Policies** 탭으로 이동
3. **New Policy** 클릭
4. **For full customization** 선택
5. Policy 이름: `Public read access`
6. Policy 정의:

```sql
-- 읽기 정책
CREATE POLICY "Public read access"
ON storage.objects
FOR SELECT
USING (bucket_id = 'academy-branches');

-- 업로드 정책 (인증된 사용자만)
CREATE POLICY "Authenticated users can upload"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'academy-branches' 
  AND auth.role() = 'authenticated'
);

-- 업데이트 정책 (인증된 사용자만)
CREATE POLICY "Authenticated users can update"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'academy-branches' 
  AND auth.role() = 'authenticated'
);

-- 삭제 정책 (인증된 사용자만)
CREATE POLICY "Authenticated users can delete"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'academy-branches' 
  AND auth.role() = 'authenticated'
);
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

## 3. 간단한 설정 방법 (개발 환경)

개발 환경에서는 모든 사용자가 업로드할 수 있도록 더 간단한 정책을 사용할 수 있습니다:

```sql
-- academy-branches
CREATE POLICY "Allow all operations"
ON storage.objects
FOR ALL
USING (bucket_id = 'academy-branches')
WITH CHECK (bucket_id = 'academy-branches');

-- instructor-profiles
CREATE POLICY "Allow all operations"
ON storage.objects
FOR ALL
USING (bucket_id = 'instructor-profiles')
WITH CHECK (bucket_id = 'instructor-profiles');
```

⚠️ **주의**: 프로덕션 환경에서는 더 엄격한 정책을 사용하세요.

## 4. Bucket 이름 요약

- **학원 지점 이미지**: `academy-branches`
- **강사 프로필 이미지**: `instructor-profiles`

## 5. 파일 경로 구조

### 학원 지점 이미지
```
academy-branches/
  └── branches/
      └── {branch-id}/
          └── {timestamp}-{random}.jpg
```

### 강사 프로필 이미지
```
instructor-profiles/
  └── instructors/
      └── {instructor-id}/
          └── {timestamp}-{random}.jpg
```

## 6. 확인 방법

1. Storage 메뉴에서 두 bucket이 생성되었는지 확인
2. 각 bucket의 **Policies** 탭에서 정책이 설정되었는지 확인
3. 관리자 페이지에서 이미지 업로드를 시도하여 정상 작동 확인

