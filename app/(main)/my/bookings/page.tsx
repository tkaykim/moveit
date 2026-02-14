"use client";

import { useRouter } from "next/navigation";
import { MyBookingsView } from "@/components/views/my-bookings-view";

export default function MyBookingsPage() {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  return <MyBookingsView onBack={handleBack} />;
}
