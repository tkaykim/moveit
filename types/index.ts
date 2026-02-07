import { Academy as DBAcademy, Instructor as DBInstructor, Schedule as DBSchedule, Class as DBClass, Booking as DBBooking } from '@/lib/supabase/types';
import { SectionConfig } from '@/types/database';

export type ViewState = 
  | 'HOME' 
  | 'ACADEMY' 
  | 'DANCER' 
  | 'SAVED' 
  | 'MY' 
  | 'DETAIL_ACADEMY' 
  | 'DETAIL_CLASS' 
  | 'PAYMENT' 
  | 'PAYMENT_SUCCESS' 
  | 'DETAIL_DANCER'
  | 'SEARCH_RESULTS'
  | 'TICKETS'
  | 'PAYMENT_HISTORY'
  | 'SETTINGS'
  | 'FAQ'
  | 'NOTICES';

// Academy 타입: DB 스키마 기반
export interface Academy {
  id: string;
  name_kr: string | null;
  name_en: string | null;
  tags: string | null;
  logo_url: string | null;
  address?: string | null;
  contact_number?: string | null;
  // UI용 계산된 필드
  name: string; // name_kr 또는 name_en
  dist?: string; // 거리 (추후 계산)
  rating?: number; // 평점 (추후 계산)
  price?: number; // 최소 가격 (classes에서 계산)
  badges?: string[]; // 배지 (추후 계산)
  img?: string; // logo_url 또는 academy_images 첫 번째 이미지
  academyId?: string; // 원본 학원 ID
  section_config?: SectionConfig | null; // 페이지 섹션 순서/표시 설정
}

// Dancer 타입: Instructor 기반
export interface Dancer {
  id: string;
  name_kr: string | null;
  name_en: string | null;
  bio: string | null;
  instagram_url: string | null;
  specialties: string | null;
  // UI용 계산된 필드
  name: string; // name_kr 또는 name_en
  crew?: string; // 크루 (specialties에서 추출)
  genre?: string; // 장르 (specialties에서 추출)
  followers?: string; // 팔로워 수 (추후 계산)
  img?: string; // 프로필 이미지
}

// ClassInfo 타입: Schedule 기반
export interface ClassInfo {
  id: string;
  schedule_id: string;
  instructor: string;
  genre: string;
  level: string;
  status: 'AVAILABLE' | 'ALMOST_FULL' | 'FULL' | 'NONE';
  song?: string;
  time?: string;
  price?: number;
  startTime?: string;
  endTime?: string;
  class_title?: string | null;
  hall_name?: string | null;
  academy?: {
    id: string;
    name: string;
    address?: string | null;
  };
  poster_url?: string | null;
  maxStudents?: number;
  currentStudents?: number;
}

// HistoryLog 타입: Booking 기반
export interface HistoryLog {
  id: string;
  date: string;
  class: string;
  instructor: string;
  studio: string;
  status: 'ATTENDED' | 'ABSENT' | 'CONFIRMED';
}

// User 타입: Mock 데이터 및 UI용
export interface User {
  name: string;
  level: string;
  tickets: number;
  savedAcademies: string[];
  savedDancers: string[];
}

