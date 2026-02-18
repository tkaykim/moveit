"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { InstructorDashboardView } from '@/components/views/instructor-dashboard-view';

export default function InstructorDashboardPage() {
  const router = useRouter();
  const { user, profile, isInstructor, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/home');
      return;
    }
    if (!isInstructor) {
      router.replace('/home');
    }
  }, [user, loading, isInstructor, router]);

  if (loading || !user || !isInstructor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-black">
        <div className="text-neutral-500 dark:text-neutral-400">
          {loading ? '로딩 중...' : ''}
        </div>
      </div>
    );
  }

  return <InstructorDashboardView />;
}
