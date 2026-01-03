# 관리자 페이지 구조 제안

## 추천 방안: Role-Based 접근 방식

### 구조 개요

```
/admin (공통 경로)
├── 레이아웃: 역할에 따라 사이드바 메뉴 동적 표시
├── 데이터 접근: RLS + 서버 사이드 필터링
└── 컴포넌트: 역할별 조건부 렌더링
```

### 역할(Role) 정의

1. **SUPER_ADMIN**: 플랫폼 전체 관리
   - 모든 학원, 클래스, 강사 관리
   - 현재 `/admin` 페이지와 동일한 기능

2. **ACADEMY_OWNER**: 학원 원장
   - 본인 학원의 모든 데이터 관리
   - 클래스, 강사, 홀, 스케줄, 예약 관리
   - 학원 정보 수정

3. **ACADEMY_MANAGER**: 학원 매니저
   - 원장과 유사하지만 일부 제한 가능 (필요시)
   - 클래스, 스케줄, 예약 관리

4. **INSTRUCTOR**: 강사
   - 본인의 스케줄 관리
   - 본인의 수업 예약 인원 확인/관리
   - 클래스 정보 수정 (본인이 담당하는 클래스만)

5. **USER**: 일반 사용자
   - 관리 페이지 접근 불가

### 페이지 구조

```
/app/admin/
├── layout.tsx              # 역할 체크 + 동적 사이드바
├── page.tsx                # 역할별 대시보드
├── components/
│   ├── admin-sidebar.tsx   # 역할별 메뉴 표시
│   ├── role-guard.tsx      # 역할별 접근 제어
│   └── ...
├── classes/
│   └── page.tsx            # 역할별 필터링 적용
├── schedules/
│   └── page.tsx            # 역할별 필터링 적용
├── bookings/
│   └── page.tsx            # 역할별 필터링 적용
└── ...
```

### 구현 단계

#### 1단계: 데이터베이스 스키마 설정
- [x] `user_roles_schema.sql` 파일 생성
- [ ] 스키마 실행 및 테스트
- [ ] RLS 정책 설정

#### 2단계: 유틸리티 함수 생성
- [ ] 사용자 역할 조회 함수
- [ ] 사용자-학원 관계 조회 함수
- [ ] 사용자-강사 관계 조회 함수
- [ ] 권한 체크 헬퍼 함수

#### 3단계: 레이아웃 및 가드 구현
- [ ] `admin/layout.tsx` 수정 (역할 체크)
- [ ] `RoleGuard` 컴포넌트 생성
- [ ] 사이드바 동적 메뉴 구현

#### 4단계: 페이지별 데이터 필터링
- [ ] 각 페이지에서 역할에 따른 데이터 필터링
- [ ] API/쿼리 레이어에서 권한 체크

#### 5단계: UI 컴포넌트 수정
- [ ] 역할별 버튼/액션 표시 제어
- [ ] 역할별 메시지/안내 표시

### 사이드바 메뉴 예시

#### SUPER_ADMIN
- 학원 관리
- 강사 관리
- 클래스 관리
- 예약 관리
- 스케줄 관리
- 홀 관리

#### ACADEMY_OWNER / ACADEMY_MANAGER
- 대시보드 (본인 학원 통계)
- 클래스 관리 (본인 학원만)
- 스케줄 관리 (본인 학원만)
- 예약 관리 (본인 학원만)
- 강사 관리 (본인 학원 강사만)
- 홀 관리 (본인 학원만)
- 학원 설정

#### INSTRUCTOR
- 대시보드 (본인 스케줄 통계)
- 내 스케줄
- 내 예약 관리
- 클래스 관리 (본인이 담당하는 클래스만)

### 데이터 접근 제어 예시

```typescript
// 예: 클래스 목록 조회
async function getClasses(userRole: string, userId: string, academyId?: string) {
  const supabase = await createClient();
  
  let query = supabase.from('classes').select('*');
  
  if (userRole === 'SUPER_ADMIN') {
    // 모든 클래스
  } else if (['ACADEMY_OWNER', 'ACADEMY_MANAGER'].includes(userRole)) {
    // 본인 학원의 클래스만
    query = query.eq('academy_id', academyId);
  } else if (userRole === 'INSTRUCTOR') {
    // 본인이 담당하는 클래스만
    query = query.eq('instructor_id', instructorId);
  }
  
  return query;
}
```

### RLS 정책 예시

```sql
-- academy_users 테이블 RLS
CREATE POLICY "Users can view their own academy relationships"
ON public.academy_users
FOR SELECT
USING (auth.uid() = user_id);

-- classes 테이블 RLS (예시)
CREATE POLICY "Academy owners can manage their classes"
ON public.classes
FOR ALL
USING (
  academy_id IN (
    SELECT academy_id FROM public.academy_users
    WHERE user_id = auth.uid()
    AND role IN ('ACADEMY_OWNER', 'ACADEMY_MANAGER')
  )
);
```

### 장점 요약

1. **코드 재사용**: 공통 컴포넌트와 로직 사용
2. **유지보수**: 한 곳 수정으로 모든 역할에 적용
3. **확장성**: 새로운 역할 추가 시 최소한의 변경
4. **일관성**: 동일한 UI/UX 경험
5. **보안**: 중앙화된 권한 관리

### 고려사항

1. **성능**: 역할별 필터링이 복잡할 수 있음 → 인덱스 최적화 필요
2. **복잡도**: 초기 구현이 다소 복잡 → 단계적 구현 권장
3. **테스트**: 각 역할별 테스트 케이스 필요

### 다음 단계

1. 데이터베이스 스키마 적용
2. 기본 유틸리티 함수 구현
3. 레이아웃 및 가드 구현
4. 하나의 페이지(예: classes)로 프로토타입 테스트
5. 나머지 페이지 적용


