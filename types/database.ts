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
          owner_id: string | null
          business_registration_number: string | null
          logo_url: string | null
          created_at: string | null
          name_kr: string | null
          name_en: string | null
          tags: string | null
        }
        Insert: {
          id?: string
          owner_id?: string | null
          business_registration_number?: string | null
          logo_url?: string | null
          created_at?: string | null
          name_kr?: string | null
          name_en?: string | null
          tags?: string | null
        }
        Update: {
          id?: string
          owner_id?: string | null
          business_registration_number?: string | null
          logo_url?: string | null
          created_at?: string | null
          name_kr?: string | null
          name_en?: string | null
          tags?: string | null
        }
      }
      branches: {
        Row: {
          id: string
          academy_id: string | null
          name: string | null
          address_primary: string | null
          address_detail: string | null
          contact_number: string | null
          is_active: boolean | null
          created_at: string | null
          image_url: string | null
        }
        Insert: {
          id?: string
          academy_id?: string | null
          name?: string | null
          address_primary?: string | null
          address_detail?: string | null
          contact_number?: string | null
          is_active?: boolean | null
          created_at?: string | null
          image_url?: string | null
        }
        Update: {
          id?: string
          academy_id?: string | null
          name?: string | null
          address_primary?: string | null
          address_detail?: string | null
          contact_number?: string | null
          is_active?: boolean | null
          created_at?: string | null
          image_url?: string | null
        }
      }
      instructors: {
        Row: {
          id: string
          user_id: string | null
          bio: string | null
          instagram_url: string | null
          specialties: string | null
          created_at: string | null
          name_kr: string | null
          name_en: string | null
          profile_image_url: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          bio?: string | null
          instagram_url?: string | null
          specialties?: string | null
          created_at?: string | null
          name_kr?: string | null
          name_en?: string | null
          profile_image_url?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          bio?: string | null
          instagram_url?: string | null
          specialties?: string | null
          created_at?: string | null
          name_kr?: string | null
          name_en?: string | null
          profile_image_url?: string | null
        }
      }
      classes: {
        Row: {
          id: string
          academy_id: string | null
          title: string | null
          description: string | null
          difficulty_level: string | null
          genre: string | null
          class_type: string | null
          thumbnail_url: string | null
          created_at: string | null
          price: number | null
          instructor_id: string | null
        }
        Insert: {
          id?: string
          academy_id?: string | null
          title?: string | null
          description?: string | null
          difficulty_level?: string | null
          genre?: string | null
          class_type?: string | null
          thumbnail_url?: string | null
          created_at?: string | null
          price?: number | null
          instructor_id?: string | null
        }
        Update: {
          id?: string
          academy_id?: string | null
          title?: string | null
          description?: string | null
          difficulty_level?: string | null
          genre?: string | null
          class_type?: string | null
          thumbnail_url?: string | null
          created_at?: string | null
          price?: number | null
          instructor_id?: string | null
        }
      }
      schedules: {
        Row: {
          id: string
          class_id: string | null
          branch_id: string | null
          hall_id: string | null
          instructor_id: string | null
          start_time: string | null
          end_time: string | null
          max_students: number | null
          current_students: number | null
          is_canceled: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          class_id?: string | null
          branch_id?: string | null
          hall_id?: string | null
          instructor_id?: string | null
          start_time?: string | null
          end_time?: string | null
          max_students?: number | null
          current_students?: number | null
          is_canceled?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          class_id?: string | null
          branch_id?: string | null
          hall_id?: string | null
          instructor_id?: string | null
          start_time?: string | null
          end_time?: string | null
          max_students?: number | null
          current_students?: number | null
          is_canceled?: boolean | null
          created_at?: string | null
        }
      }
      halls: {
        Row: {
          id: string
          branch_id: string | null
          name: string | null
          capacity: number | null
          floor_info: string | null
        }
        Insert: {
          id?: string
          branch_id?: string | null
          name?: string | null
          capacity?: number | null
          floor_info?: string | null
        }
        Update: {
          id?: string
          branch_id?: string | null
          name?: string | null
          capacity?: number | null
          floor_info?: string | null
        }
      }
      academy_instructors: {
        Row: {
          academy_id: string
          instructor_id: string
          memo: string | null
          is_active: boolean | null
          created_at: string | null
        }
        Insert: {
          academy_id: string
          instructor_id: string
          memo?: string | null
          is_active?: boolean | null
          created_at?: string | null
        }
        Update: {
          academy_id?: string
          instructor_id?: string
          memo?: string | null
          is_active?: boolean | null
          created_at?: string | null
        }
      }
      users: {
        Row: {
          id: string
          email: string | null
          name: string | null
          nickname: string | null
          phone: string | null
          profile_image: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          email?: string | null
          name?: string | null
          nickname?: string | null
          phone?: string | null
          profile_image?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          email?: string | null
          name?: string | null
          nickname?: string | null
          phone?: string | null
          profile_image?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      tickets: {
        Row: {
          id: string
          academy_id: string | null
          name: string | null
          price: number | null
          ticket_type: string | null
          total_count: number | null
          valid_days: number | null
          target_class_id: string | null
          is_on_sale: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          academy_id?: string | null
          name?: string | null
          price?: number | null
          ticket_type?: string | null
          total_count?: number | null
          valid_days?: number | null
          target_class_id?: string | null
          is_on_sale?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          academy_id?: string | null
          name?: string | null
          price?: number | null
          ticket_type?: string | null
          total_count?: number | null
          valid_days?: number | null
          target_class_id?: string | null
          is_on_sale?: boolean | null
          created_at?: string | null
        }
      }
      user_tickets: {
        Row: {
          id: string
          user_id: string | null
          ticket_id: string | null
          remaining_count: number | null
          start_date: string | null
          expiry_date: string | null
          status: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          ticket_id?: string | null
          remaining_count?: number | null
          start_date?: string | null
          expiry_date?: string | null
          status?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          ticket_id?: string | null
          remaining_count?: number | null
          start_date?: string | null
          expiry_date?: string | null
          status?: string | null
          created_at?: string | null
        }
      }
      bookings: {
        Row: {
          id: string
          user_id: string | null
          schedule_id: string | null
          user_ticket_id: string | null
          status: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          schedule_id?: string | null
          user_ticket_id?: string | null
          status?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          schedule_id?: string | null
          user_ticket_id?: string | null
          status?: string | null
          created_at?: string | null
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
