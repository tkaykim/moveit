/**
 * 커버리지 혜택(ticket_coverage) 관리 — 어떤 수강권이 어떤 수업 그룹을 커버하는가.
 *
 * GET   ?ticket_id=...   해당 수강권의 커버리지 (비활성 포함)
 * POST  { ticket_id, class_group_id }        커버리지 부여
 * PATCH { coverage_id, is_active }           소프트 제거/복구 (DELETE 없음)
 */
import { NextRequest } from 'next/server';
import {
  listTicketCoverage,
  upsertTicketCoverage,
  setTicketCoverageActive,
  MembershipError,
} from '@/lib/db/memberships';
import { withStaff, badRequest } from '../_shared';

export const dynamic = 'force-dynamic';

async function assertAcademyTicket(supabase: any, academyId: string, ticketId: string) {
  const { data } = await supabase.from('tickets').select('id, academy_id').eq('id', ticketId).limit(1);
  if (!data?.[0] || data[0].academy_id !== academyId) {
    throw new MembershipError('NOT_FOUND', '해당 학원의 수강권이 아닙니다.');
  }
}

async function assertAcademyGroup(supabase: any, academyId: string, groupId: string) {
  const { data } = await supabase
    .from('class_groups')
    .select('id, academy_id')
    .eq('id', groupId)
    .limit(1);
  if (!data?.[0] || data[0].academy_id !== academyId) {
    throw new MembershipError('NOT_FOUND', '해당 학원의 수업 그룹이 아닙니다.');
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string }> }
) {
  const { academyId } = await params;
  const ticketId = new URL(request.url).searchParams.get('ticket_id');
  return withStaff(request, academyId, async ({ supabase }) => {
    if (!ticketId) badRequest('ticket_id 쿼리 파라미터가 필요합니다.');
    await assertAcademyTicket(supabase, academyId, ticketId!);
    return { coverage: await listTicketCoverage(supabase, ticketId!, { includeInactive: true }) };
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string }> }
) {
  const { academyId } = await params;
  return withStaff(request, academyId, async ({ supabase }) => {
    const body = await request.json().catch(() => ({}));
    if (!body.ticket_id || !body.class_group_id) {
      badRequest('ticket_id 와 class_group_id 가 필요합니다.');
    }
    await assertAcademyTicket(supabase, academyId, body.ticket_id);
    await assertAcademyGroup(supabase, academyId, body.class_group_id);
    return { coverage: await upsertTicketCoverage(supabase, body.ticket_id, body.class_group_id) };
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string }> }
) {
  const { academyId } = await params;
  return withStaff(request, academyId, async ({ supabase }) => {
    const body = await request.json().catch(() => ({}));
    if (!body.coverage_id) badRequest('coverage_id 가 필요합니다.');
    if (typeof body.is_active !== 'boolean') badRequest('is_active(boolean) 가 필요합니다.');

    const { data } = await supabase
      .from('ticket_coverage')
      .select('id, ticket_id')
      .eq('id', body.coverage_id)
      .limit(1);
    if (!data?.[0]) throw new MembershipError('NOT_FOUND', '커버리지 규칙을 찾을 수 없습니다.');
    await assertAcademyTicket(supabase, academyId, data[0].ticket_id);

    return { coverage: await setTicketCoverageActive(supabase, body.coverage_id, body.is_active) };
  });
}
