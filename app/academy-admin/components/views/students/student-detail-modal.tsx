"use client";

import { useState } from 'react';
import { X } from 'lucide-react';

interface StudentDetailModalProps {
  student: any;
  academyId: string;
  onClose: () => void;
}

export function StudentDetailModal({ student, academyId, onClose }: StudentDetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center sticky top-0 bg-white dark:bg-neutral-900">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
            {student.name || student.nickname || '학생 정보'}
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
                <span className="text-gray-600 dark:text-gray-400">이름</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {student.name || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">닉네임</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {student.nickname || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">전화번호</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {student.phone || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">이메일</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {student.email || '-'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">수강권 정보</h4>
            <div className="space-y-2">
              {student.user_tickets && student.user_tickets.length > 0 ? (
                student.user_tickets.map((ticket: any) => (
                  <div
                    key={ticket.id}
                    className="p-3 border dark:border-neutral-700 rounded-lg bg-gray-50 dark:bg-neutral-800"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {ticket.tickets?.name || '-'}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        잔여: {ticket.remaining_count}회
                      </span>
                    </div>
                    {ticket.expiry_date && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        만료일: {new Date(ticket.expiry_date).toLocaleDateString('ko-KR')}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-gray-500 dark:text-gray-400 text-sm">수강권이 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

