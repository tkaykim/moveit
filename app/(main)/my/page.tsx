"use client";

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { MyPageView } from '@/components/views/my-page-view';

function MyPageContent() {
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
    if (route) router.push(route);
  };
  return <MyPageView onNavigate={handleNavigate} />;
}

export default function MyPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-gray-500">로딩 중...</div>}>
      <MyPageContent />
    </Suspense>
  );
}
