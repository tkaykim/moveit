# 영어 사용자용 번역(i18n) 구현 계획

> 목적: 영어권 사용자를 위한 UI 영어 지원. 관리자 페이지는 제외, 사용자 facing 뷰만 대상. DB 구조는 변경하지 않음.

---

## 1. 언어 전환 위치: 설정(My/설정) vs 프론트 공통

### 권장: **설정 페이지에서 전환**

| 구분 | 설정에서 전환 | 프론트(헤더/하단) 전환 |
|------|----------------|-------------------------|
| 장점 | 화면이 단순해짐, “설정”에 언어가 자연스럽게 포함 | 진입 직후 바로 영어로 전환 가능 |
| 단점 | 첫 방문자는 한동안 한국어로 보임 | 네비/모든 화면에 언어 버튼 노출 필요 |
| 결론 | **설정(설정 > 언어)** 에서 전환. 필요 시 나중에 헤더에 작은 글로브 아이콘 추가 가능 | 1차에서는 생략 |

- **언어 선택 위치**: **마이페이지 → 설정(/settings) → “언어” 항목** 추가.
- 설정 화면에 “한국어 / English” 선택(라디오 또는 드롭다운). 선택 값은 **localStorage**에 저장(`moveit_lang`: `'ko'` | `'en'`).
- (선택) 2단계에서 홈/상단에 작은 🌐 아이콘으로 설정의 언어 섹션으로 이동하거나, 드롭다운으로 바로 전환하는 방식 추가 검토.

---

## 2. DB 구조: 변경 없음

- **번역 데이터**: DB에 저장하지 않음. 모든 UI 문구는 **프론트 전용 JSON(또는 TS) 번역 파일**로 관리.
- **DB에서 오는 콘텐츠**(학원명, 강사명, 클래스명 등): 이미 `name_kr`, `name_en` 등이 있는 테이블은 **그대로 사용**.
  - 표시 시: `lang === 'en'` 이면 `name_en ?? name_kr`, 아니면 `name_kr ?? name_en` 로만 처리하면 됨.
- 신규 컬럼, 신규 테이블, 마이그레이션 **불필요**.

---

## 3. 구현 방식

### 3-1. 라이브러리

- **next-intl** 또는 **react-i18next** 같은 풀 i18n은 선택 사항.
- **권장(1차)**: 가벼운 **자체 Context + JSON** 방식.
  - 번역 키-값만 `locales/ko.json`, `locales/en.json` 으로 두고,
  - `LocaleContext`(또는 `I18nContext`)에서 `language`, `setLanguage`, `t(key)` 제공.
  - `t(key)` 에서 해당 언어 JSON에 키가 없으면 **한국어로 fallback** → “전체를 한 번에 바꾸기 어렵다”는 요구에 맞게 **점진적 번역** 가능.

### 3-2. 언어 저장 및 초기화

- **저장**: `localStorage.setItem('moveit_lang', 'ko' | 'en')`.
- **읽기**: 앱 초기 로드 시(또는 `LocaleProvider` 마운트 시) `localStorage.getItem('moveit_lang')` → 없으면 `'ko'`.
- **적용 범위**: `app/(main)/` 아래만. `app/academy-admin/`, `app/admin/` 은 Context에서 제외하거나, 항상 `ko` 고정.

### 3-3. 번역 파일 구조(예시)

```
locales/
  ko.json   ← 기본값. 키만 있어도 되고, 값은 기존 하드코딩 문구와 맞추기
  en.json   ← 영어. 없는 키는 ko에서 fallback
```

- 키 네이밍: `화면명.영역.문구` (예: `settings.title`, `bottomNav.home`, `common.back`).
- 1차에서는 **자주 보이는 화면 위주**로 키를 정하고, 나머지는 그대로 한국어 문자열 두고 점진적으로 키로 교체.

### 3-4. DB 값 표시 규칙(이름 등)

- 학원/강사/클래스 등: `name_kr`, `name_en` 있는 필드는  
  `const name = lang === 'en' ? (name_en || name_kr) : (name_kr || name_en);` 로 표시.
- 이 로직은 공통 유틸 한 곳에 두고(예: `lib/i18n/display-name.ts`), 필요한 컴포넌트에서만 사용.

---

## 4. 적용 범위(사용자 facing만)

- **포함**: `app/(main)/` 레이아웃 및 그 하위 모든 페이지/뷰.
  - 홈, 학원 목록/상세, 강사 목록/상세, 수업 예약(book), 마이, 일정(schedule), 수강권(tickets), 결제/결제완료, 설정, FAQ, 공지, 검색 등.
- **제외**: `app/academy-admin/*`, `app/admin/*` → 한국어 고정, 번역 키 불필요.

---

## 5. 작업 순서 제안

| 단계 | 내용 |
|------|------|
| 1 | **Context + localStorage**  
|      | `LocaleContext`(language, setLanguage, t), `locales/ko.json` / `en.json` 생성. `(main)` layout을 `LocaleProvider`로 감싸기. |
| 2 | **설정 화면**  
|      | 설정 페이지에 “언어” 항목 추가(한국어/English). 선택 시 `setLanguage` + `localStorage` 반영. 설정 화면 문구부터 `t(...)` 로 교체. |
| 3 | **공통 UI**  
|      | 하단 네비(`bottom-nav`: 홈, 학원, 강사, 일정, 마이), 공통 버튼(뒤로, 확인 등)을 `t(...)` 로 교체. |
| 4 | **메인 뷰**  
|      | 홈, 학원 목록/상세, 강사 목록/상세, 마이페이지, 수강권, 일정, 결제 플로우 등에서 하드코딩 문구를 키로 옮기고 `en.json` 에 해당 키 추가. |
| 5 | **DB 값 표시**  
|      | 학원/강사/클래스 이름 등 `name_kr`/`name_en` 사용하는 곳에 “영어일 때 name_en 우선” 로직 적용(유틸 함수 사용). |
| 6 | (선택) **메타/접근성**  
|      | `app/layout.tsx`의 `<html lang="ko">` 를 언어에 따라 `lang={language}` 로 변경. |

---

## 6. 파일/폴더 추가·수정 요약

- **신규**
  - `contexts/LocaleContext.tsx` (또는 `lib/i18n/LocaleContext.tsx`)
  - `locales/ko.json`, `locales/en.json`
  - `lib/i18n/display-name.ts` (name_kr/name_en 선택 유틸)
- **수정**
  - `app/(main)/layout.tsx` → `LocaleProvider`로 children 감싸기
  - `app/(main)/settings/page.tsx` 또는 `components/views/settings-view.tsx` → 언어 설정 UI + `t()` 적용
  - `components/navigation/bottom-nav.tsx` → 라벨 `t()` 적용
  - 그 다음 단계로 각 사용자 뷰 컴포넌트에서 문구를 `t(key)` 로 교체하고 `en.json` 에 값 추가
- **미수정(DB)**
  - 마이그레이션 없음. 기존 `name_kr`/`name_en` 만 활용.

---

## 7. 정리

- **언어 전환**: 설정(My → 설정)에서 “언어”로 한국어/English 선택. (필요 시 추후 헤더 등에 짧은 경로 추가)
- **저장**: localStorage만 사용, DB 스키마 변경 없음.
- **번역 데이터**: 프론트 전용 `locales/ko.json`, `locales/en.json` + Context `t(key)`, 없으면 한국어 fallback으로 점진적 적용.
- **대상**: 사용자 facing(`(main)` 하위)만 영어 지원; 관리자 페이지는 한국어 유지.

이 계획대로 진행하면 “모든 내용을 통째로 바꾸지 않고”, “DB를 건드리지 않고”, “사용자 뷰만 영어”로 맞출 수 있습니다.
