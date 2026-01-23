"use client";

import { useRouter } from 'next/navigation';
import { MyPageView } from '@/components/views/my-page-view';

export default function MyPage() {
  const router = useRouter();

  const handleNavigate = (view: string) => {
    const routes: Record<string, string> = {
      'HOME': '/home',
      'TICKETS': '/tickets',
      'PAYMENT_HISTORY': '/payment-history',
      'SETTINGS': '/settings',
      'FAQ': '/faq',
      'NOTICES': '/notices',
    };
    
    const route = routes[view];
    if (route) {
      router.push(route);
    }
  };

  return <MyPageView onNavigate={handleNavigate} />;
}
