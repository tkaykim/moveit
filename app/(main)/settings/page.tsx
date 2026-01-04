"use client";

import { useRouter } from 'next/navigation';
import { SettingsView } from '@/components/views/settings-view';

export default function SettingsPage() {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  return <SettingsView onBack={handleBack} />;
}


