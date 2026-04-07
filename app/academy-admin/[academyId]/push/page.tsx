"use client";

import { PushNotificationView } from '../../components/views/push-notification-view';
import { useAcademy } from '../../contexts/academy-context';

export default function AcademyPushPage() {
  const { academyId } = useAcademy();

  if (!academyId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-neutral-500">학원 정보를 불러올 수 없습니다.</p>
      </div>
    );
  }

  return <PushNotificationView academyId={academyId} />;
}
