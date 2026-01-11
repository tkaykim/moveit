import { NextRequest, NextResponse } from 'next/server';
import { getActiveBanners, getBannerSettings } from '@/lib/db/banners';

// 사용자용: 활성 배너 목록 조회
export async function GET(request: NextRequest) {
  try {
    let banners: any[] = [];
    let settings: any = null;

    try {
      banners = await getActiveBanners();
    } catch (e) {
      console.error('Error fetching banners:', e);
    }

    try {
      settings = await getBannerSettings();
    } catch (e) {
      console.error('Error fetching banner settings:', e);
    }

    return NextResponse.json({
      banners: banners || [],
      settings: settings || {
        auto_slide_interval: 5000,
        is_auto_slide_enabled: true,
      },
    });
  } catch (error) {
    console.error('Error in banners API:', error);
    return NextResponse.json({
      banners: [],
      settings: {
        auto_slide_interval: 5000,
        is_auto_slide_enabled: true,
      },
    });
  }
}
