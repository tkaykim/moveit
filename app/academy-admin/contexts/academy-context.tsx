"use client";

import { createContext, useContext, type ReactNode } from 'react';

interface AcademyContextValue {
  academyId: string;
  academySlug: string;
}

const AcademyContext = createContext<AcademyContextValue | null>(null);

export function AcademyProvider({
  academyId,
  academySlug,
  children,
}: AcademyContextValue & { children: ReactNode }) {
  return (
    <AcademyContext.Provider value={{ academyId, academySlug }}>
      {children}
    </AcademyContext.Provider>
  );
}

export function useAcademy() {
  const ctx = useContext(AcademyContext);
  if (!ctx) {
    throw new Error('useAcademy must be used within AcademyProvider');
  }
  return ctx;
}

/**
 * URL에 사용할 학원 식별자를 반환.
 * slug이 있으면 slug, 없으면 UUID 반환.
 */
export function useAcademySlug() {
  const { academySlug } = useAcademy();
  return academySlug;
}
