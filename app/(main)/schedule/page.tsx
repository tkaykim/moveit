"use client";

import { useRouter } from 'next/navigation';
import { CalendarView } from '@/components/views/calendar-view';
import { Academy, ClassInfo } from '@/types';

export default function SchedulePage() {
  const router = useRouter();

  const handleAcademyClick = (academy: Academy) => {
    router.push(`/academy/${academy.id}`);
  };

  const handleClassBook = (classInfo: ClassInfo & { time?: string; price?: number }) => {
    router.push(`/payment?classId=${classInfo.id}`);
  };

  return (
    <CalendarView 
      onAcademyClick={handleAcademyClick}
      onClassBook={handleClassBook}
    />
  );
}





