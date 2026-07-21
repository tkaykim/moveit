'use client';

import { createContext, useContext } from 'react';

export interface LiteAcademy {
  id: string;
  slug: string;
  name: string;
  brand: string;
}

const LiteAdminContext = createContext<LiteAcademy | null>(null);

export function LiteAdminProvider({ value, children }: { value: LiteAcademy; children: React.ReactNode }) {
  return <LiteAdminContext.Provider value={value}>{children}</LiteAdminContext.Provider>;
}

export function useLiteAdmin(): LiteAcademy {
  const ctx = useContext(LiteAdminContext);
  if (!ctx) throw new Error('useLiteAdmin must be used within LiteAdminProvider');
  return ctx;
}
