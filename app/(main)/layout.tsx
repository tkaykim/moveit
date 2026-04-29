"use client";

import { usePathname, useRouter } from 'next/navigation';
import { BottomNav } from '@/components/navigation/bottom-nav';
import { ViewState } from '@/types';
import { CSSLoader } from '@/components/common/css-loader';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { PullToRefresh } from '@/components/common/pull-to-refresh';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  
  // 경로를 ViewState로 변환
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
    if (route) {
      router.push(route);
    }
  };

  const isBookRoute = pathname.startsWith('/book');

  return (
    <LocaleProvider>
      <CSSLoader />
      <div className="flex justify-center bg-bg min-h-screen font-sans selection:bg-accent selection:text-accent-ink">
        <div className="w-full max-w-[420px] bg-surface min-h-screen relative shadow-token-lg overflow-hidden flex flex-col border-x border-border">
          <main
            className="flex-1 overflow-y-auto scrollbar-hide pt-safe"
            style={
              !isBookRoute
                ? { paddingBottom: '76px' }
                : undefined
            }
          >
            <PullToRefresh
              onRefresh={async () => {
                window.dispatchEvent(new CustomEvent('pull-to-refresh'));
                router.refresh();
              }}
            >
              {children}
            </PullToRefresh>
          </main>
          {!isBookRoute && <BottomNav activeTab={getActiveTab()} onTabChange={handleTabChange} />}
        </div>
      </div>
    </LocaleProvider>
  );
}

