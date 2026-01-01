export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      academies: {
        Row: {
          id: string
          name: string
          name_kr: string | null
          name_en: string | null
          tags: string | null
          owner_id: string
          business_registration_number: string | null
          logo_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name?: string
          name_kr?: string | null
          name_en?: string | null
          tags?: string | null
          owner_id?: string
          business_registration_number?: string | null
          logo_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          name_kr?: string | null
          name_en?: string | null
          tags?: string | null
          owner_id?: string
          business_registration_number?: string | null
          logo_url?: string | null
          created_at?: string
        }
      }
      branches: {
        Row: {
          id: string
          academy_id: string
          name: string
          address_primary: string
          address_detail: string | null
          contact_number: string | null
          is_active: boolean
          image_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          academy_id: string
          name: string
          address_primary: string
          address_detail?: string | null
          contact_number?: string | null
          is_active?: boolean
          image_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          academy_id?: string
          name?: string
          address_primary?: string
          address_detail?: string | null
          contact_number?: string | null
          is_active?: boolean
          image_url?: string | null
          created_at?: string
        }
      }
      instructors: {
        Row: {
          id: string
          user_id: string | null
          stage_name: string
          bio: string | null
          instagram_url: string | null
          specialties: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          stage_name: string
          bio?: string | null
          instagram_url?: string | null
          specialties?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          stage_name?: string
          bio?: string | null
          instagram_url?: string | null
          specialties?: string | null
          created_at?: string
        }
      }
      classes: {
        Row: {
          id: string
          academy_id: string
          instructor_id: string | null
          title: string
          description: string | null
          difficulty_level: string | null
          genre: string | null
          class_type: string
          thumbnail_url: string | null
          price: number
          created_at: string
        }
        Insert: {
          id?: string
          academy_id: string
          instructor_id?: string | null
          title: string
          description?: string | null
          difficulty_level?: string | null
          genre?: string | null
          class_type: string
          thumbnail_url?: string | null
          price?: number
          created_at?: string
        }
        Update: {
          id?: string
          academy_id?: string
          instructor_id?: string | null
          title?: string
          description?: string | null
          difficulty_level?: string | null
          genre?: string | null
          class_type?: string
          thumbnail_url?: string | null
          price?: number
          created_at?: string
        }
      }
      schedules: {
        Row: {
          id: string
          class_id: string
          branch_id: string
          hall_id: string
          instructor_id: string
          start_time: string
          end_time: string
          max_students: number
          current_students: number
          is_canceled: boolean
          created_at: string
        }
        Insert: {
          id?: string
          class_id: string
          branch_id: string
          hall_id: string
          instructor_id: string
          start_time: string
          end_time: string
          max_students: number
          current_students?: number
          is_canceled?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          class_id?: string
          branch_id?: string
          hall_id?: string
          instructor_id?: string
          start_time?: string
          end_time?: string
          max_students?: number
          current_students?: number
          is_canceled?: boolean
          created_at?: string
        }
      }
      halls: {
        Row: {
          id: string
          branch_id: string
          name: string
          capacity: number
          floor_info: string | null
        }
        Insert: {
          id?: string
          branch_id: string
          name: string
          capacity?: number
          floor_info?: string | null
        }
        Update: {
          id?: string
          branch_id?: string
          name?: string
          capacity?: number
          floor_info?: string | null
        }
      }
      academy_instructors: {
        Row: {
          academy_id: string
          instructor_id: string
          memo: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          academy_id: string
          instructor_id: string
          memo?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          academy_id?: string
          instructor_id?: string
          memo?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string
          name: string
          nickname: string | null
          phone: string | null
          profile_image: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          nickname?: string | null
          phone?: string | null
          profile_image?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          nickname?: string | null
          phone?: string | null
          profile_image?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      tickets: {
        Row: {
          id: string
          academy_id: string
          name: string
          price: number
          ticket_type: string
          total_count: number | null
          valid_days: number | null
          target_class_id: string | null
          is_on_sale: boolean
          created_at: string
        }
        Insert: {
          id?: string
          academy_id: string
          name: string
          price?: number
          ticket_type: string
          total_count?: number | null
          valid_days?: number | null
          target_class_id?: string | null
          is_on_sale?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          academy_id?: string
          name?: string
          price?: number
          ticket_type?: string
          total_count?: number | null
          valid_days?: number | null
          target_class_id?: string | null
          is_on_sale?: boolean
          created_at?: string
        }
      }
      user_tickets: {
        Row: {
          id: string
          user_id: string
          ticket_id: string
          remaining_count: number | null
          start_date: string | null
          expiry_date: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          ticket_id: string
          remaining_count?: number | null
          start_date?: string | null
          expiry_date?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          ticket_id?: string
          remaining_count?: number | null
          start_date?: string | null
          expiry_date?: string | null
          status?: string
          created_at?: string
        }
      }
      bookings: {
        Row: {
          id: string
          user_id: string
          schedule_id: string
          user_ticket_id: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          schedule_id: string
          user_ticket_id: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          schedule_id?: string
          user_ticket_id?: string
          status?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

