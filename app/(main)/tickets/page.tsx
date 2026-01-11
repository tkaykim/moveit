"use client";

import { useRouter } from 'next/navigation';
import { TicketsView } from '@/components/views/tickets-view';

export default function TicketsPage() {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  return <TicketsView onBack={handleBack} />;
}





