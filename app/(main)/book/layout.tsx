"use client";

import { CSSLoader } from '@/components/common/css-loader';

export default function BookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <CSSLoader />
      <div className="flex justify-center bg-neutral-50 dark:bg-black min-h-screen font-sans selection:bg-primary dark:selection:bg-[#CCFF00] selection:text-black">
        <div className="w-full max-w-[420px] bg-white dark:bg-neutral-950 min-h-screen relative shadow-2xl overflow-hidden flex flex-col border-x border-neutral-200 dark:border-neutral-900">
          <main className="flex-1 overflow-y-auto scrollbar-hide">
            {children}
          </main>
          {/* 하단 네비게이션 없음 - 예약 페이지 전용 레이아웃 */}
        </div>
      </div>
    </>
  );
}
