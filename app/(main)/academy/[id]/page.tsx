"use client";

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AcademyDetailView } from '@/components/views/academy-detail-view';
import { Academy, ClassInfo } from '@/types';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

export default function AcademyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const academyId = params.id as string;
  const [academy, setAcademy] = useState<Academy | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAcademy = async () => {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        const { data, error } = await (supabase as any)
          .from('academies')
          .select(`
            *,
            classes (
              *,
              instructors (*),
              halls (*)
            )
          `)
          .eq('id', academyId)
          .single();

        if (error) {
          console.error('Error loading academy:', error);
          throw error;
        }

        if (data) {
          const name = data.name_kr || data.name_en || '이름 없음';
          
          // images는 JSONB 필드이므로 직접 접근
          const images = (data.images && Array.isArray(data.images)) ? data.images : [];
          const sortedImages = images.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
          const imageUrl = sortedImages.length > 0 
            ? sortedImages[0].url 
            : data.logo_url;

          const transformedAcademy: Academy = {
            id: data.id,
            name_kr: data.name_kr,
            name_en: data.name_en,
            tags: data.tags,
            logo_url: data.logo_url,
            name,
            dist: undefined,
            rating: undefined,
            price: undefined,
            badges: [],
            img: imageUrl || undefined,
            academyId: data.id,
            address: data.address,
            section_config: data.section_config || null,
          };

          setAcademy(transformedAcademy);
        } else {
          console.error('No academy data found for id:', academyId);
        }
      } catch (error: any) {
        console.error('Error loading academy:', error);
        // 에러 상세 정보 로깅
        if (error?.message) {
          console.error('Error message:', error.message);
        }
        if (error?.code) {
          console.error('Error code:', error.code);
        }
      } finally {
        setLoading(false);
      }
    };

    if (academyId) {
      loadAcademy();
    }
  }, [academyId]);

  const handleBack = () => {
    router.back();
  };

  const handleClassBook = (classInfo: ClassInfo & { time?: string; price?: number }) => {
    router.push(`/payment?classId=${classInfo.id}&academyId=${academyId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-neutral-500">로딩 중...</div>
      </div>
    );
  }

  if (!academy) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-neutral-500">학원을 찾을 수 없습니다.</div>
      </div>
    );
  }

  return (
    <AcademyDetailView 
      academy={academy} 
      onBack={handleBack}
      onClassBook={handleClassBook}
    />
  );
}

