"use client";

import { ReactNode, useState, useEffect } from 'react';
import { AcademyAdminSidebar } from './academy-admin-sidebar';
import { AcademyAdminHeader } from './academy-admin-header';
import { OnboardingProvider } from '../contexts/onboarding-context';
import { OnboardingOverlay } from './onboarding/onboarding-overlay';

interface AcademyAdminLayoutWrapperProps {
  children: ReactNode;
  academyId: string;
}

export function AcademyAdminLayoutWrapper({ children, academyId }: AcademyAdminLayoutWrapperProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // SSR 시에는 간단한 레이아웃만 렌더링하여 하이드레이션 불일치 방지
  if (!mounted) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex">
        <main className="flex-1 overflow-y-auto w-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 lg:pt-8 sm:pt-20 pt-20">
            {children}
          </div>
        </main>
      </div>
    );
  }

  return (
    <OnboardingProvider>
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex">
        <AcademyAdminSidebar
          academyId={academyId}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex-1 overflow-y-auto w-full">
          <AcademyAdminHeader
            academyId={academyId}
            onMenuClick={() => setSidebarOpen(true)}
          />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 lg:pt-8 sm:pt-20 pt-20">
            {children}
          </div>
        </main>
      </div>
      <OnboardingOverlay />
    </OnboardingProvider>
  );
}

