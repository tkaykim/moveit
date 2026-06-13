/**
 * 플랫폼 사업자 정보 (학원 사업자 아님).
 * 결제(PG)는 토스페이먼츠 '피스코프' 가맹점을 통해 처리되므로,
 * 전자상거래법상 판매자=플랫폼 사업자 정보를 앱에 노출한다.
 * (modoo_app Footer와 동일한 정본 정보)
 */
export const PLATFORM_BUSINESS = {
  companyName: '피스코프',
  ceoName: '김현준',
  privacyOfficer: '이은원',
  businessNumber: '118-08-15095',
  mailOrderNumber: '2021-서울마포-1399',
  address: '서울특별시 마포구 새터산 4길 2, b102호',
  phone: '010-2087-0621',
} as const;

/** 라벨 + 값 순서대로 렌더링하기 위한 항목 배열 */
export const PLATFORM_BUSINESS_ITEMS: { label: string; value: string }[] = [
  { label: '상호명', value: PLATFORM_BUSINESS.companyName },
  { label: '대표자', value: PLATFORM_BUSINESS.ceoName },
  { label: '사업자등록번호', value: PLATFORM_BUSINESS.businessNumber },
  { label: '통신판매업신고번호', value: PLATFORM_BUSINESS.mailOrderNumber },
  { label: '개인정보 책임자', value: PLATFORM_BUSINESS.privacyOfficer },
  { label: '주소', value: PLATFORM_BUSINESS.address },
  { label: '전화번호', value: PLATFORM_BUSINESS.phone },
];
