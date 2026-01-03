# 댄스학원 데이터 등록 가이드

## 개요
한국의 유명 댄스학원들을 데이터베이스에 등록하기 위한 데이터 파일입니다.

## 데이터 구성
- **서울**: 10개 학원
- **부산**: 2개 학원
- **대구**: 2개 학원
- **인천**: 2개 학원
- **광주**: 2개 학원
- **대전**: 2개 학원
- **울산**: 2개 학원
- **수원**: 2개 학원
- **성남**: 2개 학원
- **고양**: 2개 학원
- **용인**: 2개 학원
- **부천**: 2개 학원
- **안양**: 2개 학원

**총 34개 학원**

## 파일 설명

### 1. `insert_dance_academies.sql`
- Supabase에 직접 실행할 수 있는 SQL INSERT 문
- 모든 학원 데이터를 한 번에 삽입

### 2. `dance_academies_data.json`
- JSON 형식의 상세 데이터
- 추가 정보 포함 (설명, 웹사이트, 인스타그램 등)
- 프로그램에서 활용 가능

## 주의사항

### ⚠️ 확인이 필요한 정보
다음 정보들은 실제 네이버 지도에서 확인하여 수정이 필요합니다:

1. **주소 (address)**
   - 현재 주소는 일반적인 형식으로 작성되었습니다
   - 실제 정확한 주소는 네이버 지도에서 확인 필요

2. **연락처 (contact_number)**
   - 현재 연락처는 예시 형식입니다
   - 실제 전화번호는 네이버 지도에서 확인 필요

3. **로고 URL (logo_url)**
   - 현재 NULL로 설정되어 있습니다
   - 각 학원의 공식 웹사이트나 SNS에서 로고 이미지 URL을 수집하여 추가 필요

4. **사진 (academy_images)**
   - 학원 이미지는 `academy_images` 테이블에 별도로 등록 필요
   - 네이버 지도나 공식 웹사이트에서 이미지 URL 수집

## DB 등록 방법

### 방법 1: SQL 파일 직접 실행
1. Supabase Dashboard에 로그인
2. SQL Editor로 이동
3. `insert_dance_academies.sql` 파일 내용을 복사하여 실행

### 방법 2: Supabase MCP 사용
```bash
# Supabase MCP를 통해 마이그레이션으로 실행
```

### 방법 3: 프로그램을 통한 등록
- `dance_academies_data.json` 파일을 읽어서
- `lib/db/academies.ts`의 `createAcademy` 함수를 사용하여 등록

## 데이터 수정 가이드

### 주소 수정
네이버 지도에서 각 학원을 검색하여 정확한 주소를 확인하고 SQL 파일을 수정하세요.

예시:
```sql
UPDATE public.academies 
SET address = '서울특별시 강남구 논현로 131길 24' 
WHERE name_kr = '원밀리언 댄스 스튜디오';
```

### 연락처 수정
```sql
UPDATE public.academies 
SET contact_number = '02-1234-5678' 
WHERE name_kr = '원밀리언 댄스 스튜디오';
```

### 로고 URL 추가
```sql
UPDATE public.academies 
SET logo_url = 'https://example.com/logo.png' 
WHERE name_kr = '원밀리언 댄스 스튜디오';
```

### 학원 이미지 추가
```sql
-- academy_id는 academies 테이블에서 조회한 실제 ID로 변경
INSERT INTO public.academy_images (academy_id, image_url, display_order) 
VALUES 
  ('academy-uuid-here', 'https://example.com/image1.jpg', 1),
  ('academy-uuid-here', 'https://example.com/image2.jpg', 2);
```

## 태그 설명
각 학원에는 다음과 같은 태그가 포함되어 있습니다:
- **K-POP**: K-POP 댄스 전문
- **힙합**: 힙합 댄스 전문
- **스트릿댄스**: 스트릿 댄스 전문
- **컨템포러리**: 컨템포러리 댄스 전문
- **재즈댄스**: 재즈 댄스 전문
- **모던댄스**: 모던 댄스 전문
- **세계적유명**: 세계적으로 유명한 학원

## 다음 단계
1. ✅ SQL 파일 생성 완료
2. ⏳ 네이버 지도에서 실제 주소 및 연락처 확인
3. ⏳ 각 학원의 로고 및 이미지 URL 수집
4. ⏳ Supabase에 데이터 등록
5. ⏳ 등록된 데이터 검증

## 참고
- 네이버 지도: https://map.naver.com
- 각 학원의 공식 웹사이트나 인스타그램에서 추가 정보 확인 가능

