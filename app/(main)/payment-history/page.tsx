"use client";

import { useRouter } from 'next/navigation';
import { PaymentHistoryView } from '@/components/views/payment-history-view';

export default function PaymentHistoryPage() {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  return <PaymentHistoryView onBack={handleBack} />;
}





