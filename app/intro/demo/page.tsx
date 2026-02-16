'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Smartphone, ArrowRight, ExternalLink } from 'lucide-react';

export default function IntroDemoPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 flex flex-col">
      <nav className="h-14 flex items-center px-4 border-b border-neutral-200 dark:border-neutral-800">
        <Link href="/intro" className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-primary dark:hover:text-[#CCFF00]">
          ← 입점 제안
        </Link>
      </nav>
      <main className="flex-1 flex flex-col items-center justify-center px-6 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-primary/20 dark:bg-[#CCFF00]/20 flex items-center justify-center mb-6">
          <Smartphone className="w-8 h-8 text-primary dark:text-[#CCFF00]" />
        </div>
        <h1 className="text-xl font-bold text-center mb-2">데모 체험</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 text-center mb-8">
          실제 수강생 앱 화면을 직접 둘러보실 수 있습니다. 학원 목록, 스케줄, 수강권 등을 체험해보세요.
        </p>
        <div className="w-full space-y-3">
          <button
            onClick={() => router.push('/home')}
            className="w-full flex items-center justify-between px-5 py-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-primary dark:hover:border-[#CCFF00] transition-colors"
          >
            <span className="font-semibold">수강생 앱 둘러보기</span>
            <ArrowRight className="w-5 h-5 text-neutral-400" />
          </button>
          <button
            onClick={() => router.push('/academy')}
            className="w-full flex items-center justify-between px-5 py-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-primary dark:hover:border-[#CCFF00] transition-colors"
          >
            <span className="font-semibold">학원 목록 보기</span>
            <ArrowRight className="w-5 h-5 text-neutral-400" />
          </button>
        </div>
        <p className="text-xs text-neutral-500 mt-8 text-center">
          로그인 없이 일부 기능을 둘러보실 수 있습니다. 상세 이용은 도입 문의 후 안내드립니다.
        </p>
      </main>
    </div>
  );
}
