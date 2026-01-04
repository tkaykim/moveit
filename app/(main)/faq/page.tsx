"use client";

import { useRouter } from 'next/navigation';
import { FAQView } from '@/components/views/faq-view';

export default function FAQPage() {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  return <FAQView onBack={handleBack} />;
}


