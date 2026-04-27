"use client";

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchResultsView } from '@/components/views/search-results-view';
import { Academy, Dancer } from '@/types';

// B-4 (2026-04-27): 단일학원 모드에서 통합 검색은 차단. flag OFF 시 즉시 복원.
const HIDE_PUBLIC = process.env.NEXT_PUBLIC_HIDE_PUBLIC_ACADEMIES !== 'false';

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  useEffect(() => {
    if (HIDE_PUBLIC) {
      router.replace('/home');
    }
  }, [router]);

  if (HIDE_PUBLIC) return null;

  const handleBack = () => {
    router.back();
  };

  const handleAcademyClick = (academy: Academy) => {
    router.push(`/academy/${academy.slug || academy.id}`);
  };

  const handleDancerClick = (dancer: Dancer) => {
    router.push(`/instructor/${dancer.id}`);
  };

  return (
    <SearchResultsView
      query={query}
      onBack={handleBack}
      onAcademyClick={handleAcademyClick}
      onDancerClick={handleDancerClick}
    />
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-neutral-500">로딩 중...</div></div>}>
      <SearchContent />
    </Suspense>
  );
}
