import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 서버 사이드에서만 사용
const getServerSupabase = (): SupabaseClient => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vjxnollfggbufpqldxrb.supabase.co';
  // 서비스 키가 없으면 anon 키 사용 (RLS 비활성화된 테이블용)
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    throw new Error('Missing Supabase configuration');
  }
  
  return createClient(supabaseUrl, supabaseKey);
};

export interface Banner {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  display_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface BannerSettings {
  id: string;
  auto_slide_interval: number;
  is_auto_slide_enabled: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface BannerInsert {
  title: string;
  image_url: string;
  link_url?: string | null;
  display_order?: number;
  is_active?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
}

export interface BannerUpdate {
  title?: string;
  image_url?: string;
  link_url?: string | null;
  display_order?: number;
  is_active?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
}

// 활성 배너 목록 조회 (사용자용)
export async function getActiveBanners(): Promise<Banner[]> {
  try {
    const supabase = getServerSupabase();
    
    // 단순하게 활성 배너만 조회
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching active banners:', error);
      return [];
    }

    // 클라이언트에서 날짜 필터링
    const now = new Date();
    const filtered = (data || []).filter((banner: Banner) => {
      const startsAt = banner.starts_at ? new Date(banner.starts_at) : null;
      const endsAt = banner.ends_at ? new Date(banner.ends_at) : null;
      
      const startOk = !startsAt || startsAt <= now;
      const endOk = !endsAt || endsAt >= now;
      
      return startOk && endOk;
    });

    return filtered;
  } catch (error) {
    console.error('Error in getActiveBanners:', error);
    return [];
  }
}

// 모든 배너 목록 조회 (관리자용)
export async function getAllBanners(): Promise<Banner[]> {
  const supabase = getServerSupabase();
  
  const { data, error } = await supabase
    .from('banners')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching all banners:', error);
    return [];
  }

  return data || [];
}

// 배너 조회
export async function getBannerById(id: string): Promise<Banner | null> {
  const supabase = getServerSupabase();
  
  const { data, error } = await supabase
    .from('banners')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching banner:', error);
    return null;
  }

  return data;
}

// 배너 생성
export async function createBanner(banner: BannerInsert): Promise<Banner | null> {
  const supabase = getServerSupabase();
  
  const { data, error } = await supabase
    .from('banners')
    .insert(banner)
    .select()
    .single();

  if (error) {
    console.error('Error creating banner:', error);
    return null;
  }

  return data;
}

// 배너 수정
export async function updateBanner(id: string, banner: BannerUpdate): Promise<Banner | null> {
  const supabase = getServerSupabase();
  
  const { data, error } = await supabase
    .from('banners')
    .update({ ...banner, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating banner:', error);
    return null;
  }

  return data;
}

// 배너 삭제
export async function deleteBanner(id: string): Promise<boolean> {
  const supabase = getServerSupabase();
  
  const { error } = await supabase
    .from('banners')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting banner:', error);
    return false;
  }

  return true;
}

// 배너 설정 조회
export async function getBannerSettings(): Promise<BannerSettings | null> {
  const supabase = getServerSupabase();
  
  const { data, error } = await supabase
    .from('banner_settings')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching banner settings:', error);
    return null;
  }

  return data;
}

// 배너 설정 수정
export async function updateBannerSettings(settings: {
  auto_slide_interval?: number;
  is_auto_slide_enabled?: boolean;
}): Promise<BannerSettings | null> {
  const supabase = getServerSupabase();
  
  // 먼저 기존 설정 조회
  const { data: existing } = await supabase
    .from('banner_settings')
    .select('id')
    .limit(1)
    .single();

  if (existing) {
    // 업데이트
    const { data, error } = await supabase
      .from('banner_settings')
      .update({ ...settings, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating banner settings:', error);
      return null;
    }

    return data;
  } else {
    // 새로 생성
    const { data, error } = await supabase
      .from('banner_settings')
      .insert({
        auto_slide_interval: settings.auto_slide_interval ?? 5000,
        is_auto_slide_enabled: settings.is_auto_slide_enabled ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating banner settings:', error);
      return null;
    }

    return data;
  }
}
