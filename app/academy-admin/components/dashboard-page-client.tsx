'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DashboardView } from './views/dashboard-view';

interface DashboardPageClientProps {
  academyId: string;
}

export function DashboardPageClient({ academyId }: DashboardPageClientProps) {
  const searchParams = useSearchParams();
  const [toast, setToast] = useState<string | null>(null);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);

  useEffect(() => {
    const subscription = searchParams?.get('subscription');
    const billing = searchParams?.get('billing');

    if (subscription === 'start') {
      setToast('학원이 개설되었습니다. 이제 기능들을 체험해 보세요.');
      setShowWelcomeBanner(true);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('subscription');
        url.searchParams.delete('planId');
        url.searchParams.delete('cycle');
        window.history.replaceState({}, '', url.pathname + url.search);
      }
      return;
    }
    if (subscription === 'success') {
      setToast('구독이 완료되었습니다.');
    } else if (subscription === 'card_ok') {
      setToast('카드가 등록되었습니다. 구독/결제 관리에서 구독을 시작해 주세요.');
    } else if (billing === 'fail') {
      setToast('카드 등록에 실패했습니다. 가상 카드가 아닌 실제 본인 카드로 시도해 주세요. (테스트 환경에서는 출금되지 않습니다.)');
    }
    if ((subscription || billing) && subscription !== 'start' && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('subscription');
      url.searchParams.delete('billing');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <>
      {toast && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-sm font-medium shadow-lg"
          role="alert"
        >
          {toast}
        </div>
      )}
      <DashboardView
        academyId={academyId}
        showWelcomeBanner={showWelcomeBanner}
        onDismissWelcomeBanner={() => setShowWelcomeBanner(false)}
      />
    </>
  );
}
