import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { academyId: string } }
) {
  const supabase = createServiceClient();
  const { academyId } = params;

  try {
    const { data, error } = await (supabase as any)
      .from('academy_notification_settings')
      .select('*')
      .eq('academy_id', academyId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "Results contain 0 rows"
      throw error;
    }

    // If no settings exist, return default (all true)
    if (!data) {
      return NextResponse.json({
        booking_confirmed: true,
        booking_cancelled: true,
        class_reminder: true,
        class_cancelled: true,
        attendance_checked: true,
        attendance_absent: true,
        ticket_purchased: true,
        ticket_expiry: true,
        video_uploaded: true,
        consultation_reply: true,
        marketing: true,
      });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { academyId: string } }
) {
  const supabase = createServiceClient();
  const { academyId } = params;
  const body = await request.json();

  try {
    // Upsert settings
    const { data, error } = await (supabase as any)
      .from('academy_notification_settings')
      .upsert({
        academy_id: academyId,
        ...body,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
