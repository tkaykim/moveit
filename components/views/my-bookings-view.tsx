"use client";

import { useState, useEffect } from "react";
import {
  ChevronLeft,
  Calendar,
  Clock,
  MapPin,
  Play,
  QrCode,
  CalendarDays,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { LanguageToggle } from "@/components/common/language-toggle";
import { QrModal } from "@/components/modals/qr-modal";
import { BookingStatusBadge } from "@/components/common/booking-status-badge";
import { fetchWithAuth } from "@/lib/api/auth-fetch";

interface BookingItem {
  id: string;
  className: string;
  academyName: string;
  startTime: string;
  endTime?: string;
  hallName?: string;
  status: string;
}

interface MyBookingsViewProps {
  onBack: () => void;
}

export const MyBookingsView = ({ onBack }: MyBookingsViewProps) => {
  const router = useRouter();
  const { user } = useAuth();
  const { t, language } = useLocale();
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"UPCOMING" | "PAST">("UPCOMING");
  const [qrModalBooking, setQrModalBooking] = useState<{
    id: string;
    className?: string;
    academyName?: string;
    startTime?: string;
  } | null>(null);

  useEffect(() => {
    if (!user) {
      setBookings([]);
      setLoading(false);
      return;
    }

    const loadBookings = async () => {
      try {
        setLoading(true);
        const res = await fetchWithAuth("/api/bookings");
        const json = await res.json();

        if (!res.ok) {
          if (res.status === 401) {
            setBookings([]);
            return;
          }
          throw new Error(json.error || "예약 목록 조회 실패");
        }

        const data = json.data || [];
        const now = new Date();

        const items: BookingItem[] = data
          .filter((b: any) => ["CONFIRMED", "COMPLETED", "PENDING", "CANCELLED"].includes(b.status))
          .map((b: any) => {
            const startTime =
              b.schedules?.start_time || b.classes?.start_time || "";
            const endTime = b.schedules?.end_time || b.classes?.end_time;
            const classes = b.schedules?.classes || b.classes;
            const academies = classes?.academies;
            const hall = b.schedules?.halls || b.halls || classes?.halls;
            return {
              id: b.id,
              className: classes?.title || "클래스",
              academyName:
                academies?.name_kr || academies?.name_en || "",
              startTime,
              endTime,
              hallName: hall?.name,
              status: b.status,
            };
          })
          .filter((b: BookingItem) => b.startTime);

        setBookings(items);
      } catch (error) {
        console.error("Error loading bookings:", error);
        setBookings([]);
      } finally {
        setLoading(false);
      }
    };

    loadBookings();
  }, [user]);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdayKo = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
    const weekdayEn = [
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ][date.getDay()];
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");

    if (language === "en") {
      return `${month}/${day} (${weekdayEn}) ${hours}:${minutes}`;
    }
    return `${month}/${day}(${weekdayKo}) ${hours}:${minutes}`;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const now = new Date();
  const upcoming = bookings.filter((b) => new Date(b.startTime) > now);
  const past = bookings.filter((b) => new Date(b.startTime) <= now);
  const displayed = filter === "UPCOMING" ? upcoming : past;

  if (!user) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-950 pt-12 px-5 pb-24">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-black dark:text-white"
          >
            <ChevronLeft />
          </button>
          <h2 className="text-xl font-bold text-black dark:text-white">
            {language === "en" ? "My Bookings" : "내가 예약한 수업"}
          </h2>
          <div className="w-10" />
        </div>
        <div className="text-center py-20">
          <CalendarDays
            size={48}
            className="mx-auto mb-4 text-neutral-400 dark:text-neutral-600"
          />
          <p className="text-neutral-500 dark:text-neutral-400 mb-4">
            {language === "en"
              ? "Please log in to view your bookings."
              : "예약 내역을 보려면 로그인해 주세요."}
          </p>
          <button
            onClick={() => router.push("/my")}
            className="text-primary dark:text-[#CCFF00] font-bold"
          >
            {language === "en" ? "Go to My Page" : "마이페이지로 이동"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pt-12 px-5 pb-24">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-black dark:text-white"
          >
            <ChevronLeft />
          </button>
          <h2 className="text-xl font-bold text-black dark:text-white">
            {language === "en" ? "My Bookings" : "내가 예약한 수업"}
          </h2>
        </div>
        <LanguageToggle />
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter("UPCOMING")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${
            filter === "UPCOMING"
              ? "bg-primary dark:bg-[#CCFF00] text-black"
              : "bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400"
          }`}
        >
          {language === "en" ? `Upcoming (${upcoming.length})` : `예정 (${upcoming.length})`}
        </button>
        <button
          onClick={() => setFilter("PAST")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${
            filter === "PAST"
              ? "bg-primary dark:bg-[#CCFF00] text-black"
              : "bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400"
          }`}
        >
          {language === "en" ? `Past (${past.length})` : `지난 (${past.length})`}
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-neutral-100 dark:bg-neutral-800 rounded-2xl p-4 animate-pulse"
            >
              <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-32 mb-2" />
              <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-24" />
            </div>
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-20">
          <Calendar
            size={48}
            className="mx-auto mb-4 text-neutral-400 dark:text-neutral-600"
          />
          <p className="text-neutral-500 dark:text-neutral-400 mb-2">
            {filter === "UPCOMING"
              ? language === "en"
                ? "No upcoming bookings"
                : "예정된 수업이 없습니다"
              : language === "en"
              ? "No past bookings"
              : "지난 예약이 없습니다"}
          </p>
          {filter === "UPCOMING" && (
            <button
              onClick={() => router.push("/search")}
              className="text-primary dark:text-[#CCFF00] font-bold mt-2"
            >
              {language === "en" ? "Find classes" : "클래스 찾기"}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {displayed.map((booking) => {
            const isUpcoming = new Date(booking.startTime) > now;
            return (
              <div
                key={booking.id}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4"
              >
                <div className="flex items-start gap-2 mb-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isUpcoming
                        ? "bg-primary dark:bg-[#CCFF00]"
                        : "bg-neutral-200 dark:bg-neutral-700"
                    }`}
                  >
                    <Play
                      size={12}
                      className={`${isUpcoming ? "text-black dark:text-black" : "text-neutral-500"} ml-0.5`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-bold text-black dark:text-white truncate">
                        {booking.className}
                      </h3>
                      <BookingStatusBadge
                        status={booking.status}
                        startTime={booking.startTime}
                        className="flex-shrink-0"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {formatDateTime(booking.startTime)}
                        {booking.endTime &&
                          ` - ${formatTime(booking.endTime)}`}
                      </span>
                      {booking.academyName && (
                        <span className="flex items-center gap-1">
                          <MapPin size={14} />
                          {booking.academyName}
                        </span>
                      )}
                      {booking.hallName && (
                        <span className="text-neutral-500 dark:text-neutral-500">
                          · {booking.hallName}
                        </span>
                      )}
                    </div>
                  </div>
                  {isUpcoming && booking.status === "CONFIRMED" && (
                    <button
                      onClick={() =>
                        setQrModalBooking({
                          id: booking.id,
                          className: booking.className,
                          academyName: booking.academyName,
                          startTime: booking.startTime,
                        })
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary dark:bg-[#CCFF00] text-black text-xs font-bold rounded-lg hover:opacity-90 flex-shrink-0"
                    >
                      <QrCode size={14} />
                      QR 출석
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {qrModalBooking && (
        <QrModal
          isOpen={!!qrModalBooking}
          onClose={() => setQrModalBooking(null)}
          bookingId={qrModalBooking.id}
          bookingInfo={{
            className: qrModalBooking.className,
            academyName: qrModalBooking.academyName,
            startTime: qrModalBooking.startTime,
          }}
        />
      )}
    </div>
  );
};
