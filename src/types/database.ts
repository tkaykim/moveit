export type Academy = {
  id: string;
  name_ko: string | null;
  name_en: string | null;
  address: string;
  phone: string | null;
  images: string[] | null;
  logo_url: string | null;
  created_at: string;
};

export type Instructor = {
  id: string;
  name_ko: string | null;
  name_en: string | null;
  image_url: string | null;
  instagram_url: string | null;
  created_at: string;
};

export type Class = {
  id: string;
  academy_id: string;
  instructor_id: string | null;
  song: string | null;
  title: string | null;
  difficulty_level: string | null;
  genre: string | null;
  class_type: 'regular' | 'popup' | 'workshop';
  thumbnail_url: string | null;
  price: number;
  start_time: string;
  end_time: string;
  max_students: number;
  current_students: number;
  status: '정상' | '연기됨' | '취소됨';
  created_at: string;
};

export type User = {
  id: string;
  activity_name: string;
  real_name: string;
  email: string;
  phone: string | null;
  created_at: string;
};




