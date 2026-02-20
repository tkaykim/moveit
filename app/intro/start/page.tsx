'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { authFetch } from '@/lib/supabase/auth-fetch';
import { MyTab } from '@/components/auth/MyTab';
import type { BillingPlanId, BillingCycle } from '@/types/billing';

interface AcademyOption {
  id: string;
  name_kr: string | null;
  name_en: string | null;
}

export default function IntroStartPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const planId = (searchParams?.get('planId') ?? 'starter') as BillingPlanId;
  const cycle = (searchParams?.get('cycle') ?? 'monthly') as BillingCycle;

  const [academies, setAcademies] = useState<AcademyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAcademyId, setSelectedAcademyId] = useState('');
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const loadAcademies = useCallback(async () => {
    if (!user) {
      setAcademies([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch('/api/me/academies');
      if (res.ok) {
        const data = await res.json();
        setAcademies(data?.academies ?? []);
        if (data?.academies?.length === 1) {
          setSelectedAcademyId(data.academies[0].id);
        } else if (data?.academies?.length > 0 && !selectedAcademyId) {
          setSelectedAcademyId(data.academies[0].id);
        }
      } else {
        setAcademies([]);
      }
    } catch {
      setAcademies([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    loadAcademies();
  }, [user, authLoading, loadAcademies]);

  const handleGoToBilling = () => {
    if (!selectedAcademyId) return;
    const params = new URLSearchParams();
    if (planId) params.set('planId', planId);
    if (cycle) params.set('cycle', cycle);
    const q = params.toString();
    router.push(`/academy-admin/${selectedAcademyId}/billing${q ? `?${q}` : ''}`);
  };

  if (authLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <p className="text-neutral-500 dark:text-neutral-400">확인 중...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center px-4 py-12 relative">
        <Link href="/intro#pricing" className="absolute top-4 left-4 text-sm text-neutral-500 dark:text-neutral-400 hover:underline">
          ← 요금제로 돌아가기
        </Link>
        <div className="max-w-md w-full text-center space-y-6">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
            구독을 시작하려면 로그인하세요
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 text-sm">
            로그인 또는 회원가입 후, 학원을 개설하고 체험한 뒤 구독 플랜을 선택해 결제할 수 있습니다.
          </p>
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="w-full py-3 rounded-xl font-bold bg-neutral-900 dark:bg-[#CCFF00] text-white dark:text-black hover:opacity-90"
          >
            로그인 / 회원가입
          </button>
          <Link
            href="/intro#contact"
            className="block text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
          >
            도입 문의하기
          </Link>
        </div>
        <MyTab
          isOpen={authModalOpen}
          onClose={() => {
            setAuthModalOpen(false);
            if (user) loadAcademies();
          }}
        />
      </div>
    );
  }

  const setupAcademyUrl = `/intro/setup-academy${planId || cycle ? `?${new URLSearchParams({ ...(planId && { planId }), ...(cycle && { cycle }) }).toString()}` : ''}`;

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center px-4 py-12 relative">
      <Link href="/intro#pricing" className="absolute top-4 left-4 text-sm text-neutral-500 dark:text-neutral-400 hover:underline">
        ← 요금제로 돌아가기
      </Link>
      <div className="max-w-md w-full space-y-6">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white text-center">
          {academies.length === 0 && !loading
            ? '먼저 학원을 개설하세요'
            : 'MOVEIT 플랫폼 구독을 진행할 학원을 선택하세요'}
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 text-sm text-center">
          {academies.length === 0 && !loading
            ? '관리 중인 학원이 없습니다. 기본 정보를 입력해 학원을 개설한 뒤, 학원 관리 페이지에서 기능을 체험하고 구독 플랜을 선택해 결제할 수 있습니다.'
            : '관리 권한이 있는 학원 중 하나를 선택해 주세요.'}
        </p>

        {loading ? (
          <p className="text-neutral-500 dark:text-neutral-400 text-center">학원 목록을 불러오는 중...</p>
        ) : academies.length === 0 ? (
          <div className="text-center space-y-4">
            <Link
              href={setupAcademyUrl}
              className="inline-block w-full py-3 px-6 rounded-xl font-bold bg-neutral-900 dark:bg-[#CCFF00] text-white dark:text-black hover:opacity-90"
            >
              내 학원 생성하기
            </Link>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              학원 개설 → 학원 관리 페이지 체험 → 구독 플랜 선택 및 카드 등록·결제 순서로 진행됩니다.
            </p>
            <Link
              href="/intro#contact"
              className="block text-sm text-neutral-500 dark:text-neutral-400 hover:underline mt-2"
            >
              도입 문의하기
            </Link>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                플랫폼 구독을 신청할 학원
              </label>
              <select
                value={selectedAcademyId}
                onChange={(e) => setSelectedAcademyId(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white px-3 py-2.5"
              >
                {academies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name_kr || a.name_en || a.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
              선택한 요금제: {planId} · {cycle === 'annual' ? '연간' : '월간'}
            </p>
            <button
              type="button"
              onClick={handleGoToBilling}
              disabled={!selectedAcademyId}
              className="w-full py-3 rounded-xl font-bold bg-neutral-900 dark:bg-[#CCFF00] text-white dark:text-black hover:opacity-90 disabled:opacity-50"
            >
              플랫폼 구독·결제 진행
            </button>
          </>
        )}
      </div>
    </div>
  );
}
