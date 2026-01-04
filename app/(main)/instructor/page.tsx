"use client";

import { useRouter } from 'next/navigation';
import { DancerListView } from '@/components/views/dancer-list-view';
import { Dancer } from '@/types';

export default function InstructorPage() {
  const router = useRouter();

  const handleDancerClick = (dancer: Dancer) => {
    router.push(`/instructor/${dancer.id}`);
  };

  return <DancerListView onDancerClick={handleDancerClick} />;
}


