export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// 클래스 접근 제어 설정 타입
export interface AccessConfig {
  requiredGroup: string | null;  // 필수 수강권 그룹 (null이면 제한 없음)
  allowRegularTicket: boolean;   // 일반 수강권 허용 여부 (기존 allowStandardCoupon 대체)
  allowCoupon: boolean;          // 쿠폰 허용 여부
}

// 정규 수강생 할인 설정 타입 (팝업/워크샵용)
export interface DiscountConfig {
  enabled: boolean;              // 할인 활성화 여부
  target_class_ids: string[];    // 할인 대상 정규 클래스 ID 목록
  discount_amount: number;       // 할인 금액
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
          id: string
          images: Json | null
          instagram_handle: string | null
          is_active: boolean | null
          logo_url: string | null
          name_en: string | null
          name_kr: string | null
          other_url: string | null
          tags: string | null
          tiktok_handle: string | null
          website_url: string | null
          youtube_url: string | null
        }
        Insert: {
          address?: string | null
          contact_number?: string | null
          created_at?: string | null
          id?: string
          images?: Json | null
          instagram_handle?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name_en?: string | null
          name_kr?: string | null
          other_url?: string | null
          tags?: string | null
          tiktok_handle?: string | null
          website_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          address?: string | null
          contact_number?: string | null
          created_at?: string | null
          id?: string
          images?: Json | null
          instagram_handle?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name_en?: string | null
          name_kr?: string | null
          other_url?: string | null
          tags?: string | null
          tiktok_handle?: string | null
          website_url?: string | null
          youtube_url?: string | null
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
      bookings: {
        Row: {
          class_id: string | null
          created_at: string | null
          hall_id: string | null
          id: string
          status: string | null
          user_id: string
          user_ticket_id: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          hall_id?: string | null
          id?: string
          status?: string | null
          user_id: string
          user_ticket_id?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          hall_id?: string | null
          id?: string
          status?: string | null
          user_id?: string
          user_ticket_id?: string | null
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
          ticket_id: string | null
          transaction_date: string | null
          user_id: string
          user_ticket_id: string | null
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
          ticket_id?: string | null
          transaction_date?: string | null
          user_id: string
          user_ticket_id?: string | null
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
          ticket_id?: string | null
          transaction_date?: string | null
          user_id?: string
          user_ticket_id?: string | null
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
      tickets: {
        Row: {
          academy_id: string | null
          access_group: string | null
          class_id: string | null
          created_at: string | null
          id: string
          is_coupon: boolean
          is_general: boolean
          is_on_sale: boolean | null
          name: string
          price: number | null
          ticket_type: string
          total_count: number | null
          valid_days: number | null
        }
        Insert: {
          academy_id?: string | null
          access_group?: string | null
          class_id?: string | null
          created_at?: string | null
          id?: string
          is_coupon?: boolean
          is_general?: boolean
          is_on_sale?: boolean | null
          name: string
          price?: number | null
          ticket_type: string
          total_count?: number | null
          valid_days?: number | null
        }
        Update: {
          academy_id?: string | null
          access_group?: string | null
          class_id?: string | null
          created_at?: string | null
          id?: string
          is_coupon?: boolean
          is_general?: boolean
          is_on_sale?: boolean | null
          name?: string
          price?: number | null
          ticket_type?: string
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
