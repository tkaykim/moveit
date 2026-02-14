export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/**
 * 수강권, 쿠폰, 할인정책 개념 정리:
 * 
 * 1. 수강권 (Ticket) - tickets 테이블 (is_coupon = false)
 *    - 정규수업을 들을 수 있는 권한
 *    - 유형: 횟수권(COUNT), 기간권(PERIOD)
 *    - user_tickets 테이블에서 사용자 보유 수강권 관리
 * 
 * 2. 쿠폰 - tickets 테이블 (is_coupon = true)
 *    - 쿠폰제 수업(1회성 수업)을 들을 수 있는 권한
 *    - 1회 수강 가능한 티켓
 *    - user_tickets 테이블에서 동일하게 관리
 * 
 * 3. 할인정책 (Discount) - discounts 테이블
 *    - 상품(수강권/쿠폰) 구매 시 할인 적용
 *    - 유형: 정률(PERCENT), 정액(FIXED)
 *    - 수강권/쿠폰과는 별개의 시스템
 */

// 학원 상세 페이지 섹션 설정 타입
export interface SectionConfigItem {
  id: string;        // 섹션 식별자 (기본: 'info', 'schedule' 등 / 커스텀: 'custom_xxx')
  visible: boolean;  // 표시 여부
  order: number;     // 정렬 순서
  // 커스텀 섹션 전용 필드
  isCustom?: boolean;                     // 커스텀 섹션 여부
  type?: 'image' | 'text' | 'video';     // 커스텀 섹션 타입
  title?: string;                         // 커스텀 섹션 제목
  content?: string;                       // 텍스트 내용 (type: 'text')
  media_url?: string;                     // 이미지/영상 URL (type: 'image' | 'video')
  link_url?: string;                      // 클릭 시 이동할 URL
}

// 기본(빌트인) 섹션 ID 목록
export const BUILTIN_SECTION_IDS = ['info', 'consultation', 'tags', 'recent_videos', 'schedule', 'reviews'];

// 플랫 구조: 모든 섹션을 하나의 리스트로 관리
export interface SectionConfig {
  sections: SectionConfigItem[];
}

// 기본 섹션 설정 (section_config가 null일 때 사용)
export const DEFAULT_SECTION_CONFIG: SectionConfig = {
  sections: [
    { id: 'info', visible: true, order: 0 },
    { id: 'consultation', visible: true, order: 1 },
    { id: 'tags', visible: true, order: 2 },
    { id: 'recent_videos', visible: true, order: 3 },
    { id: 'schedule', visible: true, order: 4 },
    { id: 'reviews', visible: true, order: 5 },
  ],
};

// 섹션 ID → 한국어 라벨
export const SECTION_LABELS: Record<string, string> = {
  info: '학원 소개',
  consultation: '상담 신청 버튼',
  tags: '태그',
  recent_videos: '최근 수업 영상',
  schedule: '시간표',
  reviews: '리뷰',
};

// 섹션 ID → 관리자용 설명
export const SECTION_DESCRIPTIONS: Record<string, string> = {
  info: '학원 이름, 소개글 등 기본 정보를 보여줍니다',
  consultation: '방문자가 상담을 신청할 수 있는 버튼입니다',
  tags: '학원에 등록된 장르·특징 태그를 보여줍니다',
  recent_videos: '최근 등록된 수업 영상 목록을 보여줍니다',
  schedule: '주간/월간 수업 시간표와 수강권 구매 버튼을 보여줍니다',
  reviews: '수강생 리뷰 영역입니다 (준비 중)',
};

// 커스텀 섹션 타입 라벨
export const CUSTOM_SECTION_TYPE_LABELS: Record<string, string> = {
  image: '이미지',
  text: '글',
  video: '영상',
};

// 레거시 호환: 기존 tabs/homeSections 구조를 flat sections로 변환
export function migrateSectionConfig(raw: any): SectionConfig {
  // 이미 새 형식이면 그대로 반환
  if (raw?.sections && Array.isArray(raw.sections)) {
    return { sections: raw.sections };
  }
  // 기존 tabs + homeSections 형식 → flat sections 변환
  if (raw?.tabs || raw?.homeSections) {
    const homeSections = (raw.homeSections || []) as SectionConfigItem[];
    const tabs = (raw.tabs || []) as SectionConfigItem[];
    const sections: SectionConfigItem[] = [];
    let order = 0;
    // 홈 탭 내 섹션들 먼저 (home 탭이 보이는 경우)
    const homeTab = tabs.find((t: any) => t.id === 'home');
    const homeVisible = homeTab ? homeTab.visible : true;
    for (const hs of homeSections.sort((a, b) => a.order - b.order)) {
      sections.push({ id: hs.id, visible: homeVisible && hs.visible, order: order++ });
    }
    // schedule, reviews 등 나머지 탭
    for (const tab of tabs.sort((a, b) => a.order - b.order)) {
      if (tab.id === 'home') continue; // 이미 위에서 처리
      sections.push({ id: tab.id, visible: tab.visible, order: order++ });
    }
    return { sections };
  }
  return JSON.parse(JSON.stringify(DEFAULT_SECTION_CONFIG));
}

// 클래스 접근 제어 설정 타입
export interface AccessConfig {
  requiredGroup?: string | null;  // 필수 수강권 그룹 (null이면 제한 없음)
  allowRegularTicket?: boolean;   // 정규 수강권으로 수업 참여 가능 여부
  allowCoupon?: boolean;          // 쿠폰(레거시)으로 수업 참여 가능 여부
  allowPopup?: boolean;           // 팝업 수강권으로 수업 참여 가능 여부
  allowWorkshop?: boolean;        // 워크샵 수강권으로 수업 참여 가능 여부
}

// 정규 수강생 할인 설정 타입 (레거시 - 하위 호환용)
export interface DiscountConfig {
  enabled: boolean;              // 할인 활성화 여부
  target_class_ids: string[];    // 할인 대상 정규 클래스 ID 목록
  discount_amount: number;       // 할인 금액
}

// 무료 수강 가능 설정 타입 (팝업 클래스용)
// 특정 정규 수업반 수강권 보유자가 무료로 수강 가능
export interface FreeAccessConfig {
  enabled: boolean;              // 무료 수강 활성화 여부
  target_class_ids: string[];    // 무료 수강 가능한 정규 클래스 ID 목록 (이 클래스 수강권 보유시 무료)
}

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      academies: {
        Row: {
          address: string | null
          contact_number: string | null
          created_at: string | null
          description: string | null
          id: string
          images: Json | null
          instagram_handle: string | null
          is_active: boolean | null
          logo_url: string | null
          name_en: string | null
          name_kr: string | null
          other_url: string | null
          kakao_channel_url: string | null
          naver_map_url: string | null
          tags: string | null
          tiktok_handle: string | null
          website_url: string | null
          youtube_url: string | null
          max_extension_days: number | null
          consultation_availability: Json | null
          section_config: Json | null
        }
        Insert: {
          address?: string | null
          contact_number?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          images?: Json | null
          instagram_handle?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name_en?: string | null
          name_kr?: string | null
          other_url?: string | null
          kakao_channel_url?: string | null
          naver_map_url?: string | null
          tags?: string | null
          tiktok_handle?: string | null
          website_url?: string | null
          youtube_url?: string | null
          max_extension_days?: number | null
          consultation_availability?: Json | null
          section_config?: Json | null
        }
        Update: {
          address?: string | null
          contact_number?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          images?: Json | null
          instagram_handle?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name_en?: string | null
          name_kr?: string | null
          other_url?: string | null
          kakao_channel_url?: string | null
          naver_map_url?: string | null
          tags?: string | null
          tiktok_handle?: string | null
          website_url?: string | null
          youtube_url?: string | null
          max_extension_days?: number | null
          consultation_availability?: Json | null
          section_config?: Json | null
        }
        Relationships: []
      }
      banners: {
        Row: {
          id: string
          title: string
          image_url: string
          link_url: string | null
          display_order: number
          is_active: boolean
          starts_at: string | null
          ends_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          title: string
          image_url: string
          link_url?: string | null
          display_order?: number
          is_active?: boolean
          starts_at?: string | null
          ends_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          image_url?: string
          link_url?: string | null
          display_order?: number
          is_active?: boolean
          starts_at?: string | null
          ends_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      banner_settings: {
        Row: {
          id: string
          auto_slide_interval: number
          is_auto_slide_enabled: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          auto_slide_interval?: number
          is_auto_slide_enabled?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          auto_slide_interval?: number
          is_auto_slide_enabled?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      academy_favorites: {
        Row: {
          academy_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          academy_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          academy_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_favorites_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_instructors: {
        Row: {
          academy_id: string
          created_at: string | null
          id: string
          instructor_id: string
          is_active: boolean | null
          memo: string | null
        }
        Insert: {
          academy_id: string
          created_at?: string | null
          id?: string
          instructor_id: string
          is_active?: boolean | null
          memo?: string | null
        }
        Update: {
          academy_id?: string
          created_at?: string | null
          id?: string
          instructor_id?: string
          is_active?: boolean | null
          memo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_instructors_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_instructors_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_students: {
        Row: {
          academy_id: string
          created_at: string | null
          id: string
          interested_genres: string[] | null
          level: string | null
          referral_source: string | null
          user_id: string
        }
        Insert: {
          academy_id: string
          created_at?: string | null
          id?: string
          interested_genres?: string[] | null
          level?: string | null
          referral_source?: string | null
          user_id: string
        }
        Update: {
          academy_id?: string
          created_at?: string | null
          id?: string
          interested_genres?: string[] | null
          level?: string | null
          referral_source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_students_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_students_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_user_roles: {
        Row: {
          academy_id: string
          created_at: string | null
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          academy_id: string
          created_at?: string | null
          id?: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          academy_id?: string
          created_at?: string | null
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_user_roles_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          class_id: string | null
          created_at: string | null
          hall_id: string | null
          id: string
          schedule_id: string | null
          status: string | null
          user_id: string | null
          user_ticket_id: string | null
          guest_name: string | null
          guest_phone: string | null
          payment_status: string | null
          is_admin_added: boolean | null
          admin_note: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          hall_id?: string | null
          id?: string
          schedule_id?: string | null
          status?: string | null
          user_id?: string | null
          user_ticket_id?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          payment_status?: string | null
          is_admin_added?: boolean | null
          admin_note?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          hall_id?: string | null
          id?: string
          schedule_id?: string | null
          status?: string | null
          user_id?: string | null
          user_ticket_id?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          payment_status?: string | null
          is_admin_added?: boolean | null
          admin_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_hall_id_fkey"
            columns: ["hall_id"]
            isOneToOne: false
            referencedRelation: "halls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_ticket_id_fkey"
            columns: ["user_ticket_id"]
            isOneToOne: false
            referencedRelation: "user_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          academy_id: string
          access_config: AccessConfig | null
          additional_salary_per_student: number | null
          base_salary: number
          base_student_count: number | null
          class_type: string | null
          created_at: string | null
          current_students: number | null
          description: string | null
          difficulty_level: string | null
          end_time: string | null
          genre: string | null
          hall_id: string | null
          id: string
          instructor_id: string | null
          is_active: boolean | null
          is_canceled: boolean | null
          max_students: number | null
          present_students: number | null
          price: number | null
          discount_config: DiscountConfig | null
          free_access_config: FreeAccessConfig | null
          poster_url: string | null
          song: string | null
          start_time: string | null
          status: string | null
          thumbnail_url: string | null
          title: string | null
          video_url: string | null
        }
        Insert: {
          academy_id: string
          access_config?: AccessConfig | null
          discount_config?: DiscountConfig | null
          free_access_config?: FreeAccessConfig | null
          additional_salary_per_student?: number | null
          base_salary?: number
          base_student_count?: number | null
          class_type?: string | null
          created_at?: string | null
          current_students?: number | null
          description?: string | null
          difficulty_level?: string | null
          end_time?: string | null
          genre?: string | null
          hall_id?: string | null
          id?: string
          instructor_id?: string | null
          is_active?: boolean | null
          is_canceled?: boolean | null
          max_students?: number | null
          poster_url?: string | null
          present_students?: number | null
          price?: number | null
          song?: string | null
          start_time?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string | null
          video_url?: string | null
        }
        Update: {
          academy_id?: string
          access_config?: AccessConfig | null
          discount_config?: DiscountConfig | null
          free_access_config?: FreeAccessConfig | null
          additional_salary_per_student?: number | null
          base_salary?: number
          base_student_count?: number | null
          class_type?: string | null
          created_at?: string | null
          current_students?: number | null
          description?: string | null
          difficulty_level?: string | null
          end_time?: string | null
          genre?: string | null
          hall_id?: string | null
          id?: string
          instructor_id?: string | null
          is_active?: boolean | null
          is_canceled?: boolean | null
          max_students?: number | null
          poster_url?: string | null
          present_students?: number | null
          price?: number | null
          song?: string | null
          start_time?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_hall_id_fkey"
            columns: ["hall_id"]
            isOneToOne: false
            referencedRelation: "halls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_categories: {
        Row: {
          id: string
          academy_id: string
          name: string
          duration_minutes: number
          display_order: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          academy_id: string
          name: string
          duration_minutes?: number
          display_order?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          academy_id?: string
          name?: string
          duration_minutes?: number
          display_order?: number | null
          created_at?: string | null
        }
        Relationships: [{ foreignKeyName: "consultation_categories_academy_id_fkey"; columns: ["academy_id"]; isOneToOne: false; referencedRelation: "academies"; referencedColumns: ["id"] }]
      }
      consultations: {
        Row: {
          academy_id: string
          assigned_to: string | null
          created_at: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          scheduled_at: string | null
          status: string | null
          topic: string
          updated_at: string | null
          user_id: string | null
          category_id: string | null
          detail: string | null
          visit_datetime: string | null
        }
        Insert: {
          academy_id: string
          assigned_to?: string | null
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          scheduled_at?: string | null
          status?: string | null
          topic: string
          updated_at?: string | null
          user_id?: string | null
          category_id?: string | null
          detail?: string | null
          visit_datetime?: string | null
        }
        Update: {
          academy_id?: string
          assigned_to?: string | null
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          scheduled_at?: string | null
          status?: string | null
          topic?: string
          updated_at?: string | null
          user_id?: string | null
          category_id?: string | null
          detail?: string | null
          visit_datetime?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultations_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_logs: {
        Row: {
          academy_id: string
          class_id: string | null
          content: string | null
          created_at: string | null
          created_by: string | null
          id: string
          log_date: string
          notes: string | null
          status: string | null
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          academy_id: string
          class_id?: string | null
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          log_date: string
          notes?: string | null
          status?: string | null
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          academy_id?: string
          class_id?: string | null
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          log_date?: string
          notes?: string | null
          status?: string | null
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_logs_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      discounts: {
        Row: {
          academy_id: string
          created_at: string | null
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          academy_id: string
          created_at?: string | null
          description?: string | null
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          academy_id?: string
          created_at?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discounts_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
        ]
      }
      halls: {
        Row: {
          academy_id: string
          capacity: number | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          academy_id: string
          capacity?: number | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          academy_id?: string
          capacity?: number | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "halls_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_favorites: {
        Row: {
          created_at: string | null
          id: string
          instructor_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          instructor_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          instructor_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_favorites_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_salaries: {
        Row: {
          academy_id: string
          calculation_period_end: string | null
          calculation_period_start: string | null
          class_id: string | null
          created_at: string | null
          id: string
          instructor_id: string
          notes: string | null
          salary_amount: number
          salary_type: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          academy_id: string
          calculation_period_end?: string | null
          calculation_period_start?: string | null
          class_id?: string | null
          created_at?: string | null
          id?: string
          instructor_id: string
          notes?: string | null
          salary_amount?: number
          salary_type?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          academy_id?: string
          calculation_period_end?: string | null
          calculation_period_start?: string | null
          class_id?: string | null
          created_at?: string | null
          id?: string
          instructor_id?: string
          notes?: string | null
          salary_amount?: number
          salary_type?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instructor_salaries_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_salaries_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_salaries_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      instructors: {
        Row: {
          bio: string | null
          created_at: string | null
          id: string
          instagram_url: string | null
          like: number | null
          name_en: string | null
          name_kr: string | null
          profile_image_url: string | null
          specialties: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          id?: string
          instagram_url?: string | null
          like?: number | null
          name_en?: string | null
          name_kr?: string | null
          profile_image_url?: string | null
          specialties?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          id?: string
          instagram_url?: string | null
          like?: number | null
          name_en?: string | null
          name_kr?: string | null
          profile_image_url?: string | null
          specialties?: string | null
        }
        Relationships: []
      }
      operation_notes: {
        Row: {
          academy_id: string
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          note_date: string
          updated_at: string | null
        }
        Insert: {
          academy_id: string
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          note_date: string
          updated_at?: string | null
        }
        Update: {
          academy_id?: string
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          note_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operation_notes_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_schedules: {
        Row: {
          academy_id: string
          class_id: string
          created_at: string | null
          days_of_week: number[]
          end_date: string
          end_time: string
          hall_id: string | null
          id: string
          instructor_id: string | null
          interval_weeks: number | null
          is_active: boolean | null
          max_students: number | null
          start_date: string
          start_time: string
          updated_at: string | null
        }
        Insert: {
          academy_id: string
          class_id: string
          created_at?: string | null
          days_of_week?: number[]
          end_date: string
          end_time: string
          hall_id?: string | null
          id?: string
          instructor_id?: string | null
          interval_weeks?: number | null
          is_active?: boolean | null
          max_students?: number | null
          start_date: string
          start_time: string
          updated_at?: string | null
        }
        Update: {
          academy_id?: string
          class_id?: string
          created_at?: string | null
          days_of_week?: number[]
          end_date?: string
          end_time?: string
          hall_id?: string | null
          id?: string
          instructor_id?: string | null
          interval_weeks?: number | null
          is_active?: boolean | null
          max_students?: number | null
          start_date?: string
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_schedules_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_schedules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_schedules_hall_id_fkey"
            columns: ["hall_id"]
            isOneToOne: false
            referencedRelation: "halls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_schedules_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_transactions: {
        Row: {
          academy_id: string
          created_at: string | null
          discount_amount: number | null
          discount_id: string | null
          final_price: number
          id: string
          notes: string | null
          original_price: number
          payment_method: string | null
          payment_status: string | null
          quantity: number | null
          registration_type: string | null
          ticket_id: string | null
          ticket_name: string | null
          ticket_type_snapshot: string | null
          transaction_date: string | null
          user_id: string
          user_ticket_id: string | null
          valid_days: number | null
        }
        Insert: {
          academy_id: string
          created_at?: string | null
          discount_amount?: number | null
          discount_id?: string | null
          final_price?: number
          id?: string
          notes?: string | null
          original_price?: number
          payment_method?: string | null
          payment_status?: string | null
          quantity?: number | null
          registration_type?: string | null
          ticket_id?: string | null
          ticket_name?: string | null
          ticket_type_snapshot?: string | null
          transaction_date?: string | null
          user_id: string
          user_ticket_id?: string | null
          valid_days?: number | null
        }
        Update: {
          academy_id?: string
          created_at?: string | null
          discount_amount?: number | null
          discount_id?: string | null
          final_price?: number
          id?: string
          notes?: string | null
          original_price?: number
          payment_method?: string | null
          payment_status?: string | null
          quantity?: number | null
          registration_type?: string | null
          ticket_id?: string | null
          ticket_name?: string | null
          ticket_type_snapshot?: string | null
          transaction_date?: string | null
          user_id?: string
          user_ticket_id?: string | null
          valid_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "revenue_transactions_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_transactions_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_transactions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_transactions_user_ticket_id_fkey"
            columns: ["user_ticket_id"]
            isOneToOne: false
            referencedRelation: "user_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          class_id: string
          created_at: string | null
          current_students: number | null
          end_time: string
          hall_id: string | null
          id: string
          instructor_id: string | null
          is_canceled: boolean | null
          max_students: number | null
          recurring_schedule_id: string | null
          start_time: string
        }
        Insert: {
          class_id: string
          created_at?: string | null
          current_students?: number | null
          end_time: string
          hall_id?: string | null
          id?: string
          instructor_id?: string | null
          is_canceled?: boolean | null
          max_students?: number | null
          recurring_schedule_id?: string | null
          start_time: string
        }
        Update: {
          class_id?: string
          created_at?: string | null
          current_students?: number | null
          end_time?: string
          hall_id?: string | null
          id?: string
          instructor_id?: string | null
          is_canceled?: boolean | null
          max_students?: number | null
          recurring_schedule_id?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_hall_id_fkey"
            columns: ["hall_id"]
            isOneToOne: false
            referencedRelation: "halls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_recurring_schedule_id_fkey"
            columns: ["recurring_schedule_id"]
            isOneToOne: false
            referencedRelation: "recurring_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          id: string
          request_type: string
          status: string
          title: string
          bug_situation: string | null
          current_state: string
          improvement_request: string
          user_id: string
          academy_id: string
          admin_note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          request_type: string
          status?: string
          title: string
          bug_situation?: string | null
          current_state: string
          improvement_request: string
          user_id: string
          academy_id: string
          admin_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          request_type?: string
          status?: string
          title?: string
          bug_situation?: string | null
          current_state?: string
          improvement_request?: string
          user_id?: string
          academy_id?: string
          admin_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_requests_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          academy_id: string | null
          access_group: string | null
          class_id: string | null
          /** 팝업 수량별 가격: [{ count, price, valid_days? }] */
          count_options: Json | null
          created_at: string | null
          id: string
          is_coupon: boolean
          is_general: boolean
          is_on_sale: boolean | null
          /** true=공개(유저 구매 가능), false=비공개(Admin만 판매/지급) */
          is_public: boolean | null
          name: string
          price: number | null
          ticket_type: string
          ticket_category: 'regular' | 'popup' | 'workshop'
          total_count: number | null
          valid_days: number | null
        }
        Insert: {
          academy_id?: string | null
          access_group?: string | null
          class_id?: string | null
          count_options?: Json | null
          created_at?: string | null
          id?: string
          is_coupon?: boolean
          is_general?: boolean
          is_on_sale?: boolean | null
          is_public?: boolean | null
          name: string
          price?: number | null
          ticket_type: string
          ticket_category?: 'regular' | 'popup' | 'workshop'
          total_count?: number | null
          valid_days?: number | null
        }
        Update: {
          academy_id?: string | null
          access_group?: string | null
          class_id?: string | null
          count_options?: Json | null
          created_at?: string | null
          id?: string
          is_coupon?: boolean
          is_general?: boolean
          is_on_sale?: boolean | null
          is_public?: boolean | null
          name?: string
          price?: number | null
          ticket_type?: string
          ticket_category?: 'regular' | 'popup' | 'workshop'
          total_count?: number | null
          valid_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_target_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_classes: {
        Row: {
          id: string
          ticket_id: string
          class_id: string
          created_at: string | null
        }
        Insert: {
          id?: string
          ticket_id: string
          class_id: string
          created_at?: string | null
        }
        Update: {
          id?: string
          ticket_id?: string
          class_id?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_classes_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_extension_requests: {
        Row: {
          id: string
          user_ticket_id: string
          request_type: string
          absent_start_date: string | null
          absent_end_date: string | null
          extension_days: number | null
          reason: string | null
          status: string
          reject_reason: string | null
          processed_at: string | null
          processed_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_ticket_id: string
          request_type: string
          absent_start_date?: string | null
          absent_end_date?: string | null
          extension_days?: number | null
          reason?: string | null
          status?: string
          reject_reason?: string | null
          processed_at?: string | null
          processed_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_ticket_id?: string
          request_type?: string
          extension_days?: number | null
          reason?: string | null
          absent_start_date?: string
          absent_end_date?: string
          status?: string
          reject_reason?: string | null
          processed_at?: string | null
          processed_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "ticket_extension_requests_user_ticket_id_fkey"; columns: ["user_ticket_id"]; isOneToOne: false; referencedRelation: "user_tickets"; referencedColumns: ["id"] },
          { foreignKeyName: "ticket_extension_requests_processed_by_fkey"; columns: ["processed_by"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
        ]
      }
      user_tickets: {
        Row: {
          created_at: string | null
          expiry_date: string | null
          id: string
          remaining_count: number | null
          start_date: string | null
          status: string | null
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          remaining_count?: number | null
          start_date?: string | null
          status?: string | null
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          remaining_count?: number | null
          start_date?: string | null
          status?: string | null
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tickets_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          address: string | null
          birth_date: string | null
          created_at: string | null
          email: string | null
          gender: string | null
          id: string
          name: string | null
          name_en: string | null
          nationality: string | null
          nickname: string | null
          phone: string | null
          profile_image: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          created_at?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          name?: string | null
          name_en?: string | null
          nationality?: string | null
          nickname?: string | null
          phone?: string | null
          profile_image?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          created_at?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          name?: string | null
          name_en?: string | null
          nationality?: string | null
          nickname?: string | null
          phone?: string | null
          profile_image?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role:
        | "SUPER_ADMIN"
        | "ACADEMY_OWNER"
        | "ACADEMY_MANAGER"
        | "INSTRUCTOR"
        | "USER"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      user_role: [
        "SUPER_ADMIN",
        "ACADEMY_OWNER",
        "ACADEMY_MANAGER",
        "INSTRUCTOR",
        "USER",
      ],
    },
  },
} as const
