"use client";

import { Search, X, ChevronRight, UserPlus } from 'lucide-react';

interface StudentSelectionProps {
  selectedStudent: any;
  searchTerm: string;
  students: any[];
  onStudentSelect: (student: any) => void;
  onSearchChange: (term: string) => void;
  onRegisterStudent?: () => void;
}

export function StudentSelection({
  selectedStudent,
  searchTerm,
  students,
  onStudentSelect,
  onSearchChange,
  onRegisterStudent,
}: StudentSelectionProps) {
  const filteredStudents = searchTerm
    ? students.filter(
        (s) =>
          (s.name || '').includes(searchTerm) ||
          (s.phone || '').includes(searchTerm) ||
          (s.nickname || '').includes(searchTerm)
      )
    : students;

  return (
    <section className="bg-white dark:bg-neutral-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-neutral-800">
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 text-gray-800 dark:text-white">
        <span className="w-6 h-6 bg-slate-100 dark:bg-neutral-800 rounded-full flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-400">
          1
        </span>
        학생 선택
      </h2>

      {!selectedStudent ? (
        <div className="relative">
          <Search className="absolute left-3 top-3 text-slate-400 dark:text-slate-500" size={20} />
          <input
            type="text"
            placeholder="이름 또는 전화번호 뒷자리 검색"
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-all bg-white dark:bg-neutral-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />

          {searchTerm && (
            <div className="mt-2 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => onStudentSelect(student)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-neutral-800 flex justify-between items-center group"
                  >
                              <div>
                                <div className="font-medium text-slate-800 dark:text-white">
                                  {student.name || student.nickname || '-'}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {student.phone || '-'}
                                </div>
                              </div>
                    <ChevronRight
                      size={16}
                      className="text-slate-300 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-blue-400"
                    />
                  </button>
                ))
              ) : (
                <div className="p-4 text-center">
                  <div className="text-slate-500 dark:text-slate-400 text-sm mb-3">
                    검색 결과가 없습니다.
                  </div>
                  {onRegisterStudent && (
                    <button
                      onClick={onRegisterStudent}
                      className="w-full px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 font-medium"
                    >
                      <UserPlus size={16} />
                      학생 등록하기
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-200 dark:bg-blue-800 rounded-full flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold">
              {(selectedStudent.name || selectedStudent.nickname || 'U')[0]}
            </div>
            <div>
              <div className="font-bold text-slate-800 dark:text-white">
                {selectedStudent.name || selectedStudent.nickname || '-'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {selectedStudent.phone || '-'}
              </div>
            </div>
          </div>
          <button
            onClick={() => onStudentSelect(null)}
            className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      )}
    </section>
  );
}

