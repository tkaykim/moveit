# 학원 홈 꾸미기(커스터마이징) 구현 계획

> 목적: 학원 관리자가 자신의 학원 공개 홈(/academy/[id])을 게시판처럼 꾸밀 수 있도록 함.  
> - 사진 첨부(공지 이미지, 배너 등)  
> - 섹션 순서 변경(수업 영상 위/캘린더 아래, 공지 이미지 최상단 등)  
> - 학원마다 다른 레이아웃/구성 가능  

---

## 1. 현재 구조 정리

- **공개 페이지**: `(main)/academy/[id]` → `AcademyDetailView`
- **탭**: 홈 | 시간표 | 리뷰 (스크롤 시 고정 탭으로 전환)
- **홈 탭 내부(현재 고정 순서)**  
  1. 학원 정보 (소개 문구, 상담 신청, 태그)  
  2. 최근 수업 영상 (가로 스크롤)  
- **시간표 탭**: 주간/월간 캘린더, 수강권 구매  
- **리뷰 탭**: placeholder  
- **상단**: 커버 이미지 1장 (`academy.img` 또는 `academy.logo_url`)

- **DB**: `academies` 에 이미 `images` (Json), `description`, `logo_url` 등 존재.  
- **저장소**: `lib/utils/storage.ts` 로 Supabase Storage 업로드/삭제 가능.

---

## 2. 목표 동작

| 기능 | 설명 |
|------|------|
| **섹션 순서 변경** | 관리자가 “학원 소개 / 수업 영상 / 시간표 / 리뷰” + **커스텀 블록** 순서를 드래그 등으로 지정. 예: A학원은 수업 영상 → 캘린더, B학원은 공지 이미지 → 소개 → 영상 → 캘린더. |
| **커스텀 이미지 블록** | 게시판처럼 “이미지 1장” 또는 “이미지 여러 장(캐러셀)” 추가. 최상단 공지 이미지, 배너, 이벤트 안내 등. |
| **저장** | 설정은 학원별로 저장. DB는 최소 변경(아래 참고). |

---

## 3. DB 설계 (최소 변경)

- **방안 A (권장)**: `academies` 테이블에 **컬럼 1개** 추가  
  - `home_config` (JSONB, nullable)  
  - 한 컬럼에 “순서 + 커스텀 블록 정의” 모두 저장.

- **방안 B**: 별도 테이블 `academy_home_blocks` (academy_id, type, sort_order, payload JSONB)  
  - 확장성 좋지만, “DB 구조 최대한 안 건드린다”는 요구에는 컬럼 1개 추가가 더 부담이 적음.

**권장: 방안 A — `academies.home_config` 1개만 추가.**

### 3-1. `home_config` JSON 구조(예시)

```ts
type HomeConfig = {
  // 섹션/블록 표시 순서. 값은 블록 식별자.
  sectionOrder: string[];  // e.g. ['block_1', 'intro', 'videos', 'schedule', 'reviews']

  // 커스텀 블록 정의 (이미지, 캐러셀 등). 시스템 섹션(intro, videos, schedule, reviews)은 여기 없음.
  blocks: Array<{
    id: string;           // block_1, block_2, ...
    type: 'image' | 'image_carousel';
    sortOrder: number;     // sectionOrder 내 순서와 매칭용
    payload: {
      imageUrl: string;    // 공개 URL (Storage 업로드 결과)
      caption?: string;
      linkUrl?: string;    // 클릭 시 이동 링크 (선택)
      // image_carousel 인 경우
      images?: Array<{ imageUrl: string; caption?: string; linkUrl?: string }>;
    };
  }>;
};
```

- `sectionOrder` 에만 있고 `blocks` 에 없는 id → “시스템 섹션” (intro, videos, schedule, reviews).  
- `sectionOrder` 에 있고 `blocks` 에 있는 id → 해당 커스텀 블록을 그 순서에 렌더.

### 3-2. 마이그레이션

- `academies` 에 `home_config JSONB DEFAULT NULL` 추가.  
- 기존 행은 NULL → 프론트에서 NULL 이면 **현재와 동일한 기본 순서** 사용 (intro → videos, schedule/리뷰는 탭으로 유지하거나 동일 순서).

---

## 4. 저장소(이미지 업로드)

- **Supabase Storage** 기존 활용.  
- 버킷: 기존에 쓰는 공용 버킷 또는 `academy-assets` 같은 전용 버킷.  
- 경로: `academies/{academy_id}/home/{block_id}_{timestamp}.{ext}` (또는 `home/{filename}`).  
- 업로드/삭제는 `lib/utils/storage.ts` 사용.  
- 관리자만 업로드 가능하도록 RLS/API에서 academy 소유(또는 관리자) 검증.

---

## 5. 관리자 UI (학원 관리자 페이지)

- **위치**: academy-admin 내 “학원 홈 꾸미기” 또는 “설정” 하위 “홈 꾸미기” 메뉴.  
- **화면 구성 제안**  
  1. **섹션 순서**  
     - “표시 순서” 리스트: [공지 이미지1] [학원 소개] [수업 영상] [시간표] [리뷰] …  
     - 드래그 앤 드롭으로 순서 변경 → `sectionOrder` 반영.  
  2. **커스텀 블록**  
     - “이미지 추가”: 업로드(1장), 캡션/링크(선택). 추가 시 `blocks` 에 push, `sectionOrder` 에 해당 block id 삽입(위치 선택 가능).  
     - “이미지 여러 장(캐러셀)” 추가도 동일하게 블록 하나로 추가.  
     - 각 블록에 “위로/아래로”, “삭제” 버튼 → `sectionOrder`/`blocks` 갱신.  
  3. **미리보기**  
     - “학원 홈 미리보기” 버튼 → 새 탭으로 `/academy/[id]` 열기 (또는 iframe).  

- **API**  
  - `GET /api/academies/[id]/home-config` (관리자): 해당 학원 `home_config` 반환.  
  - `PUT /api/academies/[id]/home-config` (관리자): body에 `HomeConfig` 받아서 `academies.home_config` 업데이트.  
  - 이미지 업로드: `POST /api/upload` 또는 기존 업로드 API에 `path=academies/:id/home` 식으로 확장.  

- **권한**: 해당 academy의 관리자만 접근(세션/소속 확인).

---

## 6. 공개 페이지 반영 (AcademyDetailView)

- **데이터**: 학원 상세 조회 시 `academies.home_config` 포함해서 가져오기 (이미 조인되어 있다면 그대로, 없으면 API/서버에서 select 에 추가).  
- **렌더링**  
  - `home_config === null` → **기본 순서**: 기존처럼 [학원 정보] → [최근 수업 영상]. (시간표/리뷰는 기존 탭 유지.)  
  - `home_config` 있으면 `sectionOrder` 순서대로 렌더:  
    - `intro` → 기존 “학원 정보” 섹션  
    - `videos` → 기존 “최근 수업 영상”  
    - `schedule` → 기존 “시간표” 섹션  
    - `reviews` → 기존 “리뷰” 섹션  
    - `block_*` → `blocks` 에서 id 로 찾아서 type 에 따라 이미지 1장 또는 캐러셀 렌더.  
- **탭(홈/시간표/리뷰)**  
  - 옵션 1: 유지. “홈” 탭 안에서만 위 순서대로 스크롤.  
  - 옵션 2: “홈”을 “섹션 묶음”으로만 쓰고, 시간표/리뷰는 그대로 별도 탭.  
  - 1차는 **옵션 1** 권장(변경 최소).  

- **커스텀 블록 컴포넌트**  
  - `AcademyHomeImageBlock`, `AcademyHomeCarouselBlock` (또는 하나의 `AcademyHomeCustomBlock` 에 type 분기).  
  - 공개 페이지는 읽기 전용; 링크 있으면 `<a>` 또는 버튼으로 이동.

---

## 7. 작업 순서 제안

| 단계 | 내용 |
|------|------|
| 1 | **DB**  
|    | `academies.home_config` (JSONB, nullable) 마이그레이션. `types/database.ts` 반영. |
| 2 | **API**  
|    | GET/PUT 학원 home-config (관리자). 이미지 업로드 API(경로: academy home용) 확인/추가. |
| 3 | **관리자 UI**  
|    | “학원 홈 꾸미기” 페이지: 섹션 순서 드래그, “이미지 블록 추가”(1장/캐러셀), 저장. |
| 4 | **공개 뷰**  
|    | AcademyDetailView에서 `home_config` 읽어서 `sectionOrder` 순서대로 렌더; 커스텀 블록 컴포넌트 추가. |
| 5 | **기본값**  
|    | `home_config` null 일 때 현재와 동일한 순서/구성 보장. |

---

## 8. 파일/폴더 요약

- **신규**  
  - 마이그레이션: `academies.home_config` 추가  
  - `app/academy-admin/.../academy-home-edit/` (또는 설정 하위) — 학원 홈 꾸미기 페이지  
  - `app/api/academies/[id]/home-config/route.ts` (GET/PUT)  
  - `components/views/academy-detail/` (선택) — `AcademyHomeImageBlock`, `AcademyHomeCarouselBlock` 또는 `AcademyHomeCustomBlock`  
- **수정**  
  - `types/database.ts` — academies 에 `home_config`  
  - `components/views/academy-detail-view.tsx` — 홈 탭 내부를 `home_config.sectionOrder` 기반으로 렌더, 커스텀 블록 삽입  
  - 학원 조회 API/쿼리 — `home_config` select 포함  

---

## 9. 정리

- **학원 홈** = 공개 페이지 “홈” 탭 안의 **섹션 순서 + 커스텀 이미지(블록)** 로 게시판처럼 꾸미기.  
- **DB**: `academies.home_config` 1개 컬럼만 추가.  
- **이미지**: Supabase Storage, 기존 유틸 사용.  
- **관리자**: “학원 홈 꾸미기”에서 순서 변경 + 이미지 블록 추가/삭제/순서 변경.  
- **공개**: `home_config` 있으면 그 순서대로, 없으면 현재와 동일한 기본 순서로 동작.

이 계획대로 진행하면 학원마다 “공지 이미지 최상단”, “수업 영상 위/캘린더 아래” 등 자유로운 구성이 가능합니다.
