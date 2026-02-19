import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('billing_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const isMissingTable = /relation .* does not exist|no such table/i.test(message);
    console.error('[billing/plans] Error:', error);
    if (isMissingTable) {
      console.error('[billing/plans] billing_plans 테이블이 없습니다. supabase/migrations/20250219000000_billing.sql 적용하세요.');
    }
    return NextResponse.json(
      { error: isMissingTable ? '플랜 정보를 불러올 수 없습니다. billing DB 마이그레이션이 적용되었는지 확인하세요.' : '플랜 정보를 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}
