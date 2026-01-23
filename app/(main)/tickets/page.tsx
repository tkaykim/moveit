"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { TicketsView } from '@/components/views/tickets-view';
import { Suspense } from 'react';

function TicketsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const academyId = searchParams.get('academyId') || undefined;
  const classId = searchParams.get('classId') || undefined;

  const handleBack = () => {
    router.back();
  };

  return <TicketsView onBack={handleBack} academyId={academyId} classId={classId} />;
}

export default function TicketsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
        <div className="text-neutral-500">로딩 중...</div>
      </div>
    }>
      <TicketsPageContent />
    </Suspense>
  );
}





