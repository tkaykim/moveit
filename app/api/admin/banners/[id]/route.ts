import { NextRequest, NextResponse } from 'next/server';
import { getBannerById, updateBanner, deleteBanner } from '@/lib/db/banners';

// 배너 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const banner = await getBannerById(params.id);

    if (!banner) {
      return NextResponse.json(
        { error: 'Banner not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(banner);
  } catch (error) {
    console.error('Error fetching banner:', error);
    return NextResponse.json(
      { error: 'Failed to fetch banner' },
      { status: 500 }
    );
  }
}

// 배너 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    const { title, image_url, link_url, display_order, is_active, starts_at, ends_at } = body;

    const banner = await updateBanner(params.id, {
      title,
      image_url,
      link_url,
      display_order,
      is_active,
      starts_at,
      ends_at,
    });

    if (!banner) {
      return NextResponse.json(
        { error: 'Failed to update banner' },
        { status: 500 }
      );
    }

    return NextResponse.json(banner);
  } catch (error) {
    console.error('Error updating banner:', error);
    return NextResponse.json(
      { error: 'Failed to update banner' },
      { status: 500 }
    );
  }
}

// 배너 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const success = await deleteBanner(params.id);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete banner' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting banner:', error);
    return NextResponse.json(
      { error: 'Failed to delete banner' },
      { status: 500 }
    );
  }
}
