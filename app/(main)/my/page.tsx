"use client";

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { MyPageView } from '@/components/views/my-page-view';
import { Academy, Dancer } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

export default function MyPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [myTickets, setMyTickets] = useState(0);
  const [loading, setLoading] = useState(true);

  // 보유 수강권 수 로드
  const loadTickets = async () => {
    if (!user) {
      setMyTickets(0);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/user-tickets');
      if (response.ok) {
        const { counts } = await response.json();
        setMyTickets(counts.total || 0);
      } else {
        setMyTickets(0);
      }
    } catch (error) {
      console.error('Error loading tickets:', error);
      setMyTickets(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [user]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-neutral-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <MyPageView 
      myTickets={myTickets}
      onQrOpen={() => {}}
      onNavigate={handleNavigate}
      onAcademyClick={handleAcademyClick}
      onDancerClick={handleDancerClick}
      onTicketsRefresh={loadTickets}
    />
  );
}

