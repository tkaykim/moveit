"use client";

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { PaymentSuccessView } from '@/components/views/payment-success-view';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

export default function PaymentSuccessPage() {
  const router = useRouter();
  const [myTickets, setMyTickets] = useState(0);

  useEffect(() => {
    const loadTickets = async () => {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        // 인증 기능 제거로 인해 티켓 수를 0으로 설정
        setMyTickets(0);
      } catch (error) {
        console.error('Error loading tickets:', error);
      }
    };

    loadTickets();
  }, []);

  const handleNavigate = (view: string) => {
    const routes: Record<string, string> = {
      'HOME': '/home',
      'ACADEMY': '/academy',
      'DANCER': '/instructor',
      'SAVED': '/schedule',
      'MY': '/my',
    };
    
    const route = routes[view];
    if (route) {
      router.push(route);
    }
  };

  return (
    <PaymentSuccessView 
      myTickets={myTickets}
      onNavigate={handleNavigate}
    />
  );
}

