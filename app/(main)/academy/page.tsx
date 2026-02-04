"use client";

import { useRouter } from "next/navigation";
import { AcademyListView } from "@/components/views/academy-list-view";
import { Academy } from "@/types";

export default function AcademyPage() {
  const router = useRouter();

  const handleAcademyClick = (academy: Academy) => {
    router.push(`/academy/${academy.id}`);
  };

  return <AcademyListView onAcademyClick={handleAcademyClick} />;
}





