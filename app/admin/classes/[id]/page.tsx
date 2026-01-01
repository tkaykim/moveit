"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { Class, Academy, Branch, Hall, Instructor, Schedule, Booking, User, UserTicket, Ticket } from '@/lib/supabase/types';

type BookingWithFullDetails = Booking & {
  users: User | null;
  user_tickets: (UserTicket & {
    tickets: Ticket | null;
  }) | null;
  schedules: (Schedule & {
    branches: Branch | null;
    halls: Hall | null;
    instructors: Instructor | null;
  }) | null;
} | any;

type ClassWithRelations = Class & {
  academies: Academy | null;
  instructors: Instructor | null;
  schedules: (Schedule & {
    branches: Branch | null;
    halls: Hall | null;
    instructors: Instructor | null;
  })[];
};

export default function ClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.id as string;
  
  const [classData, setClassData] = useState<ClassWithRelations | null>(null);
  const [bookings, setBookings] = useState<BookingWithFullDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (classId) {
      loadClassData();
    }
  }, [classId]);

  const loadClassData = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      // 클래스 정보 로드
      const { data: classRes, error: classError } = await (supabase as any)
        .from('classes')
        .select(`
          *,
          academies(*),
          instructors(*),
          schedules(
            *,
            branches(*),
            halls(*),
            instructors(*)
          )
        `)
        .eq('id', classId)
        .single();

      if (classError) throw classError;
      setClassData(classRes as ClassWithRelations);

      // 해당 클래스의 모든 스케줄 ID 가져오기
      const scheduleIds = (classRes as ClassWithRelations)?.schedules?.map(s => s.id) || [];

      if (scheduleIds.length > 0) {
        // 예약 정보 로드 (user_tickets와 tickets 정보 포함)
        const { data: bookingsRes, error: bookingsError } = await (supabase as any)
          .from('bookings')
          .select(`
            *,
            users(*),
            user_tickets(
              *,
              tickets(*)
            ),
            schedules(
              *,
              branches(*),
              halls(*),
              instructors(*)
            )
          `)
          .in('schedule_id', scheduleIds)
          .order('created_at', { ascending: false });

        if (bookingsError) throw bookingsError;
        setBookings((bookingsRes || []) as BookingWithFullDetails[]);
      }
    } catch (error) {
      console.error('Error loading class data:', error);
      alert('클래스 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getPaymentMethod = (ticket: Ticket | null) => {
    if (!ticket) return '-';
    // ticket_type에 따라 결제수단 표시
    const ticketType = ticket.ticket_type;
    if (ticketType === 'CARD') return '카드';
    if (ticketType === 'CASH') return '현금';
    if (ticketType === 'BANK_TRANSFER') return '계좌이체';
    if (ticketType === 'MOBILE') return '모바일';
    return ticketType || '-';
  };

  const getPaymentStatus = (userTicket: (UserTicket & { tickets: Ticket | null }) | null) => {
    if (!userTicket) return '-';
    const status = userTicket.status;
    if (status === 'ACTIVE') return '결제완료';
    if (status === 'EXPIRED') return '만료';
    if (status === 'USED') return '사용완료';
    return status || '-';
  };

  const getAttendanceStatus = (bookingStatus: string) => {
    if (bookingStatus === 'CONFIRMED') return '예약확정';
    if (bookingStatus === 'CANCELLED') return '취소';
    if (bookingStatus === 'COMPLETED') return '출석완료';
    if (bookingStatus === 'ABSENT') return '결석';
    return bookingStatus || '-';
  };

  const getStatusBadgeClass = (status: string) => {
    if (status === 'CONFIRMED' || status === '예약확정') {
      return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400';
    }
    if (status === 'CANCELLED' || status === '취소') {
      return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400';
    }
    if (status === 'COMPLETED' || status === '출석완료') {
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400';
    }
    if (status === 'ABSENT' || status === '결석') {
      return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400';
    }
    return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400';
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-neutral-500 dark:text-neutral-400">로딩 중...</div>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="text-center py-12">
        <div className="text-neutral-500 dark:text-neutral-400 mb-4">클래스를 찾을 수 없습니다.</div>
        <button
          onClick={() => router.push('/admin/classes')}
          className="px-4 py-2 bg-primary dark:bg-[#CCFF00] text-black rounded-lg hover:opacity-90"
        >
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  const academy = classData.academies as Academy | null;
  const academyAny = academy as any;
  const academyName = academyAny?.name_kr && academyAny?.name_en
    ? `${academyAny.name_kr} (${academyAny.name_en})`
    : academyAny?.name_kr || academyAny?.name_en || '-';

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push('/admin/classes')}
          className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-black dark:text-white" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">{classData.title}</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            {academyName}
          </p>
        </div>
      </div>

      {/* 클래스 기본 정보 */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 mb-6">
        <h2 className="text-lg font-semibold text-black dark:text-white mb-4">클래스 정보</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-neutral-600 dark:text-neutral-400">학원</span>
            <p className="text-sm font-medium text-black dark:text-white mt-1">{academyName}</p>
          </div>
          <div>
            <span className="text-sm text-neutral-600 dark:text-neutral-400">장르</span>
            <p className="text-sm font-medium text-black dark:text-white mt-1">{classData.genre || '-'}</p>
          </div>
          <div>
            <span className="text-sm text-neutral-600 dark:text-neutral-400">난이도</span>
            <p className="text-sm font-medium text-black dark:text-white mt-1">{classData.difficulty_level || '-'}</p>
          </div>
          <div>
            <span className="text-sm text-neutral-600 dark:text-neutral-400">클래스 타입</span>
            <p className="text-sm font-medium text-black dark:text-white mt-1">
              {classData.class_type === 'REGULAR' ? '정규반' :
               classData.class_type === 'ONE_DAY' ? '원데이' :
               classData.class_type === 'PRIVATE' ? '개인레슨' :
               classData.class_type === 'RENTAL' ? '대관' : classData.class_type}
            </p>
          </div>
          <div>
            <span className="text-sm text-neutral-600 dark:text-neutral-400">가격</span>
            <p className="text-sm font-medium text-black dark:text-white mt-1">
              {(classData as any).price ? `${((classData as any).price).toLocaleString()}원` : '-'}
            </p>
          </div>
          <div>
            <span className="text-sm text-neutral-600 dark:text-neutral-400">총 신청자 수</span>
            <p className="text-sm font-medium text-black dark:text-white mt-1">{bookings.length}명</p>
          </div>
        </div>
      </div>

      {/* 신청자 현황 */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-lg font-semibold text-black dark:text-white">신청자 현황</h2>
        </div>
        {bookings.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-neutral-500 dark:text-neutral-400">신청자가 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-100 dark:bg-neutral-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                    이름
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                    연락처
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                    이메일
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                    결제수단
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                    결제상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                    출석상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                    예약일시
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                    수업일시
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {bookings.map((booking) => {
                  const user = booking.users as User | null;
                  const userTicket = booking.user_tickets as (UserTicket & { tickets: Ticket | null }) | null;
                  const ticket = userTicket?.tickets || null;
                  const schedule = booking.schedules as (Schedule & {
                    branches: Branch | null;
                    halls: Hall | null;
                    instructors: Instructor | null;
                  }) | null;

                  return (
                    <tr key={booking.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black dark:text-white">
                        {user?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                        {user?.phone || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                        {user?.email || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                        {getPaymentMethod(ticket)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(getPaymentStatus(userTicket))}`}>
                          {getPaymentStatus(userTicket)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(booking.status)}`}>
                          {getAttendanceStatus(booking.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                        {formatDateTime(booking.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                        {schedule ? formatDateTime(schedule.start_time) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

