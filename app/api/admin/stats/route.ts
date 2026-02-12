import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/supabase/admin-auth';
import { getDashboardStats } from '@/lib/db/stats';

export async function GET() {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const stats = await getDashboardStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}










