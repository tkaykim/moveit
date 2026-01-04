"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HomeView } from '@/components/views/home-view';
import { Academy, Dancer } from '@/types';

export default function HomePage() {
  const router = useRouter();

  const handleNavigate = (view: string, query?: string) => {
    const routes: Record<string, string> = {
      'ACADEMY': '/academy',
      'DANCER': '/instructor',
      'SAVED': '/schedule',
      'MY': '/my',
      'SEARCH_RESULTS': `/search?q=${encodeURIComponent(query || '')}`,
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
    <HomeView 
      onNavigate={handleNavigate} 
      onAcademyClick={handleAcademyClick}
      onDancerClick={handleDancerClick}
    />
  );
}


