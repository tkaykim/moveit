"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, Download, User, Users, Calendar, X, RefreshCw, Loader2, Clock, MapPin, UserPlus, ChevronDown } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { BookingStatusBadge } from '@/components/common/booking-status-badge';
import { EnrollmentActionMenu } from './enrollments/enrollment-action-menu';
import { AdminAddEnrollmentModal } from './enrollments/admin-add-enrollment-modal';
import { convertKSTInputToUTC } from '@/lib/utils/kst-time';

interface EnrollmentsViewProps {
  academyId: string;
}

type EnrollmentWithRelations = any & {
  users: any | null;
  schedules: any | null;
  user_tickets: any | null;
};

type StatusFilter = 'ALL' | 'CONFIRMED' | 'PENDING' | 'CANCELLED' | 'COMPLETED';

const STATUS_TABS: { value: StatusFilter; label: string; color: string }[] = [
  { value: 'ALL', label: '전체', color: 'bg-primary dark:bg-[#CCFF00] text-black' },
  { value: 'CONFIRMED', label: '확정', color: 'bg-green-600 text-white' },
  { value: 'PENDING', label: '대기', color: 'bg-yellow-500 text-white' },
  { value: 'COMPLETED', label: '출석완료', color: 'bg-blue-600 text-white' },
  { value: 'CANCELLED', label: '취소', color: 'bg-red-600 text-white' },
];

export function EnrollmentsView({ academyId }: EnrollmentsViewProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialScheduleId = searchParams.get('schedule_id');
  const initialDate = searchParams.get('date') || '';
  const initialClassId = searchParams.get('class_id');

  const [enrollments, setEnrollments] = useState<EnrollmentWithRelations[]>([]);
  const [initialLoading, setInitialLoading] = useState(true); // 초기 로딩 (전체 화면 로딩)
  const [isRefreshing, setIsRefreshing] = useState(false); // 필터 변경 시 로딩 (인라인 로딩)
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(initialScheduleId);
  const [scheduleSummary, setScheduleSummary] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(initialClassId);
  const [allClasses, setAllClasses] = useState<{ id: string; title: string }[]>([]);
  const [classesOnSelectedDate, setClassesOnSelectedDate] = useState<{ id: string; title: string }[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({
    ALL: 0,
    CONFIRMED: 0,
    PENDING: 0,
    CANCELLED: 0,
    COMPLETED: 0,
  });
  const [isAdminAddModalOpen, setIsAdminAddModalOpen] = useState(false);
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [classSearchTerm, setClassSearchTerm] = useState('');
  const classDropdownRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = useRef(true);

  // 클래스 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (classDropdownRef.current && !classDropdownRef.current.contains(event.target as Node)) {
        setIsClassDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 학원의 전체 클래스(반) 목록 로드
  useEffect(() => {
    if (!academyId) {
      setAllClasses([]);
      return;
    }
    const supabase = getSupabaseClient() as any;
    if (!supabase) return;

    (async () => {
      const { data: classesData } = await supabase
        .from('classes')
        .select('id, title')
        .eq('academy_id', academyId)
        .order('title', { ascending: true });
      setAllClasses(
        (classesData || []).map((c: any) => ({ id: c.id, title: c.title || '(제목 없음)' }))
      );
    })();
  }, [academyId]);

  // 날짜 선택 시 해당 날짜에 수업이 있는 클래스 목록 (class 기준 하나씩) — 4-A
  useEffect(() => {
    if (!selectedDate || !academyId) {
      setClassesOnSelectedDate([]);
      return;
    }
    const supabase = getSupabaseClient() as any;
    if (!supabase) return;

    const startKST = `${selectedDate}T00:00`;
    const endKST = `${selectedDate}T23:59`;
    const startUTC = convertKSTInputToUTC(startKST);
    const endUTC = convertKSTInputToUTC(endKST);
    if (!startUTC || !endUTC) {
      setClassesOnSelectedDate([]);
      return;
    }
    const endUTCWithSeconds = new Date(endUTC);
    endUTCWithSeconds.setSeconds(59, 999);

    (async () => {
      const { data: classesData } = await supabase.from('classes').select('id').eq('academy_id', academyId);
      const classIds = classesData?.map((c: any) => c.id) || [];
      if (classIds.length === 0) {
        setClassesOnSelectedDate([]);
        return;
      }
      const { data: schedules } = await supabase
        .from('schedules')
        .select('class_id, classes(id, title)')
        .in('class_id', classIds)
        .eq('is_canceled', false)
        .gte('start_time', startUTC)
        .lte('start_time', endUTCWithSeconds.toISOString());
      const byClass = new Map<string, string>();
      (schedules || []).forEach((s: any) => {
        const c = s.classes;
        if (c?.id && c?.title && !byClass.has(c.id)) byClass.set(c.id, c.title);
      });
      setClassesOnSelectedDate(Array.from(byClass.entries()).map(([id, title]) => ({ id, title })));
    })();
  }, [academyId, selectedDate]);

  const loadEnrollments = useCallback(async () => {
    // 초기 로딩인지 필터 변경인지 구분
    if (isFirstLoad.current) {
      setInitialLoading(true);
    } else {
      setIsRefreshing(true);
    }
    const supabase = getSupabaseClient() as any;
    if (!supabase) {
      setInitialLoading(false);
      setIsRefreshing(false);
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
        setStatusCounts({ ALL: 0, CONFIRMED: 0, PENDING: 0, CANCELLED: 0, COMPLETED: 0 });
        setInitialLoading(false);
        setIsRefreshing(false);
        isFirstLoad.current = false;
        return;
      }

      // 기본 쿼리 (상태별 카운트용)
      let baseQuery = supabase
        .from('bookings')
        .select('status', { count: 'exact' });

      if (selectedScheduleId) {
        baseQuery = baseQuery.eq('schedule_id', selectedScheduleId);
      } else {
        const effectiveClassIds = selectedClassId ? [selectedClassId] : classIds;
        baseQuery = baseQuery.in('class_id', effectiveClassIds);

        if (selectedDate) {
          const startKST = `${selectedDate}T00:00`;
          const endKST = `${selectedDate}T23:59`;
          const startUTC = convertKSTInputToUTC(startKST);
          const endUTC = convertKSTInputToUTC(endKST);

          if (startUTC && endUTC) {
            const endUTCWithSeconds = new Date(endUTC);
            endUTCWithSeconds.setSeconds(59, 999);
            baseQuery = baseQuery.gte('schedules.start_time', startUTC).lte('schedules.start_time', endUTCWithSeconds.toISOString());
          }
        }
      }

      // 상태별 카운트 조회
      const { data: allStatusData } = await baseQuery;
      const counts: Record<string, number> = {
        ALL: allStatusData?.length || 0,
        CONFIRMED: allStatusData?.filter((b: any) => b.status === 'CONFIRMED').length || 0,
        PENDING: allStatusData?.filter((b: any) => b.status === 'PENDING').length || 0,
        CANCELLED: allStatusData?.filter((b: any) => b.status === 'CANCELLED').length || 0,
        COMPLETED: allStatusData?.filter((b: any) => b.status === 'COMPLETED').length || 0,
      };
      setStatusCounts(counts);

      // 메인 쿼리
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
        `, { count: 'exact' });

      // 필터 적용
      if (selectedScheduleId) {
        query = query.eq('schedule_id', selectedScheduleId);
      } else {
        const effectiveClassIds = selectedClassId ? [selectedClassId] : classIds;
        query = query.in('class_id', effectiveClassIds);

        if (selectedDate) {
          const startKST = `${selectedDate}T00:00`;
          const endKST = `${selectedDate}T23:59`;
          const startUTC = convertKSTInputToUTC(startKST);
          const endUTC = convertKSTInputToUTC(endKST);

          if (startUTC && endUTC) {
            const endUTCWithSeconds = new Date(endUTC);
            endUTCWithSeconds.setSeconds(59, 999);
            query = query.gte('schedules.start_time', startUTC).lte('schedules.start_time', endUTCWithSeconds.toISOString());
          }
        }
      }

      if (statusFilter !== 'ALL') {
        query = query.eq('status', statusFilter);
      }

      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        query = query.or(`users.name.ilike.%${search}%,users.email.ilike.%${search}%,users.phone.ilike.%${search}%,guest_name.ilike.%${search}%,guest_phone.ilike.%${search}%,schedules.classes.title.ilike.%${search}%`);
      }

      query = query.order('created_at', { ascending: false });

      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;
      setEnrollments(data || []);
      setTotalCount(count || 0);

      // 수업별 요약 정보 로드
      if (selectedScheduleId) {
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
          .single();

        const isValidSchedule = scheduleData?.classes?.academy_id === academyId;

        if (!scheduleError && scheduleData && isValidSchedule) {
          const allBookingsQuery = supabase
            .from('bookings')
            .select('status')
            .eq('schedule_id', selectedScheduleId);

          const { data: allBookingsData } = await allBookingsQuery;

          const confirmedCount = allBookingsData?.filter((b: any) =>
            b.status === 'CONFIRMED' || b.status === 'COMPLETED'
          ).length || 0;
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
      setInitialLoading(false);
      setIsRefreshing(false);
      isFirstLoad.current = false;
    }
  }, [academyId, selectedScheduleId, selectedClassId, statusFilter, searchTerm, currentPage, itemsPerPage, selectedDate]);

  useEffect(() => {
    loadEnrollments();
  }, [loadEnrollments]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatScheduleTime = (schedule: any) => {
    if (!schedule?.start_time) return '-';
    const date = new Date(schedule.start_time);
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleStatusChange = async (
    bookingId: string,
    newStatus: string,
    options?: { restoreTicket?: boolean }
  ) => {
    try {
      const body: { status: string; restoreTicket?: boolean } = { status: newStatus };
      if (options?.restoreTicket !== undefined) body.restoreTicket = options.restoreTicket;
      const response = await fetch(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '상태 변경에 실패했습니다.');
      }

      const statusMessages: Record<string, string> = {
        CONFIRMED: '예약이 확정되었습니다.',
        COMPLETED: '출석 처리가 완료되었습니다.',
        CANCELLED: '예약이 취소되었습니다.',
        PENDING: '예약이 대기 상태로 변경되었습니다.',
      };

      alert(statusMessages[newStatus] || '상태가 변경되었습니다.');
      await loadEnrollments();
    } catch (error: any) {
      console.error('Error changing booking status:', error);
      throw error;
    }
  };

  const handleDelete = async (bookingId: string) => {
    try {
      const supabase = getSupabaseClient() as any;
      if (!supabase) {
        throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
      }

      const { data: booking } = await supabase
        .from('bookings')
        .select('schedule_id, status')
        .eq('id', bookingId)
        .single();

      const { error: deleteError } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId);

      if (deleteError) throw deleteError;

      if (booking?.schedule_id) {
        const { data: confirmedBookings } = await supabase
          .from('bookings')
          .select('id')
          .eq('schedule_id', booking.schedule_id)
          .in('status', ['CONFIRMED', 'COMPLETED']);

        const totalCount = confirmedBookings?.length || 0;

        await supabase
          .from('schedules')
          .update({ current_students: totalCount })
          .eq('id', booking.schedule_id);
      }

      alert('예약이 삭제되었습니다.');
      await loadEnrollments();
    } catch (error: any) {
      console.error('Error deleting booking:', error);
      throw error;
    }
  };

  const clearFilters = () => {
    setSelectedDate('');
    setSelectedScheduleId(null);
    setSelectedClassId(null);
    setStatusFilter('ALL');
    setSearchTerm('');
    setCurrentPage(1);
    router.push(`/academy-admin/${academyId}/enrollments`);
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const hasFilters = selectedDate || selectedScheduleId || selectedClassId || statusFilter !== 'ALL' || searchTerm;

  return (
    <div className="space-y-6" data-onboarding="page-enrollments-0">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">출석/신청 관리</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            날짜·수업별 신청인원을 확인하고 출석을 관리할 수 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAdminAddModalOpen(true)}
            className="px-4 py-2 bg-primary dark:bg-[#CCFF00] text-black rounded-lg hover:opacity-90 flex items-center gap-2 text-sm font-medium transition-colors"
            data-onboarding="page-enrollments-add"
          >
            <UserPlus size={16} />
            수기 추가
          </button>
          <button
            onClick={loadEnrollments}
            disabled={isRefreshing}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50"
            title="새로고침"
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => {
              alert('엑셀 다운로드 기능은 추후 구현 예정입니다.');
            }}
            className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <Download size={16} />
            다운로드
          </button>
        </div>
      </div>

      {/* 필터 영역 */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-100 dark:border-neutral-800 shadow-sm">
        {/* 선택된 수업 요약 바 */}
        {scheduleSummary && (
          <div className="px-4 py-3 bg-gradient-to-r from-primary/5 to-transparent dark:from-[#CCFF00]/5 border-b border-gray-100 dark:border-neutral-800">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {scheduleSummary.schedule.classes?.title}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {scheduleSummary.schedule.instructors && (
                      <span>{scheduleSummary.schedule.instructors.name_kr || scheduleSummary.schedule.instructors.name_en}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {new Date(scheduleSummary.schedule.start_time).toLocaleString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {scheduleSummary.schedule.halls && (
                      <span className="flex items-center gap-1">
                        <MapPin size={11} />
                        {scheduleSummary.schedule.halls.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {scheduleSummary.max_students > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700">
                    <span className="text-xs text-gray-500 dark:text-gray-400">정원</span>
                    <span className={`text-sm font-bold ${
                      scheduleSummary.confirmed_count >= scheduleSummary.max_students
                        ? 'text-red-600 dark:text-red-400'
                        : scheduleSummary.confirmed_count >= scheduleSummary.max_students * 0.8
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-green-600 dark:text-green-400'
                    }`}>
                      {scheduleSummary.confirmed_count}/{scheduleSummary.max_students}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <span className="text-xs text-green-600 dark:text-green-400">확정</span>
                  <span className="text-sm font-bold text-green-700 dark:text-green-400">{scheduleSummary.confirmed_count}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <span className="text-xs text-yellow-600 dark:text-yellow-400">대기</span>
                  <span className="text-sm font-bold text-yellow-700 dark:text-yellow-400">{scheduleSummary.pending_count}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <span className="text-xs text-red-600 dark:text-red-400">취소</span>
                  <span className="text-sm font-bold text-red-700 dark:text-red-400">{scheduleSummary.cancelled_count}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 상태 필터 탭 */}
        <div className="flex items-center gap-2 p-4 border-b border-gray-100 dark:border-neutral-800">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setStatusFilter(tab.value);
                setCurrentPage(1);
              }}
              disabled={isRefreshing}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-70 ${
                statusFilter === tab.value
                  ? tab.color
                  : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
              }`}
            >
              {tab.label} ({statusCounts[tab.value] || 0})
            </button>
          ))}
          {isRefreshing && (
            <Loader2 size={16} className="animate-spin text-gray-400 ml-2" />
          )}
        </div>

        {/* 검색 및 필터 */}
        <div className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* 검색 */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">검색</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="이름, 연락처, 수업명으로 검색..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00]"
                />
              </div>
            </div>

            {/* 날짜 선택 */}
            <div className="w-44">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">날짜</label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setSelectedScheduleId(null);
                    setSelectedClassId(null);
                    setClassesOnSelectedDate([]);
                    setCurrentPage(1);
                    if (e.target.value) {
                      router.push(`/academy-admin/${academyId}/enrollments?date=${e.target.value}`);
                    } else {
                      router.push(`/academy-admin/${academyId}/enrollments`);
                    }
                  }}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00]"
                />
              </div>
            </div>

            {/* 수업(반) 선택: 검색+드롭다운 */}
            <div className="w-72">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">수업(반)</label>
              <div className="relative" ref={classDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsClassDropdownOpen(!isClassDropdownOpen);
                    setClassSearchTerm('');
                  }}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-left flex items-center justify-between hover:border-primary dark:hover:border-[#CCFF00] transition-colors"
                >
                  <span className="text-sm text-gray-900 dark:text-white truncate">
                    {selectedClassId
                      ? (selectedDate ? classesOnSelectedDate : allClasses).find(c => c.id === selectedClassId)?.title || '수업 선택'
                      : '전체 수업'}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-gray-400 transition-transform flex-shrink-0 ml-1 ${isClassDropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {isClassDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-lg max-h-80 overflow-hidden">
                    {/* 검색 입력 */}
                    <div className="p-2 border-b border-gray-200 dark:border-neutral-700">
                      <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="수업명 검색..."
                          value={classSearchTerm}
                          onChange={(e) => setClassSearchTerm(e.target.value)}
                          className="w-full pl-8 pr-7 py-1.5 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00]"
                          autoFocus
                        />
                        {classSearchTerm && (
                          <button
                            onClick={() => setClassSearchTerm('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 목록 */}
                    <div className="overflow-y-auto max-h-60">
                      <button
                        onClick={() => {
                          setSelectedClassId(null);
                          setSelectedScheduleId(null);
                          setCurrentPage(1);
                          setIsClassDropdownOpen(false);
                          setClassSearchTerm('');
                          const params = new URLSearchParams();
                          if (selectedDate) params.set('date', selectedDate);
                          const queryString = params.toString();
                          router.push(`/academy-admin/${academyId}/enrollments${queryString ? `?${queryString}` : ''}`);
                        }}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors ${
                          !selectedClassId ? 'bg-primary/10 dark:bg-[#CCFF00]/10 font-medium text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        전체 수업
                      </button>
                      {(() => {
                        const classList = selectedDate ? classesOnSelectedDate : allClasses;
                        const filtered = classSearchTerm
                          ? classList.filter(c => c.title.toLowerCase().includes(classSearchTerm.toLowerCase()))
                          : classList;

                        if (filtered.length === 0) {
                          return (
                            <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                              {classSearchTerm ? '검색 결과가 없습니다.' : '등록된 수업이 없습니다.'}
                            </div>
                          );
                        }

                        return filtered.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setSelectedClassId(c.id);
                              setSelectedScheduleId(null);
                              setCurrentPage(1);
                              setIsClassDropdownOpen(false);
                              setClassSearchTerm('');
                              const params = new URLSearchParams();
                              if (selectedDate) params.set('date', selectedDate);
                              params.set('class_id', c.id);
                              router.push(`/academy-admin/${academyId}/enrollments?${params.toString()}`);
                            }}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors ${
                              selectedClassId === c.id
                                ? 'bg-primary/10 dark:bg-[#CCFF00]/10 font-medium text-gray-900 dark:text-white'
                                : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {c.title}
                          </button>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 필터 초기화 */}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <X size={14} />
                초기화
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-100 dark:border-neutral-800 shadow-sm overflow-hidden relative">
        {/* 인라인 로딩 오버레이 (필터 변경 시) */}
        {isRefreshing && !initialLoading && (
          <div className="absolute inset-0 bg-white/60 dark:bg-neutral-900/60 z-10 flex items-center justify-center">
            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-gray-200 dark:border-neutral-700">
              <Loader2 size={16} className="animate-spin text-primary dark:text-[#CCFF00]" />
              <span className="text-sm text-gray-600 dark:text-gray-300">불러오는 중...</span>
            </div>
          </div>
        )}

        {initialLoading ? (
          <div className="p-16 text-center">
            <div className="inline-block w-8 h-8 border-2 border-gray-300 border-t-primary dark:border-neutral-600 dark:border-t-[#CCFF00] rounded-full animate-spin mb-4" />
            <p className="text-gray-500 dark:text-gray-400">로딩 중...</p>
          </div>
        ) : enrollments.length === 0 ? (
          <div className="p-16 text-center">
            <Users className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              {hasFilters ? '검색 결과가 없습니다.' : '신청 내역이 없습니다.'}
            </p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-primary dark:text-[#CCFF00] hover:underline"
              >
                필터 초기화
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-neutral-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-12">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      신청인
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      수업
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      수강권
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                      상태
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">
                      신청일시
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-20">

                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                  {enrollments.map((enrollment, index) => {
                    const user = enrollment.users;
                    const schedule = enrollment.schedules;
                    const classData = schedule?.classes;
                    const instructor = schedule?.instructors;

                    // 4-C: 관리자 수기 추가 = 게스트, 비로그인 신청 = 비회원
                    const isAdminAdded = enrollment.is_admin_added === true;
                    const isNonMember = !user && (enrollment.guest_name || enrollment.guest_phone);
                    const isGuest = isAdminAdded;
                    const showAsNonMember = isNonMember && !isAdminAdded;
                    const displayName = user?.name || enrollment.guest_name || '-';
                    const displayPhone = user?.phone || enrollment.guest_phone || '-';

                    const rowNumber = (currentPage - 1) * itemsPerPage + index + 1;

                    return (
                      <tr key={enrollment.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {rowNumber}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-neutral-700 flex items-center justify-center flex-shrink-0">
                              <User size={16} className="text-gray-400" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {displayName}
                                </span>
                                {isGuest && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded font-medium">
                                    게스트
                                  </span>
                                )}
                                {showAsNonMember && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 rounded font-medium">
                                    비회원
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {displayPhone}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {classData ? (
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {classData.title}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                {instructor && (
                                  <span>{instructor.name_kr || instructor.name_en}</span>
                                )}
                                {instructor && schedule?.start_time && <span>·</span>}
                                {schedule?.start_time && (
                                  <span>{formatScheduleTime(schedule)}</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {enrollment.is_admin_added ? (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                              관리자 권한
                            </span>
                          ) : enrollment.user_tickets?.tickets ? (
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[180px]">
                                {enrollment.user_tickets.tickets.name || '-'}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 flex-wrap">
                                {enrollment.user_tickets.tickets.ticket_type === 'PERIOD' ? (
                                  <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-[10px] font-medium">
                                    기간권
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded text-[10px] font-medium">
                                    횟수권
                                  </span>
                                )}
                                {/* 잔여 횟수 표시 (횟수권) */}
                                {enrollment.user_tickets.tickets.ticket_type === 'COUNT' && enrollment.user_tickets.remaining_count != null && (
                                  <span className="font-medium">
                                    잔여 {enrollment.user_tickets.remaining_count}회
                                  </span>
                                )}
                                {/* 만료일 표시 */}
                                {enrollment.user_tickets.expiry_date && (
                                  <span>
                                    ~{new Date(enrollment.user_tickets.expiry_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                                  </span>
                                )}
                                {/* 수강권 상태 */}
                                {enrollment.user_tickets.status && enrollment.user_tickets.status !== 'ACTIVE' && (
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    enrollment.user_tickets.status === 'EXPIRED' 
                                      ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' 
                                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                                  }`}>
                                    {enrollment.user_tickets.status === 'EXPIRED' ? '만료' : enrollment.user_tickets.status === 'USED' ? '소진' : enrollment.user_tickets.status}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <BookingStatusBadge status={enrollment.status || ''} />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(enrollment.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
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
            <div className="px-4 py-3 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                총 <span className="font-medium text-gray-900 dark:text-white">{totalCount}</span>건
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded text-sm text-gray-700 dark:text-gray-300"
                  >
                    <option value={10}>10개</option>
                    <option value={20}>20개</option>
                    <option value={50}>50개</option>
                    <option value={100}>100개</option>
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="w-8 h-8 flex items-center justify-center text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    «
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="w-8 h-8 flex items-center justify-center text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    ‹
                  </button>
                  <span className="px-3 py-1 text-sm text-gray-900 dark:text-white font-medium">
                    {currentPage} / {totalPages || 1}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="w-8 h-8 flex items-center justify-center text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    ›
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage >= totalPages}
                    className="w-8 h-8 flex items-center justify-center text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    »
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <AdminAddEnrollmentModal
        isOpen={isAdminAddModalOpen}
        onClose={() => setIsAdminAddModalOpen(false)}
        onSuccess={loadEnrollments}
        academyId={academyId}
        initialScheduleId={selectedScheduleId}
        dateFilter={selectedDate || undefined}
      />
    </div>
  );
}
