"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Ticket, Building2, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';

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
  const { t, language } = useLocale();

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pt-12 px-5 pb-24">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-6">
        <ChevronLeft size={20} />
        {t('ticketPurchase.back')}
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
          {ticket.price != null ? `${Number(ticket.price).toLocaleString()}${language === 'ko' ? '원' : ' KRW'}` : t('ticketPurchase.inquire')}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {ticket.ticket_type === 'PERIOD' ? t('ticketPurchase.periodTicket') : ticket.ticket_type === 'COUNT' ? t('ticketPurchase.countTicket') : t('ticketPurchase.workshopTicket')}
        </p>

        {isPeriod && (
          <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('ticketPurchase.startDateLabel')}
            </label>
            <select
              value={selectedStartDate}
              onChange={(e) => setSelectedStartDate(e.target.value)}
              className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
            >
              {availableDates.length === 0 ? (
                <option value="">{t('ticketPurchase.noDateAvailable')}</option>
              ) : (
                availableDates.map((d) => (
                  <option key={d} value={d}>
                    {new Date(d).toLocaleDateString(language === 'en' ? 'en-US' : 'ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
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
                {t('ticketPurchase.guestPayment')}
              </button>
            </div>
          )}
          {(guestMode || (!user && !guestMode)) && !user && (
            <div className="mb-4 p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 space-y-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('ticketPurchase.guestInfo')}</p>
              <input
                type="text"
                placeholder={t('ticketPurchase.nameRequired')}
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              />
              <input
                type="tel"
                placeholder={t('ticketPurchase.contact')}
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              />
              <input
                type="email"
                placeholder={t('ticketPurchase.email')}
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
                  {t('ticketPurchase.loginAndPay')}
                </button>
              )}
            </div>
          )}
          {user && !guestMode && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{t('ticketPurchase.payingAs')}</p>
          )}
          <button
            type="button"
            onClick={handlePurchase}
            disabled={purchasing || (isPeriod && availableDates.length === 0) || (!user && !guestName.trim())}
            className="w-full py-4 rounded-xl bg-primary dark:bg-[#CCFF00] text-black font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {purchasing ? <Loader2 size={20} className="animate-spin" /> : null}
            {purchasing ? t('ticketPurchase.paying') : user && !guestMode ? t('ticketPurchase.pay') : guestMode || guestName ? t('ticketPurchase.guestPay') : t('ticketPurchase.loginToPay')}
          </button>
          {!user && !guestMode && (
            <button
              type="button"
              onClick={() => router.push('/my')}
              className="w-full mt-3 py-3 rounded-xl border border-neutral-300 dark:border-neutral-600 text-gray-700 dark:text-gray-300 font-medium"
            >
              {t('ticketPurchase.loginButton')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
