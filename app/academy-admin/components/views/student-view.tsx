"use client";

import { useState, useEffect } from 'react';
import { Search, Filter, Download, MoreHorizontal, Plus } from 'lucide-react';
import { SectionHeader } from '../common/section-header';
import { StatusBadge } from '../common/status-badge';
import { StudentRegisterModal } from './students/student-register-modal';
import { StudentDetailModal } from './students/student-detail-modal';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface StudentViewProps {
  academyId: string;
}

interface Student {
  id: string;
  name?: string | null;
  nickname?: string | null;
  phone?: string | null;
  email?: string | null;
  user_tickets?: Array<{
    id: string;
    remaining_count: number;
    expiry_date?: string | null;
    status: string;
    tickets: {
      id: string;
      name: string;
      ticket_type: string;
    };
  }>;
  bookings?: Array<{
    id: string;
    created_at: string;
    classes: {
      id: string;
      title: string;
    } | null;
  }>;
}

export function StudentView({ academyId }: StudentViewProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    loadStudents();
  }, [academyId]);

  const loadStudents = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      let userIds: string[] = [];

      // academy_students 테이블을 통해 해당 학원의 학생들 조회
      const { data: academyStudents, error: academyStudentsError } = await supabase
        .from('academy_students')
        .select('user_id')
        .eq('academy_id', academyId);

      // academy_students 테이블이 없을 수 있으므로, 에러가 발생하면 기존 방식으로 fallback
      if (academyStudentsError) {
        if (academyStudentsError.code === '42P01') {
          // 테이블이 없으면 기존 방식으로 조회 (user_tickets를 통한 조회)
          console.warn('academy_students 테이블이 없습니다. 기존 방식으로 조회합니다.');
          
          const { data: tickets } = await supabase
            .from('tickets')
            .select('id')
            .eq('academy_id', academyId);

          const ticketIds = tickets?.map((t: any) => t.id) || [];

          if (ticketIds.length === 0) {
            setStudents([]);
            setLoading(false);
            return;
          }

          const { data: userTickets } = await supabase
            .from('user_tickets')
            .select('user_id')
            .in('ticket_id', ticketIds);

          userIds = [...new Set((userTickets?.map((ut: any) => ut.user_id) || []) as string[])];
        } else {
          throw academyStudentsError;
        }
      } else {
        userIds = academyStudents?.map((as: any) => as.user_id) || [];
      }

      if (userIds.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      // 해당 학원의 수강권 정보도 함께 조회
      const { data: tickets } = await supabase
        .from('tickets')
        .select('id')
        .eq('academy_id', academyId);

      const ticketIds = tickets?.map((t: any) => t.id) || [];

      let query = supabase
        .from('users')
        .select(`
          *,
          user_tickets (
            id,
            remaining_count,
            expiry_date,
            status,
            tickets (
              id,
              name,
              ticket_type
            )
          ),
          bookings (
            id,
            status,
            created_at,
            classes (
              id,
              title
            )
          )
        `)
        .in('id', userIds);

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,nickname.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // 클라이언트 측에서 해당 학원의 수강권만 필터링
      const filteredData = (data || []).map((student: any) => {
        if (student.user_tickets && ticketIds.length > 0) {
          student.user_tickets = student.user_tickets.filter((ut: any) => 
            ut.tickets && ticketIds.includes(ut.tickets.id)
          );
        }
        return student;
      });

      setStudents(filteredData);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStudentStatus = (student: Student): string => {
    const tickets = student.user_tickets || [];
    const activeTickets = tickets.filter((t) => t.status === 'ACTIVE' && t.remaining_count > 0);
    
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
      .reduce((sum, t) => sum + t.remaining_count, 0);
  };

  const getLastVisit = (student: Student): string => {
    const bookings = student.bookings || [];
    if (bookings.length === 0) return '-';
    const lastBooking = bookings
      .filter((b) => b.created_at)
      .sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
    if (!lastBooking) return '-';
    return new Date(lastBooking.created_at).toLocaleDateString('ko-KR');
  };

  const filteredStudents = students.filter((student) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      student.name?.toLowerCase().includes(term) ||
      student.phone?.includes(term) ||
      student.nickname?.toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <SectionHeader
          title="학생(회원) 관리"
          buttonText="학생 등록"
          onButtonClick={() => setShowRegisterModal(true)}
        />

        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 overflow-hidden">
          <div className="p-4 border-b dark:border-neutral-800 flex gap-3 bg-gray-50 dark:bg-neutral-800">
            <div className="relative flex-1 max-w-sm">
              <input
                type="text"
                placeholder="이름, 전화번호 검색..."
                className="pl-9 pr-4 py-2 border dark:border-neutral-700 rounded-lg text-sm w-full focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search
                size={16}
                className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500"
              />
            </div>
            <button className="flex items-center gap-2 px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800">
              <Filter size={16} /> 필터
            </button>
            <button className="flex items-center gap-2 px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800">
              <Download size={16} /> 엑셀 다운로드
            </button>
          </div>

          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 font-medium">
              <tr>
                <th className="px-6 py-3">이름</th>
                <th className="px-6 py-3">연락처</th>
                <th className="px-6 py-3">수강 클래스</th>
                <th className="px-6 py-3">잔여 횟수</th>
                <th className="px-6 py-3">최근 방문일</th>
                <th className="px-6 py-3">상태</th>
                <th className="px-6 py-3 text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    {searchTerm ? '검색 결과가 없습니다.' : '등록된 학생이 없습니다.'}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const status = getStudentStatus(student);
                  const remaining = getTotalRemaining(student);
                  const lastVisit = getLastVisit(student);
                  const classType = student.user_tickets?.[0]?.tickets?.name || '-';

                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer group"
                      onClick={() => {
                        setSelectedStudent(student);
                        setShowDetailModal(true);
                      }}
                    >
                      <td className="px-6 py-4 font-bold text-gray-800 dark:text-white">
                        {student.name || student.nickname || '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                        {student.phone || '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{classType}</td>
                      <td className="px-6 py-4">
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
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{lastVisit}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStudent(student);
                            setShowDetailModal(true);
                          }}
                          className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal size={20} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {filteredStudents.length > 0 && (
            <div className="p-4 border-t dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800 text-center text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700 cursor-pointer transition-colors">
              더 보기 ({filteredStudents.length} / {students.length})
            </div>
          )}
        </div>
      </div>

      {showRegisterModal && (
        <StudentRegisterModal
          academyId={academyId}
          onClose={() => {
            setShowRegisterModal(false);
            loadStudents();
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
