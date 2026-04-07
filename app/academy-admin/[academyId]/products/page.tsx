import { ProductView } from '../../components/views/product-view';
import { resolveAcademyId } from '@/lib/db/academies';

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId: slugOrId } = await params;
  const academy = await resolveAcademyId(slugOrId);
  const academyId = academy?.id ?? slugOrId;
  return <ProductView academyId={academyId} />;
}
