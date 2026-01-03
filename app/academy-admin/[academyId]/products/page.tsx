import { ProductView } from '../../components/views/product-view';

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId } = await params;
  return <ProductView academyId={academyId} />;
}

