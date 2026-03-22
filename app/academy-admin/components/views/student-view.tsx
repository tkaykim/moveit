"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Filter, Download, User } from 'lucide-react';
import { SectionHeader } from '../common/section-header';
import { StatusBadge } from '../common/status-badge';
import { StudentRegisterModal } from './students/student-register-modal';
import { StudentDetailModal } from './students/student-detail-modal';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { formatPhoneDisplay } from '@/lib/utils/phone';

interface StudentViewProps {
  academyId: string;
}

interface Student {
  id: string;
  name?: string | null;
  nickname?: string | null;
  phone?: string | null;
  email?: string | null;
  profile_image?: string | null;
  user_tickets?: Array<{
    id: string;
    remaining_count: number | null;
    expiry_date?: string | null;
    status: string;
    tickets: {
      id: string;
      name: string;
      ticket_type: string;
      ticket_category?: string | null;
      access_group?: string | null;
    };
  }>;
}

const ITEMS_PER_PAGE_OPTIONS = [30, 50, 100];

export function StudentView({ academyId }: StudentViewProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | '수강중' | '만료예정' | '휴면'>('ALL');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(30);
  const [totalCount, setTotalCount] = useState(0);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [searchTerm]);

  useEffect(() => {
    loadStudents();
  }, [academyId, currentPage, itemsPerPage, debouncedSearch]);

  const loadStudents = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) { setLoading(false); return; }

    setLoading(true);
    try {
      const offset = (currentPage - 1) * itemsPerPage;

      const { data, error } = await supabase.rpc('get_academy_students_paginated', {
        p_academy_id: academyId,
        p_search: debouncedSearch || null,
        p_offset: offset,
        p_limit: itemsPerPage,
      });

      if (error) throw error;

      const result = data as { total_count: number; students: Student[] };
      setTotalCount(result.total_count);
      setStudents(result.students || []);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  const reloadAll = useCallback(() => {
    setCurrentPage(1);
    loadStudents();
  }, [academyId]);

  const getStudentStatus = (student: Student): string => {
    const tickets = student.user_tickets || [];
    // 기간권(remaining_count === null) 또는 횟수권(remaining_count > 0) 모두 포함
    const activeTickets = tickets.filter((t) => t.status === 'ACTIVE' && (t.remaining_count === null || t.remaining_count > 0));
    
    if (activeTickets.length === 0) return '휴면';
    
    const expiringSoon = activeTickets.some((t) => {
      if (!t.expiry_date) return false;
      const expiry = new Date(t.expiry_date);
      const daysUntilExpiry = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
    });

    if (expiringSoon) return '만료예정';
    return '수강중';
  };

  const getTotalRemaining = (student: Student): number => {
    const tickets = student.user_tickets || [];
    return tickets
      .filter((t) => t.status === 'ACTIVE')
      .reduce((sum, t) => sum + (t.remaining_count ?? 0), 0);
  };

  const getNearestExpiry = (student: Student): string | null => {
    const tickets = student.user_tickets || [];
    const withExpiry = tickets
      .filter((t) => t.status === 'ACTIVE' && t.expiry_date)
      .map((t) => t.expiry_date as string)
      .sort();
    if (withExpiry.length === 0) return null;
    return withExpiry[0];
  };

  const filteredStudents = students.filter((student) => {
    if (statusFilter !== 'ALL') {
      const status = getStudentStatus(student);
      if (status !== statusFilter) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const isInitialLoad = loading && students.length === 0 && totalCount === 0;

  if (isInitialLoad) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6" data-onboarding="page-students-0">
        <SectionHeader
          title="학생(회원) 관리"
          buttonText="학생 등록"
          onButtonClick={() => setShowRegisterModal(true)}
        />

        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 overflow-hidden">
          <div className="p-3 sm:p-4 border-b dark:border-neutral-800 flex flex-col sm:flex-row gap-3 bg-gray-50 dark:bg-neutral-800">
            <div className="relative flex-1 max-w-sm">
              <input
                type="text"
                placeholder="이름, 연락처, 이메일 검색..."
                className="pl-9 pr-4 py-2 border dark:border-neutral-700 rounded-lg text-sm w-full focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search
                size={16}
                className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500"
              />
            </div>
            <div className="flex gap-2 sm:gap-3 relative">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setFilterDropdownOpen((v) => !v)}
                  className="flex items-center gap-2 px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800"
                >
                  <Filter size={16} /> <span className="hidden sm:inline">필터</span>
                  {statusFilter !== 'ALL' && (
                    <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs px-1.5 py-0.5 rounded">
                      {statusFilter}
                    </span>
                  )}
                </button>
                {filterDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" aria-hidden onClick={() => setFilterDropdownOpen(false)} />
                    <div className="absolute left-0 top-full mt-1 w-44 py-1 bg-white dark:bg-neutral-800 border dark:border-neutral-700 rounded-lg shadow-lg z-20">
                      {(['ALL', '수강중', '만료예정', '휴면'] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setStatusFilter(opt);
                            setFilterDropdownOpen(false);
                          }}
                          className={`w-full px-4 py-2 text-left text-sm ${
                            statusFilter === opt
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-700'
                          }`}
                        >
                          {opt === 'ALL' ? '전체' : opt}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button className="flex items-center gap-2 px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800">
                <Download size={16} /> <span className="hidden sm:inline">엑셀 다운로드</span>
              </button>
            </div>
          </div>

          {/* 테이블 형태 (모바일/데스크톱 공통) */}
          <div className="overflow-x-auto relative">
            {loading && (
              <div className="absolute inset-0 bg-white/60 dark:bg-neutral-900/60 z-10 flex items-center justify-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">로딩 중...</div>
              </div>
            )}
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 font-medium">
                <tr>
                  <th className="px-4 sm:px-6 py-3">이름</th>
                  <th className="px-4 sm:px-6 py-3">연락처</th>
                  <th className="px-4 sm:px-6 py-3">잔여 횟수</th>
                  <th className="px-4 sm:px-6 py-3 hidden md:table-cell">가장 가까운 만료일</th>
                  <th className="px-4 sm:px-6 py-3">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 sm:px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      {searchTerm || statusFilter !== 'ALL' ? '검색 결과가 없습니다.' : '등록된 학생이 없습니다.'}
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => {
                    const status = getStudentStatus(student);
                    const remaining = getTotalRemaining(student);
                    const nearestExpiry = getNearestExpiry(student);

                    return (
                      <tr
                        key={student.id}
                        className="hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedStudent(student);
                          setShowDetailModal(true);
                        }}
                      >
                        <td className="px-4 sm:px-6 py-4 font-bold text-gray-800 dark:text-white">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-700 flex-shrink-0 overflow-hidden flex items-center justify-center">
                              {student.profile_image ? (
                                <img src={student.profile_image} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <User size={14} className="text-neutral-400" />
                              )}
                            </div>
                            <span>{student.name || student.nickname || '-'}</span>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-gray-600 dark:text-gray-400">
                          {student.phone ? formatPhoneDisplay(student.phone) : '-'}
                        </td>
                        <td className="px-4 sm:px-6 py-4">
                          <span
                            className={`font-bold ${
                              remaining <= 3
                                ? 'text-red-500 dark:text-red-400'
                                : 'text-blue-600 dark:text-blue-400'
                            }`}
                          >
                            {remaining}회
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-4 hidden md:table-cell text-gray-600 dark:text-gray-400 text-sm">
                          {nearestExpiry
                            ? new Date(nearestExpiry).toLocaleDateString('ko-KR')
                            : '-'}
                        </td>
                        <td className="px-4 sm:px-6 py-4">
                          <StatusBadge status={status} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 sm:p-4 border-t dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span>페이지당</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded text-sm text-gray-700 dark:text-gray-300"
              >
                {ITEMS_PER_PAGE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}명</option>
                ))}
              </select>
              <span className="text-xs">
                (전체 {totalCount}명{statusFilter !== 'ALL' ? ` · ${statusFilter} ${filteredStudents.length}명` : ''})
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1 || loading}
                className="w-8 h-8 flex items-center justify-center text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                «
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || loading}
                className="w-8 h-8 flex items-center justify-center text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ‹
              </button>
              <span className="px-3 py-1 text-sm text-gray-900 dark:text-white font-medium">
                {currentPage} / {totalPages || 1}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || loading}
                className="w-8 h-8 flex items-center justify-center text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ›
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages || loading}
                className="w-8 h-8 flex items-center justify-center text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                »
              </button>
            </div>
          </div>
        </div>
      </div>

      {showRegisterModal && (
        <StudentRegisterModal
          academyId={academyId}
          onClose={() => {
            setShowRegisterModal(false);
            reloadAll();
          }}
        />
      )}

      {showDetailModal && selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          academyId={academyId}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedStudent(null);
            loadStudents();
          }}
        />
      )}
    </>
  );
}
