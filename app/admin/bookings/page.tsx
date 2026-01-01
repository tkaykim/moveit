"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { Booking, Schedule, User, UserTicket } from '@/lib/supabase/types';

type BookingWithRelations = Booking & {
  schedules: Schedule | null;
  users: User | null;
  user_tickets: UserTicket | null;
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('ALL');

  const loadBookings = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('bookings')
        .select('*, schedules(*), users(*), user_tickets(*)')
        .order('created_at', { ascending: false });

      if (filter !== 'ALL') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error loading bookings:', error);
      alert('예약 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

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

  if (loading) {
    return <div className="text-center py-12">로딩 중...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">예약 관리</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            예약 현황을 조회할 수 있습니다.
          </p>
        </div>
        <div className="flex gap-2">
        </div>
      </div>

      <div className="mb-6">
        <div className="flex gap-2">
          {['ALL', 'CONFIRMED', 'CANCELLED', 'COMPLETED'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-primary dark:bg-[#CCFF00] text-black'
                  : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300 dark:hover:bg-neutral-700'
              }`}
            >
              {status === 'ALL' ? '전체' :
               status === 'CONFIRMED' ? '확정' :
               status === 'CANCELLED' ? '취소' :
               status === 'COMPLETED' ? '완료' : status}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-100 dark:bg-neutral-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  사용자
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  예약 시간
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  예약일
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-neutral-500 dark:text-neutral-400">
                    예약 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => {
                  const schedule = booking.schedules as Schedule | null;
                  const user = booking.users as User | null;
                  
                  return (
                    <tr key={booking.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black dark:text-white">
                        {user?.name || user?.email || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">
                        {schedule ? formatDateTime(schedule.start_time) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          booking.status === 'CONFIRMED'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                            : booking.status === 'CANCELLED'
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                            : booking.status === 'COMPLETED'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                        }`}>
                          {booking.status === 'CONFIRMED' ? '확정' :
                           booking.status === 'CANCELLED' ? '취소' :
                           booking.status === 'COMPLETED' ? '완료' : booking.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                        {formatDateTime(booking.created_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

