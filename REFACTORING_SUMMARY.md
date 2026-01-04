# 수강권 시스템 리팩토링 요약

## 완료된 작업

### 1. 백엔드 로직 개선
- **lib/db/user-tickets.ts**: 
  - `getAvailableUserTickets()`: 사용 가능한 수강권 조회 (만료일, remaining_count 확인)
  - `useUserTicket()`: 수강권 차감 로직
  - `getUserTicketCounts()`: 전체/학원별 수강권 개수 조회

### 2. API 구현
- **app/api/user-tickets/route.ts**: 사용 가능한 수강권 조회 API
- **app/api/bookings/route.ts**: 예약 생성 + 수강권 차감 API
  - 수강권 자동 선택 (학원별 > 전체 순)
  - 수강권 차감
  - 예약 실패 시 수강권 복구

### 3. 프론트엔드 개선
- **app/(main)/my/page.tsx**: 새로운 API 사용하여 수강권 개수 조회

## 남은 작업

### 1. 결제 페이지 개선
- 수강권 선택 UI 구현
- booking API와 연동
- 사용 가능한 수강권 목록 표시

### 2. 마이페이지 뷰 재구성
- 전체/학원별 수강권 구분 표시
- 상세 정보 표시

### 3. 추가 개선 사항
- 결제 성공 페이지 수강권 개수 업데이트
- 에러 처리 개선
- 로딩 상태 개선

## 주요 변경 사항

1. **수강권 조회**: 만료일과 remaining_count를 확인하여 실제 사용 가능한 수강권만 반환
2. **수강권 사용**: remaining_count 차감 및 0이 되면 USED 상태로 변경
3. **예약 생성**: 수강권 자동 선택 및 차감, 실패 시 롤백
4. **우선순위**: 학원별 수강권 > 전체 수강권

