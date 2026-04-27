"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DancerListView } from '@/components/views/dancer-list-view';
import { Dancer } from '@/types';

// B-4 (2026-04-27): 단일학원 모드에서 공개 강사 리스트 차단. /instructor/[id] 상세는 보존.
const HIDE_PUBLIC = process.env.NEXT_PUBLIC_HIDE_PUBLIC_ACADEMIES !== 'false';

export default function InstructorPage() {
  const router = useRouter();

  useEffect(() => {
    if (HIDE_PUBLIC) {
      router.replace('/home');
    }
  }, [router]);

  if (HIDE_PUBLIC) return null;

  const handleDancerClick = (dancer: Dancer) => {
    router.push(`/instructor/${dancer.id}`);
  };

  return <DancerListView onDancerClick={handleDancerClick} />;
}
