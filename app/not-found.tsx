import Link from 'next/link';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-50 dark:bg-black px-5">
      <div className="text-center max-w-[420px] w-full">
        <h1 className="text-6xl font-bold text-primary dark:text-[#CCFF00] mb-2">404</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          요청하신 페이지를 찾을 수 없습니다.
        </p>
        <Link
          href="/home"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary dark:bg-[#CCFF00] text-black font-medium hover:opacity-90 transition-opacity"
        >
          <Home size={20} />
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
