"use client";

import { useState, useEffect } from 'react';
import { X, Search, User, Loader2 } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface StudentWithTickets {
  id: string;
  name?: string | null;
  nickname?: string | null;
  phone?: string | null;
  user_tickets?: Array<{
    id: string;
    remaining_count: number | null;
    expiry_date: string | null;
    status: string;
    tickets: { id: string; name: string; ticket_type: string };
  }>;
}

interface AdminExtensionCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  academyId: string;
  onSuccess: () => void;
}

export function AdminExtensionCreateModal({
  isOpen,
  onClose,
  academyId,
  onSuccess,
}: AdminExtensionCreateModalProps) {
  const [memberSearch, setMemberSearch] = useState('');
  const [students, setStudents] = useState<StudentWithTickets[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [selectedUserTicketId, setSelectedUserTicketId] = useState<string | null>(null);
  const [requestType, setRequestType] = useState<'EXTENSION' | 'PAUSE'>('EXTENSION');
  const [extensionDays, setExtensionDays] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const formatDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('ko-KR') : '-');
  const formatDateLong = (d: Date) => d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  const loadStudents = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setStudentsLoading(true);
    setStudents([]);
    try {
      let userIds: string[] = [];
      const { data: academyStudents, error: academyError } = await supabase
        .from('academy_students')
        .select('user_id')
        .eq('academy_id', academyId);
      if (academyError?.code === '42P01') {
        const { data: tickets } = await supabase.from('tickets').select('id').eq('academy_id', academyId);
        const ticketIds = tickets?.map((t: any) => t.id) || [];
        if (ticketIds.length === 0) {
          setStudentsLoading(false);
          return;
        }
        const { data: userTickets } = await supabase.from('user_tickets').select('user_id').in('ticket_id', ticketIds);
        userIds = [...new Set((userTickets?.map((ut: any) => ut.user_id) || []) as string[])];
      } else if (!academyError && academyStudents?.length) {
        userIds = academyStudents.map((a: any) => a.user_id);
      }
      if (userIds.length === 0) {
        setStudentsLoading(false);
        return;
      }
      const { data: tickets } = await supabase.from('tickets').select('id').eq('academy_id', academyId);
      const ticketIds = tickets?.map((t: any) => t.id) || [];
      let query = supabase
        .from('users')
        .select(`
          id, name, nickname, phone,
          user_tickets ( id, remaining_count, expiry_date, status, tickets ( id, name, ticket_type ) )
        `)
        .in('id', userIds);
      if (memberSearch.trim()) {
        const term = `%${memberSearch.trim()}%`;
        query = query.or(`name.ilike.${term},phone.ilike.${term},nickname.ilike.${term}`);
      }
      const { data, error } = await query.order('name');
      if (error) throw error;
      const list = (data || []).map((s: any) => ({
        ...s,
        user_tickets: (s.user_tickets || []).filter((ut: any) => ut.tickets && ticketIds.includes(ut.tickets.id)).filter((ut: any) => ut.status === 'ACTIVE'),
      }));
      setStudents(list);
    } catch (e) {
      console.error(e);
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  };

  useEffect(() => {
    // 검색어가 있을 때만 검색 실행
    if (isOpen && academyId && memberSearch.trim()) {
      const t = setTimeout(loadStudents, 300);
      return () => clearTimeout(t);
    } else if (!memberSearch.trim()) {
      // 검색어가 없으면 목록 비우기
      setStudents([]);
    }
  }, [isOpen, academyId, memberSearch]);

  // 모달 열 때 초기화
  useEffect(() => {
    if (isOpen) {
      setSelectedUserTicketId(null);
      setRequestType('EXTENSION');
      setExtensionDays('');
      setStartDate('');
      setEndDate('');
      setReason('');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!selectedUserTicketId) {
      setError('회원의 수강권을 선택해주세요.');
      return;
    }
    if (!reason.trim()) {
      setError('사유를 입력해주세요.');
      return;
    }
    if (requestType === 'EXTENSION') {
      if (!extensionDays || extensionDays <= 0) {
        setError('연장 일수를 입력해주세요.');
        return;
      }
    } else {
      if (!startDate || !endDate) {
        setError('일시정지 시작일과 종료일을 입력해주세요.');
        return;
      }
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end < start) {
        setError('종료일은 시작일 이후여야 합니다.');
        return;
      }
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/ticket-extension-requests/admin', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academyId,
          user_ticket_id: selectedUserTicketId,
          request_type: requestType,
          extension_days: requestType === 'EXTENSION' ? extensionDays : undefined,
          absent_start_date: requestType === 'PAUSE' ? startDate : undefined,
          absent_end_date: requestType === 'PAUSE' ? endDate : undefined,
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '등록에 실패했습니다.');
      alert('연장/일시정지가 등록되었고 즉시 반영되었습니다.');
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || '등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // 요약 계산
  const selectedTicket = students.flatMap(s => s.user_tickets || []).find(ut => ut.id === selectedUserTicketId);
  const currentExpiry = selectedTicket?.expiry_date ? new Date(selectedTicket.expiry_date) : null;
  let days = 0;
  if (requestType === 'EXTENSION') {
    days = typeof extensionDays === 'number' && extensionDays > 0 ? extensionDays : 0;
  } else if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end >= start) {
      days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
  }
  const newExpiry = currentExpiry && days > 0
    ? new Date(currentExpiry.getTime() + days * 24 * 60 * 60 * 1000)
    : null;
  const showSummary = selectedTicket && (currentExpiry || days > 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b dark:border-neutral-800 flex justify-between items-center sticky top-0 bg-white dark:bg-neutral-900">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">관리자 연장/일시정지 생성</h3>
          <button type="button" onClick={onClose} className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 회원 검색 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">회원 검색</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="이름, 전화번호, 닉네임으로 검색"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* 회원 목록 */}
          <div className="max-h-48 overflow-y-auto border dark:border-neutral-700 rounded-lg">
            {studentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-gray-400" size={24} />
              </div>
            ) : !memberSearch.trim() ? (
              <p className="p-4 text-sm text-gray-500 dark:text-gray-400">회원 이름, 전화번호, 닉네임을 검색해주세요.</p>
            ) : students.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 dark:text-gray-400">검색 결과가 없습니다.</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-neutral-800">
                {students.map((s) => (
                  <li key={s.id} className="p-3 hover:bg-gray-50 dark:hover:bg-neutral-800/50">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <User size={14} />
                      {s.name || s.nickname || s.phone || s.id}
                    </div>
                    <div className="mt-3 space-y-2">
                      {(s.user_tickets || []).map((ut) => {
                        const isSelected = selectedUserTicketId === ut.id;
                        const ticketType = ut.tickets?.ticket_type;
                        const isCountBased = ticketType === 'COUNT' || ticketType === 'MIXED';
                        const isPeriodBased = ticketType === 'PERIOD' || ticketType === 'MIXED';
                        
                        return (
                          <label 
                            key={ut.id} 
                            className={`
                              block cursor-pointer p-3 rounded-xl border-2 transition-all
                              ${isSelected 
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm' 
                                : 'border-gray-200 dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-800/50'}
                            `}
                          >
                            <input
                              type="radio"
                              name="adminUserTicket"
                              checked={isSelected}
                              onChange={() => setSelectedUserTicketId(ut.id)}
                              className="sr-only"
                            />
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className={`font-medium text-sm truncate ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>
                                  {ut.tickets?.name}
                                </p>
                                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                  {isCountBased && ut.remaining_count !== null && (
                                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                                      isSelected 
                                        ? 'bg-blue-100 dark:bg-blue-800/40 text-blue-700 dark:text-blue-300' 
                                        : 'bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-gray-400'
                                    }`}>
                                      잔여 {ut.remaining_count}회
                                    </span>
                                  )}
                                  {isPeriodBased && ut.expiry_date && (
                                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                                      isSelected 
                                        ? 'bg-blue-100 dark:bg-blue-800/40 text-blue-700 dark:text-blue-300' 
                                        : 'bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-gray-400'
                                    }`}>
                                      만료 {formatDate(ut.expiry_date)}
                                    </span>
                                  )}
                                  {!ut.expiry_date && (
                                    <span className="text-xs text-gray-400 dark:text-gray-500">만료일 없음</span>
                                  )}
                                </div>
                              </div>
                              <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                isSelected 
                                  ? 'border-blue-500 bg-blue-500' 
                                  : 'border-gray-300 dark:border-neutral-600'
                              }`}>
                                {isSelected && (
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                      {(s.user_tickets?.length ?? 0) === 0 && (
                        <div className="py-2 px-3 rounded-lg bg-gray-50 dark:bg-neutral-800/50 border border-dashed border-gray-200 dark:border-neutral-700">
                          <span className="text-xs text-gray-400 dark:text-gray-500">보유 수강권 없음</span>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 유형 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">신청 유형</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRequestType('EXTENSION')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${requestType === 'EXTENSION' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400'}`}
              >
                연장
              </button>
              <button
                type="button"
                onClick={() => setRequestType('PAUSE')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${requestType === 'PAUSE' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400'}`}
              >
                일시정지
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {requestType === 'EXTENSION'
                ? '입력한 일수만큼 만료일이 연장됩니다.'
                : '일시정지 기간만큼 만료일이 뒤로 밀립니다.'}
            </p>
          </div>

          {/* 연장 일수 또는 기간 */}
          {requestType === 'EXTENSION' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">연장 일수</label>
              <input
                type="number"
                min={1}
                value={extensionDays}
                onChange={(e) => setExtensionDays(e.target.value ? parseInt(e.target.value) : '')}
                placeholder="예: 7"
                className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">시작일</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">종료일</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* 사유 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              사유 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="연장/일시정지 사유를 입력해주세요."
              rows={2}
              className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white resize-none"
            />
          </div>

          {/* 처리 요약 */}
          {showSummary && (
            <div className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/50 p-3 space-y-1.5 text-sm">
              <p className="font-medium text-gray-900 dark:text-white">처리 요약</p>
              {currentExpiry && (
                <p className="text-gray-600 dark:text-gray-400">
                  기존 종료일: <span className="font-medium text-gray-900 dark:text-white">{formatDateLong(currentExpiry)}</span>
                </p>
              )}
              {days > 0 && (
                <p className="text-gray-600 dark:text-gray-400">
                  {requestType === 'EXTENSION' ? '연장 일수' : '일시정지 일수'}: <span className="font-medium text-gray-900 dark:text-white">{days}일</span>
                </p>
              )}
              {newExpiry && (
                <p className="text-gray-600 dark:text-gray-400">
                  처리 후 종료일: <span className="font-medium text-primary dark:text-[#CCFF00]">{formatDateLong(newExpiry)}</span>
                </p>
              )}
              {!currentExpiry && (
                <p className="text-gray-500 dark:text-gray-500 text-xs">이 수강권은 만료일이 없습니다.</p>
              )}
            </div>
          )}

          {/* 에러 메시지 */}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          {/* 버튼 */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border dark:border-neutral-700 rounded-xl text-gray-700 dark:text-gray-300 font-medium"
            >
              취소
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              생성 및 즉시 반영
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
