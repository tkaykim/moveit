"use client";

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DancerDetailView } from '@/components/views/dancer-detail-view';
import { Dancer } from '@/types';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

export default function InstructorDetailPage() {
  const router = useRouter();
  const params = useParams();
  const instructorId = params.id as string;
  const [dancer, setDancer] = useState<Dancer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInstructor = async () => {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        const { data, error } = await (supabase as any)
          .from('instructors')
          .select('*')
          .eq('id', instructorId)
          .single();

        if (error) throw error;

        if (data) {
          const name = data.name_kr || data.name_en || '이름 없음';
          const specialties = data.specialties || '';
          const genre = specialties.split(',')[0]?.trim() || 'ALL';
          const crew = specialties.split(',')[1]?.trim() || '';

          const transformedDancer: Dancer = {
            id: data.id,
            name_kr: data.name_kr,
            name_en: data.name_en,
            bio: data.bio,
            instagram_url: data.instagram_url,
            specialties: data.specialties,
            name,
            crew: crew || undefined,
            genre: genre || undefined,
            followers: undefined,
            img: undefined,
          };

          setDancer(transformedDancer);
        }
      } catch (error) {
        console.error('Error loading instructor:', error);
      } finally {
        setLoading(false);
      }
    };

    if (instructorId) {
      loadInstructor();
    }
  }, [instructorId]);

  const handleBack = () => {
    router.back();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-neutral-500">로딩 중...</div>
      </div>
    );
  }

  if (!dancer) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-neutral-500">강사를 찾을 수 없습니다.</div>
      </div>
    );
  }

  return (
    <DancerDetailView 
      dancer={dancer} 
      onBack={handleBack}
    />
  );
}



