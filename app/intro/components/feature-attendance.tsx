'use client';

import React, { useState } from 'react';
import { Check, User, X } from 'lucide-react';

export function FeatureAttendance() {
  const [students, setStudents] = useState([
    { id: 1, name: '김민지', status: 'pending', img: 'bg-pink-100' },
    { id: 2, name: '이준호', status: 'pending', img: 'bg-blue-100' },
    { id: 3, name: '박서연', status: 'pending', img: 'bg-purple-100' },
  ]);

  const handleCheck = (id: number, status: 'present' | 'absent') => {
    setStudents(prev => prev.map(s => 
      s.id === id ? { ...s, status } : s
    ));
  };

  const presentCount = students.filter(s => s.status === 'present').length;
  const totalCount = students.length;
  const progress = (presentCount / totalCount) * 100;

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
        <div className="flex justify-between items-end mb-2">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">출석 관리</h3>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">K-POP 정규반 (월/수)</p>
          </div>
          <div className="text-right">
            <span className="text-xl font-bold text-[#CCFF00] text-shadow-sm">{presentCount}</span>
            <span className="text-xs text-neutral-400 dark:text-neutral-500">/{totalCount}명</span>
          </div>
        </div>
        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-[#CCFF00] transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="p-2 space-y-1">
        {students.map((student) => (
          <div key={student.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full ${student.img} flex items-center justify-center text-xs font-bold text-neutral-700 dark:text-neutral-300`}>
                {student.name[0]}
              </div>
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{student.name}</span>
            </div>
            <div className="flex gap-1">
              {student.status === 'pending' ? (
                <>
                  <button 
                    onClick={() => handleCheck(student.id, 'absent')}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 dark:text-neutral-500 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors"
                  >
                    <X size={16} />
                  </button>
                  <button 
                    onClick={() => handleCheck(student.id, 'present')}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 dark:text-neutral-500 hover:bg-[#CCFF00]/20 hover:text-[#CCFF00] transition-colors"
                  >
                    <Check size={16} />
                  </button>
                </>
              ) : (
                <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  student.status === 'present' 
                    ? 'bg-[#CCFF00]/20 text-[#aacc00]' 
                    : 'bg-red-100 dark:bg-red-900/30 text-red-500'
                }`}>
                  {student.status === 'present' ? '출석' : '결석'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* Reset Button for Demo */}
      {students.every(s => s.status !== 'pending') && (
        <div className="p-2 border-t border-neutral-100 dark:border-neutral-800 text-center">
          <button 
            onClick={() => setStudents(prev => prev.map(s => ({ ...s, status: 'pending' })))}
            className="text-[10px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 underline"
          >
            다시 체험하기
          </button>
        </div>
      )}
    </div>
  );
}
