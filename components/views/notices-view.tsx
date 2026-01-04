"use client";

import { ChevronLeft, Megaphone, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface NoticesViewProps {
  onBack: () => void;
}

interface Notice {
  id: string;
  title: string;
  content: string;
  date: string;
  type: 'NOTICE' | 'EVENT';
  is_important?: boolean;
}

export const NoticesView = ({ onBack }: NoticesViewProps) => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'NOTICE' | 'EVENT'>('ALL');

  useEffect(() => {
    // 실제로는 DB에서 가져오지만, 현재는 목업 데이터 사용
    const mockNotices: Notice[] = [
      {
        id: '1',
        title: '신규 학원 등록 이벤트',
        content: '새로 등록된 학원을 이용하시면 첫 수강권을 50% 할인된 가격에 구매하실 수 있습니다. 이벤트 기간: 2024년 1월 1일 ~ 1월 31일',
        date: '2024-01-01',
        type: 'EVENT',
        is_important: true,
      },
      {
        id: '2',
        title: '시스템 점검 안내',
        content: '2024년 1월 15일 오전 2시 ~ 4시 동안 시스템 점검이 진행됩니다. 이 시간 동안 서비스 이용이 제한될 수 있습니다.',
        date: '2024-01-10',
        type: 'NOTICE',
        is_important: true,
      },
      {
        id: '3',
        title: '친구 초대 이벤트',
        content: '친구를 초대하고 함께 수강하면 각자 5,000포인트를 받을 수 있습니다. 많은 참여 부탁드립니다!',
        date: '2024-01-05',
        type: 'EVENT',
        is_important: false,
      },
      {
        id: '4',
        title: 'QR코드 출석 기능 업데이트',
        content: 'QR코드 출석 기능이 개선되었습니다. 이제 더 빠르고 정확하게 출석을 확인할 수 있습니다.',
        date: '2024-01-03',
        type: 'NOTICE',
        is_important: false,
      },
    ];

    // 실제 구현 시에는 DB에서 가져오기
    // async function loadNotices() {
    //   try {
    //     const supabase = getSupabaseClient();
    //     if (!supabase) {
    //       setLoading(false);
    //       return;
    //     }
    //     const { data } = await (supabase as any)
    //       .from('notices')
    //       .select('*')
    //       .order('created_at', { ascending: false });
    //     if (data) setNotices(data);
    //   } catch (error) {
    //     console.error('Error loading notices:', error);
    //   } finally {
    //     setLoading(false);
    //   }
    // }
    // loadNotices();

    setTimeout(() => {
      setNotices(mockNotices);
      setLoading(false);
    }, 500);
  }, []);

  const filteredNotices = notices.filter(notice => {
    if (filter === 'ALL') return true;
    return notice.type === filter;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-neutral-950 min-h-screen pt-12 px-5 animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="p-2 -ml-2 text-black dark:text-white">
            <ChevronLeft />
          </button>
          <h2 className="text-xl font-bold text-black dark:text-white">공지/이벤트</h2>
        </div>
        <div className="text-center py-12 text-neutral-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-950 min-h-screen pt-12 px-5 pb-24 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 -ml-2 text-black dark:text-white">
          <ChevronLeft />
        </button>
        <h2 className="text-xl font-bold text-black dark:text-white">공지/이벤트</h2>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
            filter === 'ALL'
              ? 'bg-primary dark:bg-[#CCFF00] text-black'
              : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400'
          }`}
        >
          전체
        </button>
        <button
          onClick={() => setFilter('NOTICE')}
          className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
            filter === 'NOTICE'
              ? 'bg-primary dark:bg-[#CCFF00] text-black'
              : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400'
          }`}
        >
          공지사항
        </button>
        <button
          onClick={() => setFilter('EVENT')}
          className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
            filter === 'EVENT'
              ? 'bg-primary dark:bg-[#CCFF00] text-black'
              : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400'
          }`}
        >
          이벤트
        </button>
      </div>

      {/* 공지/이벤트 목록 */}
      {filteredNotices.length === 0 ? (
        <div className="text-center py-20">
          <Megaphone className="mx-auto mb-4 text-neutral-400 dark:text-neutral-600" size={48} />
          <p className="text-neutral-500 dark:text-neutral-400 mb-2">공지사항이 없습니다</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">새로운 공지사항이 등록되면 알려드리겠습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotices.map((notice) => (
            <div
              key={notice.id}
              className={`bg-white dark:bg-neutral-900 border rounded-2xl p-4 ${
                notice.is_important
                  ? 'border-primary dark:border-[#CCFF00] bg-primary/5 dark:bg-[#CCFF00]/5'
                  : 'border-neutral-200 dark:border-neutral-800'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Megaphone 
                    className={notice.is_important ? 'text-primary dark:text-[#CCFF00]' : 'text-neutral-400'} 
                    size={18} 
                  />
                  <span className={`text-[10px] font-bold px-2 py-1 rounded ${
                    notice.type === 'EVENT'
                      ? 'bg-primary/10 dark:bg-[#CCFF00]/10 text-primary dark:text-[#CCFF00]'
                      : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                  }`}>
                    {notice.type === 'EVENT' ? '이벤트' : '공지'}
                  </span>
                  {notice.is_important && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded bg-red-500/10 text-red-500 dark:text-red-400">
                      중요
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-neutral-400 dark:text-neutral-500">
                  <Calendar size={12} />
                  {formatDate(notice.date)}
                </div>
              </div>
              <h3 className={`text-base font-bold mb-2 ${
                notice.is_important 
                  ? 'text-primary dark:text-[#CCFF00]' 
                  : 'text-black dark:text-white'
              }`}>
                {notice.title}
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                {notice.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};



