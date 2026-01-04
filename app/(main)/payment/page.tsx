"use client";

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PaymentView } from '@/components/views/payment-view';
import { Academy, ClassInfo } from '@/types';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const classId = searchParams.get('classId');
  const academyId = searchParams.get('academyId');
  const [academy, setAcademy] = useState<Academy | null>(null);
  const [classInfo, setClassInfo] = useState<(ClassInfo & { time?: string; price?: number }) | null>(null);
  const [myTickets, setMyTickets] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        // 인증 기능 제거로 인해 티켓 수를 0으로 설정
        setMyTickets(0);

        // 학원 정보 로드
        if (academyId) {
          const { data: academyData, error: academyError } = await (supabase as any)
            .from('academies')
            .select('*')
            .eq('id', academyId)
            .single();

          if (!academyError && academyData) {
            const name = academyData.name_kr || academyData.name_en || '이름 없음';
            setAcademy({
              id: academyData.id,
              name_kr: academyData.name_kr,
              name_en: academyData.name_en,
              tags: academyData.tags,
              logo_url: academyData.logo_url,
              name,
              address: academyData.address,
            });
          }
        }

        // 클래스 정보 로드
        if (classId) {
          const { data: classData, error: classError } = await (supabase as any)
            .from('classes')
            .select(`
              *,
              instructors (*),
              halls (*),
              academies (*)
            `)
            .eq('id', classId)
            .single();

          if (!classError && classData) {
            const instructor = classData.instructors?.name_kr || classData.instructors?.name_en || '강사 정보 없음';
            const genre = classData.genre || 'ALL';
            const level = classData.difficulty_level || 'All Level';
            
            setClassInfo({
              id: classData.id,
              schedule_id: classData.schedule_id || '',
              instructor,
              genre,
              level,
              status: 'AVAILABLE',
              price: classData.price || 0,
              class_title: classData.class_title,
              hall_name: classData.halls?.name,
              academy: classData.academies ? {
                id: classData.academies.id,
                name: classData.academies.name_kr || classData.academies.name_en || '학원 정보 없음',
                address: classData.academies.address,
              } : undefined,
            });
          }
        }
      } catch (error) {
        console.error('Error loading payment data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [classId, academyId]);

  const handleBack = () => {
    router.back();
  };

  const handlePayment = () => {
    setTimeout(() => {
      setMyTickets(prev => prev - 1);
      router.push('/payment/success');
    }, 1500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-neutral-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <PaymentView 
      academy={academy}
      classInfo={classInfo}
      myTickets={myTickets}
      onBack={handleBack}
      onPayment={handlePayment}
    />
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-neutral-500">로딩 중...</div></div>}>
      <PaymentContent />
    </Suspense>
  );
}

