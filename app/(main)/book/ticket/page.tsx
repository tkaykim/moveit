"use client";

import { useSearchParams } from 'next/navigation';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { TicketPurchaseContent } from './ticket-purchase-content';

export default function TicketPurchaseLinkPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const ticketId = searchParams.get('ticketId') || searchParams.get('ticket_id');

  const [ticket, setTicket] = useState<any>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedStartDate, setSelectedStartDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState('');
  const [guestMode, setGuestMode] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');

  useEffect(() => {
    if (!ticketId) {
      setError('수강권 정보가 없습니다.');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/tickets/${ticketId}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || '수강권을 찾을 수 없습니다.');
          setTicket(null);
          return;
        }
        setTicket(data.data);
        setError('');
        if (data.data?.ticket_type === 'PERIOD') {
          const dr = await fetch(`/api/tickets/${ticketId}/available-start-dates`);
          const drData = await dr.json();
          setAvailableDates(drData.data || []);
          if (drData.data?.length) setSelectedStartDate(drData.data[0]);
        }
      } catch {
        setError('수강권 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, [ticketId]);

  const handlePurchase = async () => {
    if (!ticket) return;
    if (ticket.ticket_type === 'PERIOD' && !selectedStartDate) {
      alert('시작일을 선택해주세요.');
      return;
    }

    if (guestMode || !user) {
      if (!guestName.trim()) {
        alert('이름을 입력해주세요.');
        return;
      }
      setPurchasing(true);
      try {
        const body: any = {
          ticketId: ticket.id,
          guestName: guestName.trim(),
          guestPhone: guestPhone.trim() || undefined,
          guestEmail: guestEmail.trim() || undefined,
        };
        if (ticket.ticket_type === 'PERIOD') body.startDate = selectedStartDate;
        const res = await fetch('/api/tickets/purchase-guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '결제에 실패했습니다.');
        alert(data.message || '결제가 완료되었습니다.');
        router.push('/tickets');
      } catch (e: any) {
        alert(e.message || '결제에 실패했습니다.');
      } finally {
        setPurchasing(false);
      }
      return;
    }

    setPurchasing(true);
    try {
      const body: any = { ticketId: ticket.id, paymentMethod: 'CARD' };
      if (ticket.ticket_type === 'PERIOD') body.startDate = selectedStartDate;
      const res = await fetchWithAuth('/api/tickets/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '결제에 실패했습니다.');
      alert('결제가 완료되었습니다.');
      router.push('/tickets');
    } catch (e: any) {
      alert(e.message || '결제에 실패했습니다.');
    } finally {
      setPurchasing(false);
    }
  };

  const academyName = ticket?.academies?.name_kr || ticket?.academies?.name_en || '학원';
  const isPeriod = ticket?.ticket_type === 'PERIOD';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
        <Loader2 className="animate-spin text-primary dark:text-[#CCFF00]" size={32} />
      </div>
    );
  }
  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-950 pt-12 px-5">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-6">
          <ChevronLeft size={20} />
          뒤로
        </button>
        <p className="text-red-600 dark:text-red-400">{error || '수강권을 찾을 수 없습니다.'}</p>
      </div>
    );
  }
  return (
    <TicketPurchaseContent
      ticket={ticket}
      academyName={academyName}
      isPeriod={isPeriod}
      availableDates={availableDates}
      selectedStartDate={selectedStartDate}
      setSelectedStartDate={setSelectedStartDate}
      purchasing={purchasing}
      handlePurchase={handlePurchase}
      guestMode={guestMode}
      setGuestMode={setGuestMode}
      guestName={guestName}
      setGuestName={setGuestName}
      guestPhone={guestPhone}
      setGuestPhone={setGuestPhone}
      guestEmail={guestEmail}
      setGuestEmail={setGuestEmail}
    />
  );
}
