"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Ticket, Building2, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type TicketData = {
  id: string;
  name: string;
  price: number | null;
  ticket_type: string;
  ticket_category?: string;
  academies?: { name_kr?: string; name_en?: string };
};

interface TicketPurchaseContentProps {
  ticket: TicketData;
  academyName: string;
  isPeriod: boolean;
  availableDates: string[];
  selectedStartDate: string;
  setSelectedStartDate: (d: string) => void;
  purchasing: boolean;
  handlePurchase: () => Promise<void>;
  guestMode: boolean;
  setGuestMode: (v: boolean) => void;
  guestName: string;
  setGuestName: (v: string) => void;
  guestPhone: string;
  setGuestPhone: (v: string) => void;
  guestEmail: string;
  setGuestEmail: (v: string) => void;
}

export function TicketPurchaseContent({
  ticket,
  academyName,
  isPeriod,
  availableDates,
  selectedStartDate,
  setSelectedStartDate,
  purchasing,
  handlePurchase,
  guestMode,
  setGuestMode,
  guestName,
  setGuestName,
  guestPhone,
  setGuestPhone,
  guestEmail,
  setGuestEmail,
}: TicketPurchaseContentProps) {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pt-12 px-5 pb-24">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-6">
        <ChevronLeft size={20} />
        뒤로
      </button>

      <div className="bg-neutral-50 dark:bg-neutral-900 rounded-2xl p-5 border border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-2 mb-2">
          <Building2 size={18} className="text-gray-500 dark:text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-400">{academyName}</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Ticket size={24} className="text-primary dark:text-[#CCFF00]" />
          {ticket.name}
        </h1>
        <div className="text-2xl font-black text-gray-900 dark:text-white mb-4">
          {ticket.price != null ? `${Number(ticket.price).toLocaleString()}원` : '문의'}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {ticket.ticket_type === 'PERIOD' ? '기간제 수강권' : ticket.ticket_type === 'COUNT' ? '쿠폰제(횟수제) 수강권' : '워크샵(특강) 수강권'}
        </p>

        {isPeriod && (
          <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              시작일 (해당 수강권으로 들을 수 있는 수업이 있는 날만 선택 가능)
            </label>
            <select
              value={selectedStartDate}
              onChange={(e) => setSelectedStartDate(e.target.value)}
              className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
            >
              {availableDates.length === 0 ? (
                <option value="">선택 가능한 날짜 없음</option>
              ) : (
                availableDates.map((d) => (
                  <option key={d} value={d}>
                    {new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </option>
                ))
              )}
            </select>
          </div>
        )}

        <div className="mt-6">
          {!user && !guestMode && (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setGuestMode(true)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                비회원으로 결제 (이름·연락처만 입력)
              </button>
            </div>
          )}
          {(guestMode || (!user && !guestMode)) && !user && (
            <div className="mb-4 p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 space-y-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">비회원 결제 정보</p>
              <input
                type="text"
                placeholder="이름 *"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              />
              <input
                type="tel"
                placeholder="연락처"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              />
              <input
                type="email"
                placeholder="이메일"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              />
              {guestMode && (
                <button
                  type="button"
                  onClick={() => setGuestMode(false)}
                  className="text-xs text-gray-500 hover:underline"
                >
                  로그인하고 결제하기
                </button>
              )}
            </div>
          )}
          {user && !guestMode && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">로그인된 계정으로 결제합니다.</p>
          )}
          <button
            type="button"
            onClick={handlePurchase}
            disabled={purchasing || (isPeriod && availableDates.length === 0) || (!user && !guestName.trim())}
            className="w-full py-4 rounded-xl bg-primary dark:bg-[#CCFF00] text-black font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {purchasing ? <Loader2 size={20} className="animate-spin" /> : null}
            {purchasing ? '결제 중...' : user && !guestMode ? '결제하기' : guestMode || guestName ? '비회원 결제하기' : '로그인 후 결제'}
          </button>
          {!user && !guestMode && (
            <button
              type="button"
              onClick={() => router.push('/my')}
              className="w-full mt-3 py-3 rounded-xl border border-neutral-300 dark:border-neutral-600 text-gray-700 dark:text-gray-300 font-medium"
            >
              로그인하기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
