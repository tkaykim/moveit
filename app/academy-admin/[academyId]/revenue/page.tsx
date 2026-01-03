import { SalesSystemView } from '../../components/views/sales-system-view';
import { RevenueView } from '../../components/views/revenue-view';

export default async function RevenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ academyId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { academyId } = await params;
  const { tab } = await searchParams;
  
  // tab 파라미터가 'sales'이면 판매 시스템, 아니면 매출/정산 뷰
  if (tab === 'sales') {
    return <SalesSystemView academyId={academyId} />;
  }
  
  return <RevenueView academyId={academyId} />;
}

