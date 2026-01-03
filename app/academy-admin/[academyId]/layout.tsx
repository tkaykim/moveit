import { ReactNode } from 'react';
import { AcademyAdminSidebar } from '../components/academy-admin-sidebar';
import { AcademyAdminHeader } from '../components/academy-admin-header';

export default async function AcademyAdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ academyId: string }>;
}) {
  const { academyId } = await params;
  
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-neutral-950 font-sans text-gray-900 dark:text-gray-100">
      <AcademyAdminSidebar academyId={academyId} />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <AcademyAdminHeader academyId={academyId} />
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto pb-10">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

