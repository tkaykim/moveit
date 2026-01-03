"use client";

import { X } from 'lucide-react';

interface InstructorModalProps {
  instructor: any;
  onClose: () => void;
}

export function InstructorModal({ instructor, onClose }: InstructorModalProps) {
  if (!instructor) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center sticky top-0 bg-white dark:bg-neutral-900">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
            {instructor.name_kr || instructor.name_en || '강사 정보'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">기본 정보</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">이름 (한글)</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {instructor.name_kr || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">이름 (영문)</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {instructor.name_en || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">전문 분야</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {instructor.specialties || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">인스타그램</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {instructor.instagram_url ? (
                    <a
                      href={instructor.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {instructor.instagram_url}
                    </a>
                  ) : (
                    '-'
                  )}
                </span>
              </div>
            </div>
          </div>

          {instructor.bio && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">소개</h4>
              <p className="text-gray-800 dark:text-white">{instructor.bio}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

