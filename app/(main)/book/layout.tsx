"use client";

import { usePathname, useRouter } from 'next/navigation';
import { CSSLoader } from '@/components/common/css-loader';
import { BottomNav } from '@/components/navigation/bottom-nav';
import { PullToRefresh } from '@/components/common/pull-to-refresh';
import { ViewState } from '@/types';

export default function BookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const getActiveTab = (): ViewState => {
    if (pathname === '/home' || pathname === '/') return 'HOME';
    if (pathname.startsWith('/academy')) return 'ACADEMY';
    if (pathname.startsWith('/instructor')) return 'DANCER';
    if (pathname === '/schedule') return 'SAVED';
    if (pathname.startsWith('/my')) return 'MY';
    return 'HOME';
  };

  const handleTabChange = (tab: ViewState) => {
    const routes: Record<ViewState, string> = {
      'HOME': '/home',
      'ACADEMY': '/academy',
      'DANCER': '/instructor',
      'SAVED': '/schedule',
      'MY': '/my',
      'DETAIL_ACADEMY': '/academy',
      'DETAIL_DANCER': '/instructor',
      'DETAIL_CLASS': '/',
      'PAYMENT': '/payment',
      'PAYMENT_SUCCESS': '/payment/success',
      'SEARCH_RESULTS': '/search',
      'TICKETS': '/tickets',
      'PAYMENT_HISTORY': '/payment-history',
      'SETTINGS': '/settings',
      'FAQ': '/faq',
      'NOTICES': '/notices',
    };
    const route = routes[tab];
    if (route) router.push(route);
  };

  return (
    <>
      <CSSLoader />
      <div className="flex justify-center bg-neutral-50 dark:bg-black min-h-screen font-sans selection:bg-primary dark:selection:bg-[#CCFF00] selection:text-black">
        <div className="w-full max-w-[420px] bg-white dark:bg-neutral-950 min-h-screen relative shadow-2xl overflow-hidden flex flex-col border-x border-neutral-200 dark:border-neutral-900">
          <main className="flex-1 overflow-y-auto scrollbar-hide" style={{ paddingBottom: 'calc(72px + max(0px, env(safe-area-inset-bottom, 0px)))' }}>
            <PullToRefresh>
              {children}
            </PullToRefresh>
          </main>
          <BottomNav activeTab={getActiveTab()} onTabChange={handleTabChange} />
        </div>
      </div>
    </>
  );
}
