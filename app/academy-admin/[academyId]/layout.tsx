import { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { AcademyAdminLayoutWrapper } from '../components/academy-admin-layout-wrapper';
import { AcademyProvider } from '../contexts/academy-context';
import { resolveAcademyId } from '@/lib/db/academies';

export default async function AcademyAdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ academyId: string }>;
}) {
  const { academyId: slugOrId } = await params;

  const academy = await resolveAcademyId(slugOrId);
  if (!academy) {
    notFound();
  }

  const academySlug = academy.slug || academy.id;

  return (
    <AcademyProvider academyId={academy.id} academySlug={academySlug}>
      <AcademyAdminLayoutWrapper academyId={academy.id}>
        {children}
      </AcademyAdminLayoutWrapper>
    </AcademyProvider>
  );
}
