"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, Download, User } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { BookingStatusBadge } from '@/components/common/booking-status-badge';
import { ScheduleSelector } from '@/components/common/schedule-selector';
import { ScheduleSummaryCard } from '@/components/common/schedule-summary-card';
import { EnrollmentActionMenu } from './enrollments/enrollment-action-menu';

interface EnrollmentsViewProps {
  academyId: string;
}

type EnrollmentWithRelations = any & {
  users: any | null;
  schedules: any | null;
  user_tickets: any | null;
};

export function EnrollmentsView({ academyId }: EnrollmentsViewProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialScheduleId = searchParams.get('schedule_id');

  const [enrollments, setEnrollments] = useState<EnrollmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(initialScheduleId);
  const [scheduleSummary, setScheduleSummary] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  const loadEnrollments = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabaseClient() as any;
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      // 해당 학원의 클래스 ID 목록 가져오기
      const { data: classesData } = await supabase
        .from('classes')
        .select('id')
        .eq('academy_id', academyId);

      const classIds = classesData?.map((c: any) => c.id) || [];

      if (classIds.length === 0) {
        setEnrollments([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      // 클라이언트 사이드에서는 직접 쿼리
      // class_id로 직접 필터링 (대부분의 예약이 class_id를 가지고 있음)
      // class_id가 null인 경우는 schedule_id를 통해 schedules.class_id로 필터링됨
      let query = supabase
        .from('bookings')
        .select(`
          *,
          users (*),
          schedules (
            *,
            classes (
              *,
              academies (*)
            ),
            instructors (*),
            halls (*)
          ),
          user_tickets (
            *,
            tickets (*)
          )
        `, { count: 'exact' })
        .in('class_id', classIds);

      // 필터 적용
      if (selectedScheduleId) {
        query = query.eq('schedule_id', selectedScheduleId);
      }
      if (statusFilter !== 'ALL') {
        query = query.eq('status', statusFilter);
      }

      // 검색어 필터 (게스트 이름, 연락처도 포함)
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        query = query.or(`users.name.ilike.%${search}%,users.email.ilike.%${search}%,users.phone.ilike.%${search}%,guest_name.ilike.%${search}%,guest_phone.ilike.%${search}%,schedules.classes.title.ilike.%${search}%`);
      }

      // 정렬
      query = query.order('created_at', { ascending: false });

      // 페이지네이션
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;
      setEnrollments(data || []);
      setTotalCount(count || 0);

      // 수업별 요약 정보 로드
      if (selectedScheduleId) {
        // 스케줄 정보 조회 (해당 학원의 스케줄인지 확인)
        const { data: scheduleData, error: scheduleError } = await supabase
          .from('schedules')
          .select(`
            *,
            classes (
              *,
              academies (*)
            ),
            instructors (*),
            halls (*)
          `)
          .eq('id', selectedScheduleId)
          .eq('classes.academy_id', academyId)
          .single();

        if (!scheduleError && scheduleData) {
          // 신청인원 통계 (전체 데이터에서 계산)
          const allBookingsQuery = supabase
            .from('bookings')
            .select('status')
            .eq('schedule_id', selectedScheduleId);
          
          const { data: allBookingsData } = await allBookingsQuery;
          
          const confirmedCount = allBookingsData?.filter((b: any) => b.status === 'CONFIRMED').length || 0;
          const pendingCount = allBookingsData?.filter((b: any) => b.status === 'PENDING').length || 0;
          const cancelledCount = allBookingsData?.filter((b: any) => b.status === 'CANCELLED').length || 0;
          const totalEnrollments = allBookingsData?.length || 0;

          setScheduleSummary({
            schedule: scheduleData,
            total_enrollments: totalEnrollments,
            confirmed_count: confirmedCount,
            pending_count: pendingCount,
            cancelled_count: cancelledCount,
            max_students: scheduleData.max_students || 0,
            remaining_spots: Math.max(0, (scheduleData.max_students || 0) - confirmedCount),
          });
        } else {
          setScheduleSummary(null);
        }
      } else {
        setScheduleSummary(null);
      }
    } catch (error) {
      console.error('Error loading enrollments:', error);
      alert('신청 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [academyId, selectedScheduleId, statusFilter, searchTerm, currentPage, itemsPerPage]);

  useEffect(() => {
    loadEnrollments();
  }, [loadEnrollments]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPaymentMethod = (ticket: any) => {
    if (!ticket) return '-';
    const ticketType = ticket.ticket_type;
    if (ticketType === 'CARD') return '카드';
    if (ticketType === 'CASH') return '현금';
    if (ticketType === 'BANK_TRANSFER') return '계좌이체';
    if (ticketType === 'MOBILE') return '간편결제';
    return ticketType || '-';
  };

  // 예약 상태 변경 핸들러
  const handleStatusChange = async (bookingId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '상태 변경에 실패했습니다.');
      }

      // 성공 메시지
      const statusMessages: Record<string, string> = {
        CONFIRMED: '예약이 확정되었습니다.',
        COMPLETED: '출석 처리가 완료되었습니다.',
        CANCELLED: '예약이 취소되었습니다.',
        PENDING: '예약이 대기 상태로 변경되었습니다.',
      };

      alert(statusMessages[newStatus] || '상태가 변경되었습니다.');

      // 데이터 새로고침
      await loadEnrollments();
    } catch (error: any) {
      console.error('Error changing booking status:', error);
      throw error;
    }
  };

  // 예약 삭제 핸들러 (선택적)
  const handleDelete = async (bookingId: string) => {
    try {
      const supabase = getSupabaseClient() as any;
      if (!supabase) {
        throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
      }

      // 예약 정보 조회 (schedule_id 확인용)
      const { data: booking } = await supabase
        .from('bookings')
        .select('schedule_id, status')
        .eq('id', bookingId)
        .single();

      // 예약 삭제
      const { error: deleteError } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId);

      if (deleteError) throw deleteError;

      // schedules.current_students 업데이트
      if (booking?.schedule_id) {
        const { count: confirmedCount } = await supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .eq('schedule_id', booking.schedule_id)
          .eq('status', 'CONFIRMED');

        await supabase
          .from('schedules')
          .update({ current_students: confirmedCount || 0 })
          .eq('id', booking.schedule_id);
      }

      alert('예약이 삭제되었습니다.');
      await loadEnrollments();
    } catch (error: any) {
      console.error('Error deleting booking:', error);
      throw error;
    }
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <div>
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">신청 목록</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            수업별 신청인원을 확인하고 관리할 수 있습니다.
          </p>
        </div>
        <button
          onClick={() => {
            // 엑셀 다운로드 (추후 구현)
            alert('엑셀 다운로드 기능은 추후 구현 예정입니다.');
          }}
          className="px-4 py-2 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-700 flex items-center gap-2"
        >
          <Download size={18} />
          엑셀 다운로드
        </button>
      </div>

      {/* 수업별 현황 요약 카드 */}
      {scheduleSummary && (
        <div className="mb-6">
          <ScheduleSummaryCard
            schedule={scheduleSummary.schedule}
            totalEnrollments={scheduleSummary.total_enrollments}
            confirmedCount={scheduleSummary.confirmed_count}
            pendingCount={scheduleSummary.pending_count}
            cancelledCount={scheduleSummary.cancelled_count}
          />
        </div>
      )}

      {/* 검색 및 필터링 */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 border border-neutral-200 dark:border-neutral-800 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          {/* 검색 바 */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="검색어를 입력해 주세요..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00]"
              />
            </div>
          </div>

          {/* 수업 선택 */}
          <div className="w-64">
            <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">수업</label>
            <ScheduleSelector
              value={selectedScheduleId || undefined}
              academyId={academyId}
              onChange={(id) => {
                setSelectedScheduleId(id);
                setCurrentPage(1);
                // URL 업데이트
                if (id) {
                  router.push(`/academy-admin/${academyId}/enrollments?schedule_id=${id}`);
                } else {
                  router.push(`/academy-admin/${academyId}/enrollments`);
                }
              }}
            />
          </div>

          {/* 상태 필터 */}
          <div>
            <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">상태</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00]"
            >
              <option value="ALL">전체</option>
              <option value="CONFIRMED">구입승인</option>
              <option value="PENDING">대기중</option>
              <option value="CANCELLED">신청취소</option>
              <option value="COMPLETED">출석완료</option>
            </select>
          </div>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-neutral-500 dark:text-neutral-400">로딩 중...</div>
        ) : enrollments.length === 0 ? (
          <div className="p-12 text-center text-neutral-500 dark:text-neutral-400">
            신청 내역이 없습니다.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-100 dark:bg-neutral-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                      번호
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                      신청인
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                      연락처
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                      티켓옵션
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                      티켓 수
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                      결제 금액
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                      결제 수단
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                      출석
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                      예매일시
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {enrollments.map((enrollment, index) => {
                    const user = enrollment.users;
                    const schedule = enrollment.schedules;
                    const userTicket = enrollment.user_tickets?.[0];
                    const ticket = userTicket?.tickets;
                    const classData = schedule?.classes;
                    const instructor = schedule?.instructors;

                    // 게스트 예약인지 일반 사용자 예약인지 확인
                    const isGuest = !user && (enrollment.guest_name || enrollment.guest_phone);
                    const displayName = user?.name || enrollment.guest_name || '-';
                    const displayPhone = user?.phone || enrollment.guest_phone || '-';
                    const displayEmail = user?.email || null;

                    const rowNumber = (currentPage - 1) * itemsPerPage + index + 1;

                    return (
                      <tr key={enrollment.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                          {rowNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center">
                              <User size={16} className="text-neutral-500" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-medium text-black dark:text-white">
                                  {displayName}
                                </div>
                                {isGuest && (
                                  <span className="text-xs px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded">
                                    게스트
                                  </span>
                                )}
                              </div>
                              {displayEmail && (
                                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                                  {displayEmail}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                          {displayPhone}
                        </td>
                        <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">
                          {classData ? (
                            <div>
                              <div>{classData.title}</div>
                              {instructor && (
                                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                                  {instructor.name_kr || instructor.name_en || ''}
                                </div>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                          1
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <BookingStatusBadge status={enrollment.status || ''} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                          {ticket?.price ? `${ticket.price.toLocaleString()}원` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                          {getPaymentMethod(ticket)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                          -
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                          {enrollment.status === 'COMPLETED' ? (
                            <span className="text-green-600 dark:text-green-400 font-medium">✓ 출석</span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                          {formatDate(enrollment.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <EnrollmentActionMenu
                            enrollment={enrollment}
                            onStatusChange={handleStatusChange}
                            onDelete={handleDelete}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="text-sm text-neutral-600 dark:text-neutral-400">
                전체 {totalCount}개 중 {Math.min((currentPage - 1) * itemsPerPage + 1, totalCount)}-{Math.min(currentPage * itemsPerPage, totalCount)}개 노출 중입니다.
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">노출 수</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-3 py-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded text-sm text-neutral-700 dark:text-neutral-300"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-2 py-1 text-sm text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    «
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2 py-1 text-sm text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ‹
                  </button>
                  <span className="px-3 py-1 text-sm text-black dark:text-white font-medium">
                    {currentPage}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2 py-1 text-sm text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ›
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-2 py-1 text-sm text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    »
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
