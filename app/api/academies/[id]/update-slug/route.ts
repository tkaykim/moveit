import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { generateUniqueSlug } from '@/lib/utils/slug-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { id: academyId } = await params;
    const body = await request.json();
    const nameEn = body?.name_en?.trim();

    const supabase = createServiceClient();

    if (!nameEn) {
      const { error } = await supabase
        .from('academies')
        .update({ slug: null })
        .eq('id', academyId);

      if (error) throw error;
      return NextResponse.json({ slug: null });
    }

    const slug = await generateUniqueSlug(supabase, nameEn, academyId);

    const { error } = await supabase
      .from('academies')
      .update({ slug })
      .eq('id', academyId);

    if (error) throw error;

    return NextResponse.json({ slug });
  } catch (error) {
    console.error('[update-slug] Error:', error);
    return NextResponse.json({ error: 'slug 업데이트에 실패했습니다.' }, { status: 500 });
  }
}
