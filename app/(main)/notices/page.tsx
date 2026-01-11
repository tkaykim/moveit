"use client";

import { useRouter } from 'next/navigation';
import { NoticesView } from '@/components/views/notices-view';

export default function NoticesPage() {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  return <NoticesView onBack={handleBack} />;
}





