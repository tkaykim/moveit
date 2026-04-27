"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AcademyListView } from "@/components/views/academy-list-view";
import { Academy } from "@/types";

// B-4 (2026-04-27): 단일학원 모드에서 공개 학원 리스트는 차단. /academy/[id] 상세는 직접 URL 보존.
const HIDE_PUBLIC = process.env.NEXT_PUBLIC_HIDE_PUBLIC_ACADEMIES !== 'false';

export default function AcademyPage() {
  const router = useRouter();

  useEffect(() => {
    if (HIDE_PUBLIC) {
      router.replace('/home');
    }
  }, [router]);

  if (HIDE_PUBLIC) return null;

  const handleAcademyClick = (academy: Academy) => {
    router.push(`/academy/${academy.slug || academy.id}`);
  };

  return <AcademyListView onAcademyClick={handleAcademyClick} />;
}
