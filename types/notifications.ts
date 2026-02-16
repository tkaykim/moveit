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
  | 'class_reminder'       // 수업 당일 알림
  | 'class_cancelled'      // 수업 취소
  | 'attendance_checked'   // 출석 확인 (본인/학부모)
  | 'attendance_absent'    // 결석 알림 (학부모)
  | 'video_uploaded'       // 수업 영상 등록
  | 'consultation_new'     // 새 상담 접수 (관리자)
  | 'consultation_reply'   // 상담 답변
  | 'extension_approved'   // 연장 승인
  | 'extension_rejected'   // 연장 거절
  | 'system'               // 시스템 알림
  | 'marketing';           // 마케팅 알림

// 알림 유형별 카테고리 매핑
export const NOTIFICATION_CATEGORIES = {
  class_updates: {
    label: '수업 알림',
    description: '수업 당일 알림, 수업 취소 알림',
    types: ['class_reminder', 'class_cancelled'] as NotificationType[],
  },
  booking_updates: {
    label: '예약 알림',
    description: '예약 확인, 취소 알림',
    types: ['booking_confirmed', 'booking_cancelled'] as NotificationType[],
  },
  attendance_updates: {
    label: '출석 알림',
    description: '출석 확인, 결석 알림 (본인/학부모)',
    types: ['attendance_checked', 'attendance_absent'] as NotificationType[],
  },
  ticket_updates: {
    label: '수강권 알림',
    description: '수강권 구매, 만료 임박, 연장 알림',
    types: ['ticket_purchased', 'ticket_expiry', 'extension_approved', 'extension_rejected'] as NotificationType[],
  },
  content_updates: {
    label: '콘텐츠 알림',
    description: '수업 영상 등록 알림',
    types: ['video_uploaded'] as NotificationType[],
  },
  consultation_updates: {
    label: '상담 알림',
    description: '상담 답변 알림',
    types: ['consultation_reply'] as NotificationType[],
  },
  marketing: {
    label: '마케팅/이벤트',
    description: '프로모션, 이벤트, 할인 알림',
    types: ['marketing'] as NotificationType[],
  },
} as const;

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
  attendance_updates: boolean;
  ticket_updates: boolean;
  content_updates: boolean;
  consultation_updates: boolean;
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
  attendance_updates?: boolean;
  ticket_updates?: boolean;
  content_updates?: boolean;
  consultation_updates?: boolean;
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
  academy_id?: string; // 학원별 알림 설정을 확인하기 위해 추가
}

// 학원별 알림 설정 (DB 테이블 매핑)
export interface AcademyNotificationSettings {
  id: string;
  academy_id: string;
  booking_confirmed: boolean;
  booking_cancelled: boolean;
  class_reminder: boolean;
  class_cancelled: boolean;
  attendance_checked: boolean;
  attendance_absent: boolean;
  ticket_purchased: boolean;
  ticket_expiry: boolean;
  video_uploaded: boolean;
  consultation_reply: boolean;
  marketing: boolean;
  created_at: string;
  updated_at: string;
}
