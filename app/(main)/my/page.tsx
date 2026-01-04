"use client";

import { useRouter } from 'next/navigation';
import { MyPageView } from '@/components/views/my-page-view';
import { Academy, Dancer } from '@/types';

export default function MyPage() {
  const router = useRouter();

  const handleNavigate = (view: string) => {
    const routes: Record<string, string> = {
      'HOME': '/home',
      'ACADEMY': '/academy',
      'DANCER': '/instructor',
      'SAVED': '/schedule',
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

  const handleAcademyClick = (academy: Academy) => {
    router.push(`/academy/${academy.id}`);
  };

  const handleDancerClick = (dancer: Dancer) => {
    router.push(`/instructor/${dancer.id}`);
  };

  return (
    <MyPageView 
      myTickets={0}
      onQrOpen={() => {}}
      onNavigate={handleNavigate}
      onAcademyClick={handleAcademyClick}
      onDancerClick={handleDancerClick}
    />
  );
}

