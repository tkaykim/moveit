'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * 모달/바텀시트를 document.body로 Portal 시키는 래퍼.
 *
 * 왜 필요한가:
 * `position: fixed` 요소는 조상 중 `transform`/`filter`/`perspective`/`will-change:transform`/
 * `contain` 이 걸린 요소가 있으면 그 조상을 기준(containing block)으로 배치된다.
 * 우리 앱은 `animate-in`(tailwindcss-animate) 등이 조상에 identity transform 을 남겨,
 * 페이지 내부에서 렌더된 `fixed inset-0` 모달이 뷰포트가 아니라 스크롤 영역(조상) 기준으로
 * 잡혀 화면 하단에 붙지 않고 엉뚱한 위치(때론 스크롤 밖)에 떠버린다.
 * body 로 Portal 하면 transform 조상에서 탈출해 항상 뷰포트 기준으로 배치된다.
 */
export function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
