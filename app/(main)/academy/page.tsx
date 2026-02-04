"use client";

import { useRouter } from "next/navigation";
import { AcademyMapView } from "@/components/views/academy-map-view";
import { Academy } from "@/types";

export default function AcademyPage() {
  const router = useRouter();

  const handleAcademyClick = (academy: Academy) => {
    router.push(`/academy/${academy.id}`);
  };

  return <AcademyMapView onAcademyClick={handleAcademyClick} />;
}





