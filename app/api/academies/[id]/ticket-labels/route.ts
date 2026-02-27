import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_TICKET_LABELS } from '@/lib/constants/ticket-labels';

export const dynamic = 'force-dynamic';

/**
 * GET /api/academies/[id]/ticket-labels
 * 학원별 수강권 유형 표기 (표시 이름). NULL이면 기본값 반환.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: academyId } = await params;
    if (!academyId) {
      return NextResponse.json(
        { regular: DEFAULT_TICKET_LABELS.regular, popup: DEFAULT_TICKET_LABELS.popup, workshop: DEFAULT_TICKET_LABELS.workshop },
        { status: 200 }
      );
    }
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from('academies')
      .select('ticket_label_regular, ticket_label_popup, ticket_label_workshop')
      .eq('id', academyId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { regular: DEFAULT_TICKET_LABELS.regular, popup: DEFAULT_TICKET_LABELS.popup, workshop: DEFAULT_TICKET_LABELS.workshop },
        { status: 200 }
      );
    }

    const regular = data.ticket_label_regular?.trim() || DEFAULT_TICKET_LABELS.regular;
    const popup = data.ticket_label_popup?.trim() || DEFAULT_TICKET_LABELS.popup;
    const workshop = data.ticket_label_workshop?.trim() || DEFAULT_TICKET_LABELS.workshop;

    return NextResponse.json({ regular, popup, workshop });
  } catch (e) {
    console.error('[ticket-labels]', e);
    return NextResponse.json(
      { regular: DEFAULT_TICKET_LABELS.regular, popup: DEFAULT_TICKET_LABELS.popup, workshop: DEFAULT_TICKET_LABELS.workshop },
      { status: 200 }
    );
  }
}
