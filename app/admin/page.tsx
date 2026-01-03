import { Building2, Users, Calendar, BookOpen } from 'lucide-react';

export default function AdminPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
          관리자 대시보드
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          학원, 강사, 시간표 등을 관리할 수 있습니다.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-primary/10 dark:bg-[#CCFF00]/10 rounded-lg">
              <Building2 className="text-primary dark:text-[#CCFF00] w-6 h-6" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-black dark:text-white mb-1">0</h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">등록된 학원</p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Users className="text-blue-500 w-6 h-6" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-black dark:text-white mb-1">0</h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">등록된 강사</p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <BookOpen className="text-green-500 w-6 h-6" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-black dark:text-white mb-1">0</h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">등록된 클래스</p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <Calendar className="text-purple-500 w-6 h-6" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-black dark:text-white mb-1">0</h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">오늘 예약</p>
        </div>
      </div>

      <div className="mt-8 bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800">
        <h2 className="text-xl font-bold text-black dark:text-white mb-4">
          빠른 시작
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400">
          왼쪽 사이드바 메뉴를 사용하여 각 항목을 관리할 수 있습니다.
        </p>
        <ul className="mt-4 space-y-2 text-neutral-600 dark:text-neutral-400">
          <li>• 학원 관리: 학원, 지점, 홀을 등록하고 관리합니다</li>
          <li>• 강사 관리: 강사 정보를 등록하고 관리합니다</li>
          <li>• 클래스 관리: 클래스를 등록하고 관리합니다</li>
          <li>• 시간표 관리: 클래스 시간표를 등록하고 관리합니다</li>
          <li>• 예약 관리: 예약 현황을 조회합니다</li>
        </ul>
      </div>
    </div>
  );
}
