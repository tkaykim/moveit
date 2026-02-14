"use client";

import { useRouter } from 'next/navigation';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { useState, useEffect } from 'react';
import { PaymentSuccessView } from '@/components/views/payment-success-view';

export default function PaymentSuccessPage() {
  const router = useRouter();
  const [myTickets, setMyTickets] = useState(0);

  useEffect(() => {
    const loadTickets = async () => {
      try {
        // 수강권 개수 조회
        const response = await fetchWithAuth('/api/user-tickets');
        if (response.ok) {
          const result = await response.json();
          const count = result.counts?.total || 0;
          setMyTickets(count);
        } else {
          setMyTickets(0);
        }
      } catch (error) {
        console.error('Error loading tickets:', error);
        setMyTickets(0);
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

