import { NextRequest, NextResponse } from 'next/server';
import {
  getAllBanners,
  createBanner,
  getBannerSettings,
  updateBannerSettings,
} from '@/lib/db/banners';

// 관리자용: 모든 배너 목록 조회
export async function GET(request: NextRequest) {
  try {
    const [banners, settings] = await Promise.all([
      getAllBanners(),
      getBannerSettings(),
    ]);

    return NextResponse.json({
      banners,
      settings: settings || {
        auto_slide_interval: 5000,
        is_auto_slide_enabled: true,
      },
    });
  } catch (error) {
    console.error('Error fetching banners:', error);
    return NextResponse.json(
      { error: 'Failed to fetch banners' },
      { status: 500 }
    );
  }
}

// 배너 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { title, image_url, link_url, display_order, is_active, starts_at, ends_at } = body;

    if (!title || !image_url) {
      return NextResponse.json(
        { error: 'Title and image_url are required' },
        { status: 400 }
      );
    }

    const banner = await createBanner({
      title,
      image_url,
      link_url: link_url || null,
      display_order: display_order ?? 0,
      is_active: is_active ?? true,
      starts_at: starts_at || null,
      ends_at: ends_at || null,
    });

    if (!banner) {
      return NextResponse.json(
        { error: 'Failed to create banner' },
        { status: 500 }
      );
    }

    return NextResponse.json(banner);
  } catch (error) {
    console.error('Error creating banner:', error);
    return NextResponse.json(
      { error: 'Failed to create banner' },
      { status: 500 }
    );
  }
}

// 배너 설정 수정
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { auto_slide_interval, is_auto_slide_enabled } = body;

    const settings = await updateBannerSettings({
      auto_slide_interval,
      is_auto_slide_enabled,
    });

    if (!settings) {
      return NextResponse.json(
        { error: 'Failed to update banner settings' },
        { status: 500 }
      );
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error updating banner settings:', error);
    return NextResponse.json(
      { error: 'Failed to update banner settings' },
      { status: 500 }
    );
  }
}
