'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { authFetch } from '@/lib/supabase/auth-fetch';
import { AcademySetupForm, type AcademySetupFormData } from './components/academy-setup-form';

export default function SetupAcademyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const planId = searchParams?.get('planId') ?? '';
  const cycle = searchParams?.get('cycle') ?? '';

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/intro/start');
      return;
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (data: AcademySetupFormData) => {
    setIsSubmitting(true);
    try {
      const res = await authFetch('/api/me/academies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name_kr: data.name_kr.trim(),
          name_en: data.name_en.trim() || undefined,
          address: data.address.trim() || undefined,
          contact_number: data.contact_number.trim() || undefined,
          hall_name: data.hall_name.trim() || undefined,
          hall_capacity: data.hall_capacity,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? '학원 개설에 실패했습니다.');
      }
      const academyId = json?.academyId;
      if (academyId) {
        const params = new URLSearchParams();
        params.set('subscription', 'start');
        if (planId) params.set('planId', planId);
        if (cycle) params.set('cycle', cycle);
        router.push(`/academy-admin/${academyId}?${params.toString()}`);
      } else {
        throw new Error('학원 ID를 받지 못했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <p className="text-neutral-500 dark:text-neutral-400">확인 중...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-[50vh] flex flex-col items-center px-4 py-12 relative">
      <Link
        href="/intro/start"
        className="absolute top-4 left-4 text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← 구독 시작으로 돌아가기
      </Link>
      <div className="max-w-md w-full">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white text-center mb-2">
          학원 생성
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 text-sm text-center mb-6">
          학원 정보를 입력하고 학원을 생성하세요. 생성 후 학원 관리자 페이지에서 기능을 체험하고, 구독 플랜을 선택해 결제할 수 있습니다.
        </p>
        <AcademySetupForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
      </div>
    </div>
  );
}
