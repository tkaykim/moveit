import { ReactNode } from 'react';
import { AcademyAdminLayoutWrapper } from '../components/academy-admin-layout-wrapper';

export default async function AcademyAdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ academyId: string }>;
}) {
  const { academyId } = await params;
  
  return (
    <AcademyAdminLayoutWrapper academyId={academyId}>
      {children}
    </AcademyAdminLayoutWrapper>
  );
}

