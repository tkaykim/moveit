"use client";

import { Calendar, Clock, MapPin, User, ChevronRight } from 'lucide-react';
import { BookingStatusBadge } from '@/components/common/booking-status-badge';
import { useState, useEffect } from 'react';
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { fetchWithAuth } from '@/lib/api/auth-fetch';

interface Booking {
  id: string;
  status: string;
  created_at: string;
  class_id: string;
  schedule_id: string | null;
  schedules: {
    id: string;
    start_time: string;
    end_time: string;
    class_id: string;
    classes: {
      id: string;
      title: string | null;
      academy_id: string;
      academies: {
        id: string;
        name_kr: string | null;
        name_en: string | null;
        logo_url: string | null;
        address: string | null;
      } | null;
      instructors: {
        id: string;
        name_kr: string | null;
        name_en: string | null;
      } | null;
    } | null;
  } | null;
  classes: {
    id: string;
    title: string | null;
    start_time: string | null;
    end_time: string | null;
    academy_id: string;
    academies: {
      id: string;
      name_kr: string | null;
      name_en: string | null;
      logo_url: string | null;
      address: string | null;
    } | null;
    instructors: {
      id: string;
      name_kr: string | null;
      name_en: string | null;
    } | null;
  } | null;
}

interface MyBookingsSectionProps {
  onAcademyClick?: (academyId: string) => void;
  initialTab?: 'upcoming' | 'completed';
  sectionRef?: React.RefObject<HTMLDivElement>;
}

export const MyBookingsSection = ({ onAcademyClick, initialTab = 'upcoming', sectionRef }: MyBookingsSectionProps) => {
  const { user } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed'>(initialTab);

  useEffect(() => {
    const loadBookings = async () => {
      if (!user) {
        setBookings([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetchWithAuth('/api/bookings');
        if (response.ok) {
          const result = await response.json();
          setBookings(result.data || []);
        } else {
          setBookings([]);
        }
      } catch (error) {
        console.error('Error loading bookings:', error);
        setBookings([]);
      } finally {
        setLoading(false);
      }
    };

    loadBookings();
  }, [user]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const now = new Date();

  // 시작 시간 추출 헬퍼 함수 (schedule 우선, class fallback)
  const getStartTime = (booking: Booking): Date | null => {
    if (booking.schedules?.start_time) {
      return new Date(booking.schedules.start_time);
    }
    if (booking.classes?.start_time) {
      return new Date(booking.classes.start_time);
    }
    return null;
  };

  // 수강 예정: start_time이 미래이고 status가 CONFIRMED 또는 PENDING
  const upcomingBookings = bookings.filter((booking) => {
    const startTime = getStartTime(booking);
    if (!startTime) return false;
    return startTime > now && ['CONFIRMED', 'PENDING'].includes(booking.status);
  });

  // 수강 완료/지남: start_time이 과거이거나 status가 COMPLETED 또는 CANCELLED
  const completedBookings = bookings.filter((booking) => {
    const startTime = getStartTime(booking);
    if (!startTime) return ['COMPLETED', 'CANCELLED'].includes(booking.status);
    return startTime <= now || ['COMPLETED', 'CANCELLED'].includes(booking.status);
  });

  const displayBookings = activeTab === 'upcoming' ? upcomingBookings : completedBookings;

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }),
      time: date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
    };
  };

  const handleBookingClick = (booking: Booking) => {
    const academyId = booking.schedules?.classes?.academy_id || booking.classes?.academy_id;
    if (academyId && onAcademyClick) {
      onAcademyClick(academyId);
    }
  };

  if (loading) {
    return (
      <div className="mb-6" ref={sectionRef}>
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4">
          <div className="text-neutral-500 text-center py-4">로딩 중...</div>
        </div>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="mb-6" ref={sectionRef}>
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4">
          <div className="text-neutral-500 text-center py-8 text-sm">
            예약한 클래스가 없습니다.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6" ref={sectionRef}>
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
        {/* 탭 헤더 */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${
              activeTab === 'upcoming'
                ? 'bg-primary/10 dark:bg-[#CCFF00]/10 text-primary dark:text-[#CCFF00] border-b-2 border-primary dark:border-[#CCFF00]'
                : 'text-neutral-500 dark:text-neutral-400'
            }`}
          >
            수강 예정 ({upcomingBookings.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${
              activeTab === 'completed'
                ? 'bg-primary/10 dark:bg-[#CCFF00]/10 text-primary dark:text-[#CCFF00] border-b-2 border-primary dark:border-[#CCFF00]'
                : 'text-neutral-500 dark:text-neutral-400'
            }`}
          >
            수강 완료 ({completedBookings.length})
          </button>
        </div>

        {/* 예약 목록 */}
        <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
          {displayBookings.length === 0 ? (
            <div className="text-neutral-500 text-center py-8 text-sm">
              {activeTab === 'upcoming' ? '수강 예정인 클래스가 없습니다.' : '수강 완료한 클래스가 없습니다.'}
            </div>
          ) : (
            displayBookings.map((booking) => {
              // schedule이 있으면 schedule 데이터 우선 사용
              const scheduleInfo = booking.schedules;
              const classInfo = scheduleInfo?.classes || booking.classes;
              if (!classInfo) return null;

              const academy = classInfo.academies;
              const instructor = classInfo.instructors;
              const academyName = academy?.name_kr || academy?.name_en || '학원 정보 없음';
              const instructorName = instructor?.name_kr || instructor?.name_en || '강사 정보 없음';
              const className = classInfo.title || '클래스';
              // schedule이 있으면 schedule의 start_time 사용
              const startTime = scheduleInfo?.start_time || (booking.classes?.start_time ?? null);
              const dateTime = formatDateTime(startTime);

              return (
                <button
                  key={booking.id}
                  onClick={() => handleBookingClick(booking)}
                  className="w-full text-left bg-neutral-50 dark:bg-neutral-800 rounded-xl p-4 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-black dark:text-white text-sm truncate">
                          {className}
                        </h3>
                        <BookingStatusBadge
                          status={booking.status}
                          startTime={startTime || undefined}
                          className="flex-shrink-0"
                        />
                      </div>

                      <div className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                        <div className="flex items-center gap-1.5">
                          <MapPin size={12} />
                          <span className="truncate">{academyName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <User size={12} />
                          <span>{instructorName}</span>
                        </div>
                        {typeof dateTime !== 'string' && dateTime.date !== '-' && (
                          <div className="flex items-center gap-1.5">
                            <Calendar size={12} />
                            <span>{dateTime.date}</span>
                          </div>
                        )}
                        {typeof dateTime !== 'string' && dateTime.time !== '-' && (
                          <div className="flex items-center gap-1.5">
                            <Clock size={12} />
                            <span>{dateTime.time}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="text-neutral-400 flex-shrink-0" size={20} />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

