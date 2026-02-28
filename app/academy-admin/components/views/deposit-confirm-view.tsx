"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { Landmark, RefreshCw, Loader2, CheckCircle, Clock, Ticket, CalendarCheck, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface BankTransferOrder {
  id: string;
  user_id: string | null;
  ticket_id: string;
  schedule_id: string | null;
  amount: number;
  order_name: string | null;
  orderer_name?: string | null;
  status: string;
  created_at: string;
  confirmed_at: string | null;
  tickets: { id: string; name: string } | null;
  schedules: {
    id: string;
    start_time: string;
    end_time: string;
    classes: { id: string | null; title: string } | null;
  } | null;
  user_name?: string | null;
  user_phone?: string | null;
  user_email?: string | null;
}

/** 긴 내용은 칩으로 표시, 호버 시 전체 텍스트 툴팁 */
function CellChip({
  text,
  maxWidth = 'max-w-[120px]',
  className = '',
}: {
  text: string | null | undefined;
  maxWidth?: string;
  className?: string;
}) {
  const s = text?.trim() || '—';
  return (
    <span
      title={s !== '—' && s.length > 20 ? s : undefined}
      className={cn(
        'inline-block px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs truncate',
        maxWidth,
        className
      )}
    >
      {s}
    </span>
  );
}

interface DepositConfirmViewProps {
  academyId: string;
}

const PAGE_SIZE = 20;

export function DepositConfirmView({ academyId }: DepositConfirmViewProps) {
  const [orders, setOrders] = useState<BankTransferOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusTab, setStatusTab] = useState<'PENDING' | 'CONFIRMED' | ''>('PENDING'); // 기본: 입금대기 (계좌이체 신청 건이 여기서 먼저 보이도록)
  const [academyName, setAcademyName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const loadPage = useCallback(
    async (pageNum: number, q: string, status: 'PENDING' | 'CONFIRMED' | '') => {
      if (!academyId) {
        setOrders([]);
        setTotal(0);
        setLoading(false);
        return;
      }
      setLoading(true);
      setListError(null);
      try {
        const params = new URLSearchParams({ page: String(pageNum), limit: String(PAGE_SIZE) });
        if (q) params.set('q', q);
        if (status) params.set('status', status);
        const res = await fetchWithAuth(
          `/api/academy-admin/${academyId}/bank-transfer-orders?${params.toString()}`
        );
        const json = await res.json();
        if (res.ok) {
          const data = Array.isArray(json.data) ? json.data : [];
          const totalVal = typeof json.total === 'number' ? json.total : 0;
          setOrders(data as BankTransferOrder[]);
          setTotal(totalVal);
        } else {
          setOrders([]);
          setTotal(0);
          setListError(json?.error || `목록을 불러올 수 없습니다. (${res.status})`);
        }
      } catch (e: unknown) {
        setOrders([]);
        setTotal(0);
        setListError(e instanceof Error ? e.message : '목록을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    },
    [academyId]
  );

  useEffect(() => {
    loadPage(page, searchQuery, statusTab);
  }, [page, searchQuery, statusTab, loadPage]);

  useEffect(() => {
    if (!academyId) return;
    setPage(1);
    setSearchQuery('');
    setSearchInput('');
    loadPage(1, '', statusTab);
  }, [academyId, loadPage]);

  useEffect(() => {
    setPage(1);
  }, [statusTab]);

  // 학원명 로드 (현재 어떤 학원인지 확인용)
  const academyNameMounted = useRef(true);
  useEffect(() => {
    academyNameMounted.current = true;
    if (!academyId) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    supabase
      .from('academies')
      .select('name_kr, name_en')
      .eq('id', academyId)
      .single()
      .then(({ data }) => {
        if (academyNameMounted.current && data) {
          setAcademyName(data.name_kr || data.name_en || null);
        }
      })
      .catch(() => {});
    return () => { academyNameMounted.current = false; };
  }, [academyId]);

  const handleSearch = useCallback(() => {
    setSearchQuery(searchInput.trim());
    setPage(1);
  }, [searchInput]);

  const handleConfirm = async (orderId: string) => {
    setConfirmingId(orderId);
    try {
      const res = await fetchWithAuth(
        `/api/academy-admin/${academyId}/bank-transfer-confirm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? { ...o, status: 'CONFIRMED' as const, confirmed_at: new Date().toISOString() }
              : o
          )
        );
      } else {
        alert(data.error || '입금 확인 처리에 실패했습니다.');
      }
    } catch {
      alert('요청 중 오류가 발생했습니다.');
    } finally {
      setConfirmingId(null);
    }
  };

  const refreshCurrent = useCallback(() => {
    loadPage(page, searchQuery, statusTab);
  }, [page, searchQuery, statusTab, loadPage]);

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible' && academyId) refreshCurrent();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [academyId, refreshCurrent]);

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const formatTimeRange = (startIso: string, endIso: string) => {
    try {
      const start = new Date(startIso);
      const end = new Date(endIso);
      const dateStr = start.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', weekday: 'short' });
      const startStr = start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      const endStr = end.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      return `${dateStr} ${startStr} ~ ${endStr}`;
    } catch {
      return `${startIso} ~ ${endIso}`;
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="w-full">
      <div className="flex flex-col gap-1 mb-6">
        <div className="flex items-center gap-2">
          <Landmark className="text-primary dark:text-[#CCFF00]" size={24} />
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">수동 입금확인</h1>
        </div>
        {academyName && (
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            현재 학원: <span className="text-primary dark:text-[#CCFF00]">{academyName}</span>
          </p>
        )}
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          계좌이체로 신청한 주문을 확인한 뒤 입금 확인을 누르면 수강권이 발급되고, 수업 예약이 있으면 예약이 확정됩니다.
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
          ※ 이 목록은 <strong>계좌이체</strong>로 신청한 주문만 표시됩니다. 수업 예약 페이지(book/session)에서 <strong>카드·간편결제</strong>로 구매한 건은 결제 완료 시 자동 발급되며, 출석/신청 관리 또는 매출/정산에서 확인할 수 있습니다.
        </p>
      </div>

      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">필터</span>
          <div className="flex rounded-lg border border-neutral-200 dark:border-neutral-700 p-0.5 bg-neutral-100 dark:bg-neutral-800">
            <button
              type="button"
              onClick={() => setStatusTab('PENDING')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                statusTab === 'PENDING'
                  ? 'bg-amber-500 text-white dark:bg-amber-500 dark:text-black'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              )}
            >
              <Clock size={14} className="inline mr-1.5 align-middle" />
              입금대기
            </button>
            <button
              type="button"
              onClick={() => setStatusTab('CONFIRMED')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                statusTab === 'CONFIRMED'
                  ? 'bg-green-600 text-white dark:bg-green-500 dark:text-black'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              )}
            >
              <CheckCircle size={14} className="inline mr-1.5 align-middle" />
              입금완료
            </button>
            <button
              type="button"
              onClick={() => setStatusTab('')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                statusTab === ''
                  ? 'bg-neutral-600 text-white dark:bg-neutral-500 dark:text-black'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              )}
            >
              전체
            </button>
          </div>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">정렬: 최신순</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">검색</span>
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <Input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="이름, 연락처, 이메일, 주문명 검색"
              className="pl-9 h-9"
            />
          </div>
          <Button type="button" onClick={handleSearch} variant="secondary" size="default">
            검색
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={refreshCurrent}
            disabled={loading}
            title="새로고침"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {listError && (
        <div className="mb-6 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {listError}
        </div>
      )}

      {loading && orders.length === 0 ? (
        <div className="flex items-center justify-center py-16 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
          <Loader2 className="animate-spin text-primary dark:text-[#CCFF00]" size={32} />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 text-neutral-500 dark:text-neutral-400">
          {searchQuery ? (
            '검색 결과가 없습니다.'
          ) : statusTab === 'PENDING' ? (
            <>
              입금대기 건이 없습니다.
              <br />
              <span className="text-xs mt-2 block">‘전체’ 탭에서 모든 계좌이체 주문을 확인하거나, 검색어를 입력해 보세요.</span>
            </>
          ) : statusTab === 'CONFIRMED' ? (
            '입금완료 건이 없습니다.'
          ) : (
            '계좌이체 주문이 없습니다.'
          )}
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-sm overflow-hidden">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="bg-neutral-50 dark:bg-neutral-900/80 hover:bg-neutral-50 dark:hover:bg-neutral-900/80">
                  <TableHead className="whitespace-nowrap">이름</TableHead>
                  <TableHead className="whitespace-nowrap">연락처</TableHead>
                  <TableHead className="whitespace-nowrap">회원여부</TableHead>
                  <TableHead className="whitespace-nowrap">유형</TableHead>
                  <TableHead className="whitespace-nowrap">상품</TableHead>
                  <TableHead className="whitespace-nowrap">신청수업</TableHead>
                  <TableHead className="text-right whitespace-nowrap">결제금액</TableHead>
                  <TableHead className="whitespace-nowrap">예금주명</TableHead>
                  <TableHead className="whitespace-nowrap">상태</TableHead>
                  <TableHead className="text-center w-[100px] whitespace-nowrap">비고</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const hasBooking = !!order.schedule_id && !!order.schedules;
                  const isPending = order.status === 'PENDING';
                  const contact = [order.user_phone, order.user_email].filter(Boolean).join(' / ') || '—';
                  const classText = hasBooking && order.schedules
                    ? `${order.schedules.classes?.title || '(클래스)'} ${formatTimeRange(order.schedules.start_time, order.schedules.end_time)}`
                    : '—';
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="py-3">
                        <CellChip text={order.user_name || '(이름 없음)'} maxWidth="max-w-[100px]" />
                      </TableCell>
                      <TableCell className="py-3">
                        <CellChip text={contact} maxWidth="max-w-[140px]" />
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant={order.user_id ? 'info' : 'secondary'} className="whitespace-nowrap">
                          {order.user_id ? '회원' : '비회원'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        {hasBooking ? (
                          <Badge variant="info" className="gap-1 whitespace-nowrap">
                            <CalendarCheck size={12} />
                            수강권+예약
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1 whitespace-nowrap">
                            <Ticket size={12} />
                            수강권만
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        <CellChip text={order.tickets?.name || order.order_name || '수강권'} maxWidth="max-w-[140px]" />
                      </TableCell>
                      <TableCell className="py-3">
                        <CellChip text={classText} maxWidth="max-w-[180px]" />
                      </TableCell>
                      <TableCell className="py-3 text-right font-medium whitespace-nowrap">
                        {order.amount.toLocaleString()}원
                      </TableCell>
                      <TableCell className="py-3">
                        <CellChip text={(order.orderer_name || order.user_name) ?? undefined} maxWidth="max-w-[100px]" />
                      </TableCell>
                      <TableCell className="py-3">
                        {isPending ? (
                          <Badge variant="warning" className="gap-1 whitespace-nowrap">
                            <Clock size={12} />
                            입금대기
                          </Badge>
                        ) : (
                          <Badge variant="success" className="gap-1 whitespace-nowrap">
                            <CheckCircle size={12} />
                            확인완료
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-center">
                        {isPending && (
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => handleConfirm(order.id)}
                            disabled={confirmingId !== null}
                            className="gap-1.5"
                          >
                            {confirmingId === order.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <CheckCircle size={14} />
                            )}
                            입금확인
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!hasPrev || loading}
              >
                <ChevronLeft size={18} />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant={page === p ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPage(p)}
                  disabled={loading}
                  className={cn(page === p && 'bg-primary dark:bg-[#CCFF00] text-black hover:bg-primary/90 dark:hover:bg-[#CCFF00]/90')}
                >
                  {p}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={!hasNext || loading}
              >
                <ChevronRight size={18} />
              </Button>
              <span className="text-sm text-neutral-500 dark:text-neutral-400 ml-2">
                {total}건 · {page}/{totalPages}페이지
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
