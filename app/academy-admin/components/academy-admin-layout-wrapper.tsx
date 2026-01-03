"use client";

import { ReactNode, useState } from 'react';
import { AcademyAdminSidebar } from './academy-admin-sidebar';
import { AcademyAdminHeader } from './academy-admin-header';

interface AcademyAdminLayoutWrapperProps {
  children: ReactNode;
  academyId: string;
}

export function AcademyAdminLayoutWrapper({ children, academyId }: AcademyAdminLayoutWrapperProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  return (
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 lg:pt-4 sm:pt-4 pt-16">
          {children}
        </div>
      </main>
    </div>
  );
}

