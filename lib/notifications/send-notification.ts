/**
 * 알림 발송 유틸리티 (서버 사이드 전용)
 * 알림 큐에 삽입하고, notifications 테이블에도 기록
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { SendNotificationRequest, NotificationType, NotificationChannel } from '@/types/notifications';

/**
 * 단일 사용자에게 알림 발송
 * notification_queue에 삽입하면 Edge Function 워커가 실제 푸시 발송 처리
 */
export async function sendNotification(req: SendNotificationRequest) {
  const supabase = createServiceClient();
  const channel = req.channel || 'push';

  // 1. 사용자의 알림 설정 확인
  const { data: prefs } = await (supabase as any)
    .from('notification_preferences')
    .select('*')
    .eq('user_id', req.user_id)
    .single();

  // 1.5. 학원별 알림 설정 확인 (academy_id가 있는 경우)
  if (req.academy_id) {
    const { data: academySettings } = await (supabase as any)
      .from('academy_notification_settings')
      .select('*')
      .eq('academy_id', req.academy_id)
      .single();

    if (academySettings) {
      // 해당 알림 타입에 대한 설정이 false이면 발송 중단
      // req.type이 academySettings의 키와 일치한다고 가정
      const settingKey = req.type;
      // academySettings에 해당 키가 존재하고, 값이 false인 경우
      if (settingKey in academySettings && academySettings[settingKey] === false) {
        return null;
      }
    }
  }

  // 알림 설정에 따라 발송 여부 결정
  if (prefs) {
    if (channel === 'push' && !prefs.push_enabled) return null;
    if (channel === 'kakao' && !prefs.kakao_enabled) return null;
    if (isReminderType(req.type) && !prefs.class_reminder) return null;
    if (isBookingType(req.type) && !prefs.booking_updates) return null;
    if (isAttendanceType(req.type) && !prefs.attendance_updates) return null;
    if (isTicketType(req.type) && !prefs.ticket_updates) return null;
    if (isContentType(req.type) && !prefs.content_updates) return null;
    if (isConsultationType(req.type) && !prefs.consultation_updates) return null;
    if (req.type === 'marketing' && !prefs.marketing) return null;
  }

  // 2. notifications 테이블에 인앱 알림 기록
  const { data: notification, error: notifError } = await (supabase as any)
    .from('notifications')
    .insert({
      user_id: req.user_id,
      type: req.type,
      title: req.title,
      body: req.body,
      data: req.data || {},
      channel,
      status: 'sent',
    })
    .select()
    .single();

  if (notifError) {
    console.error('[sendNotification] 알림 기록 실패:', notifError);
  }

  // 3. 푸시 채널인 경우 큐에 삽입 (Edge Function이 처리)
  // 표시 규칙: 큰 제목 = MOVE.IT, 작은 제목 = 학원명(특정 학원 발송 시), 나머지 = 내용
  if (channel === 'push') {
    const academyName = req.data?.academy_name as string | undefined;
    const displayTitle = 'MOVE.IT';
    const displayBody = academyName
      ? `${academyName}\n\n${req.title}\n${req.body}`
      : `${req.title}\n${req.body}`;

    const { error: queueError } = await (supabase as any)
      .from('notification_queue')
      .insert({
        user_id: req.user_id,
        notification_type: req.type,
        channel: 'push',
        title: displayTitle,
        body: displayBody,
        data: req.data || {},
        scheduled_at: req.scheduled_at || new Date().toISOString(),
      });

    if (queueError) {
      console.error('[sendNotification] 큐 삽입 실패:', queueError);
    }
  }

  return notification;
}

/**
 * 여러 사용자에게 동일한 알림 발송
 */
export async function sendBulkNotification(
  userIds: string[],
  notification: Omit<SendNotificationRequest, 'user_id'>
) {
  const results = await Promise.allSettled(
    userIds.map((userId) =>
      sendNotification({ ...notification, user_id: userId })
    )
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  return { sent, failed, total: userIds.length };
}

// 알림 유형별 카테고리 판별 헬퍼
function isReminderType(type: NotificationType): boolean {
  return ['class_reminder', 'class_cancelled'].includes(type);
}

function isBookingType(type: NotificationType): boolean {
  return ['booking_confirmed', 'booking_cancelled'].includes(type);
}

function isAttendanceType(type: NotificationType): boolean {
  return ['attendance_checked', 'attendance_absent'].includes(type);
}

function isTicketType(type: NotificationType): boolean {
  return ['ticket_purchased', 'ticket_expiry', 'extension_approved', 'extension_rejected'].includes(type);
}

function isContentType(type: NotificationType): boolean {
  return type === 'video_uploaded';
}

function isConsultationType(type: NotificationType): boolean {
  return ['consultation_new', 'consultation_reply'].includes(type);
}
