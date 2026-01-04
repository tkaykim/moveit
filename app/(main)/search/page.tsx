"use client";

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchResultsView } from '@/components/views/search-results-view';
import { Academy, Dancer } from '@/types';

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const handleBack = () => {
    router.back();
  };

  const handleAcademyClick = (academy: Academy) => {
    router.push(`/academy/${academy.id}`);
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

