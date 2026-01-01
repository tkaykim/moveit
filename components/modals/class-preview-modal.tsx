"use client";

import { Clock, Music } from 'lucide-react';
import { LevelBadge } from '@/components/common/level-badge';
import { ClassInfo } from '@/types';

interface ClassPreviewModalProps {
  classInfo: ClassInfo & { time?: string } | null;
  onClose: () => void;
  onBook: (classInfo: ClassInfo & { time?: string }) => void;
}

export const ClassPreviewModal = ({ classInfo, onClose, onBook }: ClassPreviewModalProps) => {
  if (!classInfo) return null;

  const isFull = classInfo.status === 'FULL';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" 
        onClick={onClose} 
      />
      <div className="relative w-full max-w-[420px] bg-white dark:bg-neutral-900 rounded-t-3xl p-6 animate-in slide-in-from-bottom duration-300 border-t border-neutral-200 dark:border-neutral-800 shadow-2xl">
        <div className="w-12 h-1 bg-neutral-300 dark:bg-neutral-700 rounded-full mx-auto mb-6" />
        <div className="flex gap-4 mb-6">
          <div className="w-20 h-20 bg-neutral-200 dark:bg-neutral-800 rounded-2xl flex items-center justify-center text-2xl font-black text-neutral-600 dark:text-neutral-400">
            {classInfo.instructor[0]}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-2xl font-black text-black dark:text-white italic">{classInfo.instructor}</h3>
              <LevelBadge level={classInfo.level} />
            </div>
            <p className="text-neutral-600 dark:text-neutral-400 text-sm font-medium">
              {classInfo.class_title || `${classInfo.genre} Class`}
            </p>
            {classInfo.academy && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {classInfo.academy.name || '학원 정보 없음'}
                {classInfo.branch_name && ` • ${classInfo.branch_name}`}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2 text-xs text-primary dark:text-[#CCFF00]">
              <Clock size={12} />
              <span>
                {classInfo.time}
                {classInfo.endTime && (
                  <>
                    {' ~ '}
                    {new Date(classInfo.endTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </>
                )}
              </span>
            </div>
            {(classInfo.maxStudents !== undefined && classInfo.currentStudents !== undefined) && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                정원: {classInfo.currentStudents}/{classInfo.maxStudents}
              </p>
            )}
          </div>
        </div>
        {classInfo.song && (
          <div className="bg-neutral-100 dark:bg-black/30 rounded-xl p-3 mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center">
              <Music size={14} className="text-neutral-600 dark:text-neutral-400" />
            </div>
            <div>
              <div className="text-[10px] text-neutral-500 dark:text-neutral-500">Song Info</div>
              <div className="text-sm font-bold text-black dark:text-white">{classInfo.song}</div>
            </div>
          </div>
        )}
        <div className="flex gap-3">
          <button 
            onClick={onClose} 
            className="flex-1 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white font-bold py-4 rounded-xl"
          >
            닫기
          </button>
          <button 
            onClick={() => onBook(classInfo)}
            disabled={isFull}
            className={`flex-[2] font-black py-4 rounded-xl text-lg ${
              isFull 
                ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-500 cursor-not-allowed' 
                : 'bg-primary dark:bg-[#CCFF00] text-black shadow-[0_0_20px_rgba(204,255,0,0.3)]'
            }`}
          >
            {isFull ? '예약 마감' : '이 수업 예약하기'}
          </button>
        </div>
      </div>
    </div>
  );
};

