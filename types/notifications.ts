/**
 * 알림 시스템 관련 TypeScript 타입 정의
 */

// 알림 채널 타입
export type NotificationChannel = 'push' | 'kakao' | 'sms' | 'in_app';

// 알림 상태
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'read';

// 알림 유형
export type NotificationType =
  | 'booking_confirmed'    // 예약 확인
  | 'booking_cancelled'    // 예약 취소
  | 'ticket_purchased'     // 수강권 구매 완료
  | 'ticket_expiry'        // 수강권 만료 임박
  | 'class_reminder'       // 수업 알림
  | 'class_cancelled'      // 수업 취소
  | 'consultation_new'     // 새 상담 접수 (관리자)
  | 'consultation_reply'   // 상담 답변
  | 'extension_approved'   // 연장 승인
  | 'extension_rejected'   // 연장 거절
  | 'system'               // 시스템 알림
  | 'marketing';           // 마케팅 알림

// 플랫폼 타입
export type DevicePlatform = 'android' | 'ios' | 'web';

// 알림 데이터 (DB 테이블 매핑)
export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, any>;
  is_read: boolean;
  channel: NotificationChannel;
  status: NotificationStatus;
  created_at: string;
}

// 디바이스 토큰 (DB 테이블 매핑)
export interface DeviceToken {
  id: string;
  user_id: string;
  token: string;
  platform: DevicePlatform;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 알림 설정 (DB 테이블 매핑)
export interface NotificationPreferences {
  id: string;
  user_id: string;
  push_enabled: boolean;
  kakao_enabled: boolean;
  class_reminder: boolean;
  booking_updates: boolean;
  ticket_updates: boolean;
  marketing: boolean;
  reminder_minutes_before: number;
  created_at: string;
  updated_at: string;
}

// 알림 큐 (DB 테이블 매핑)
export interface NotificationQueueItem {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  data: Record<string, any>;
  template_code: string | null;
  template_data: Record<string, any>;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  retry_count: number;
  max_retries: number;
  scheduled_at: string;
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
}

// API 요청/응답 타입

export interface RegisterDeviceTokenRequest {
  token: string;
  platform: DevicePlatform;
}

export interface UpdatePreferencesRequest {
  push_enabled?: boolean;
  kakao_enabled?: boolean;
  class_reminder?: boolean;
  booking_updates?: boolean;
  ticket_updates?: boolean;
  marketing?: boolean;
  reminder_minutes_before?: number;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total_count: number;
  unread_count: number;
}

// 알림 발송 요청 (내부 서버용)
export interface SendNotificationRequest {
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  channel?: NotificationChannel;
  scheduled_at?: string;
}
