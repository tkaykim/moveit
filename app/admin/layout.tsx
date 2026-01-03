import { ReactNode } from 'react';
import { AdminSidebar } from './components/admin-sidebar';

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  // 인증 및 권한 체크 제거 - 로그인 강제하지 않음

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
