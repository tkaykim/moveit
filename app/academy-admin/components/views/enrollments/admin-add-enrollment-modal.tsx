"use client";

import { useState, useEffect } from 'react';
import { X, UserPlus, Search, Loader2 } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { ScheduleSelector } from '@/components/common/schedule-selector';

interface AdminAddEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  academyId: string;
  initialScheduleId?: string | null;
  dateFilter?: string;
}

export function AdminAddEnrollmentModal({
  isOpen,
  onClose,
  onSuccess,
  academyId,
  initialScheduleId,
  dateFilter,
}: AdminAddEnrollmentModalProps) {
  const [scheduleId, setScheduleId] = useState<string | null>(initialScheduleId ?? null);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && academyId) {
      setScheduleId(initialScheduleId ?? null);
      setSelectedStudent(null);
      setSearchTerm('');
      loadStudents();
    }
  }, [isOpen, academyId, initialScheduleId]);

  const loadStudents = async () => {
    const supabase = getSupabaseClient() as any;
    if (!supabase) return;
    try {
      const { data: academyStudents, error } = await supabase
        .from('academy_students')
        .select(`
          *,
          users (
            id,
            name,
            name_en,
            nickname,
            phone,
            email
          )
        `)
        .eq('academy_id', academyId);

      if (error) {
        setStudents([]);
        return;
      }
      const uniqueUsers = new Map<string, any>();
      (academyStudents || []).forEach((row: any) => {
        const u = row.users;
        if (u && !uniqueUsers.has(u.id)) {
          uniqueUsers.set(u.id, { ...u });
        }
      });
      setStudents(Array.from(uniqueUsers.values()));
    } catch {
      setStudents([]);
    }
  };

  const filteredStudents = searchTerm
    ? students.filter(
        (s) =>
          (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (s.nickname || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (s.phone || '').replace(/\s/g, '').includes(searchTerm.replace(/\s/g, '')) ||
          (s.email || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    : students;

  const handleSubmit = async () => {
    if (!scheduleId || !selectedStudent) {
      alert('수업과 추가할 인원을 선택해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/bookings/admin-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId,
          userId: selectedStudent.id,
          academyId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '수기 추가에 실패했습니다.');
      }
      alert(json.message || '수강 명단에 추가되었습니다.');
      onSuccess();
      onClose();
    } catch (e: any) {
      alert(e.message || '수기 추가에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-700 shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-neutral-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">수기 추가 (관리자 권한)</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            수강권 사용 없이 관리자가 특전으로 수강 명단에 넣습니다. 수강권 컬럼에는 &quot;관리자 권한&quot;으로 표기됩니다.
          </p>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">수업 선택</label>
            <ScheduleSelector
              value={scheduleId || undefined}
              academyId={academyId}
              dateFilter={dateFilter}
              onChange={(id) => setScheduleId(id)}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">추가할 인원</label>
            {!selectedStudent ? (
              <>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="이름·연락처로 검색"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00]"
                  />
                </div>
                <div className="mt-2 border border-gray-200 dark:border-neutral-700 rounded-lg max-h-48 overflow-y-auto">
                  {filteredStudents.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      {students.length === 0 ? '해당 학원 수강생이 없습니다.' : '검색 결과가 없습니다.'}
                    </div>
                  ) : (
                    filteredStudents.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedStudent(s)}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-neutral-800 flex justify-between items-center border-b border-gray-100 dark:border-neutral-800 last:border-0"
                      >
                        <span className="font-medium text-gray-900 dark:text-white">
                          {s.name || s.nickname || '-'}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate ml-2">
                          {s.phone || s.email || ''}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between py-2.5 px-3 bg-primary/10 dark:bg-[#CCFF00]/10 rounded-lg border border-primary/20 dark:border-[#CCFF00]/20">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {selectedStudent.name || selectedStudent.nickname || '-'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedStudent.phone || selectedStudent.email || '-'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                >
                  <X size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 px-4 py-3 border-t border-gray-100 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !scheduleId || !selectedStudent}
            className="flex-1 px-4 py-2.5 bg-primary dark:bg-[#CCFF00] text-black rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
            추가하기
          </button>
        </div>
      </div>
    </div>
  );
}
