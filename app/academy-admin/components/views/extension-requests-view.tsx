"use client";

import { useState, useEffect } from 'react';
import { SectionHeader } from '../common/section-header';
import { Check, X, Loader2, Pause, Calendar, Plus, Search, User } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface ExtensionRequest {
  id: string;
  user_ticket_id: string;
  request_type: string;
  absent_start_date: string;
  absent_end_date: string;
  status: string;
  reject_reason: string | null;
  created_at: string;
  user_tickets?: {
    id: string;
    user_id: string;
    expiry_date: string | null;
    start_date: string | null;
    remaining_count: number | null;
    tickets?: {
      id: string;
      name: string;
      academy_id: string;
      ticket_type: string;
    };
  };
}

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

interface ExtensionRequestsViewProps {
  academyId: string;
}

export function ExtensionRequestsView({ academyId }: ExtensionRequestsViewProps) {
  const [requests, setRequests] = useState<ExtensionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  // 관리자 직접 생성
  const [showAdminCreate, setShowAdminCreate] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [students, setStudents] = useState<StudentWithTickets[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [selectedUserTicketId, setSelectedUserTicketId] = useState<string | null>(null);
  const [adminRequestType, setAdminRequestType] = useState<'EXTENSION' | 'PAUSE'>('EXTENSION');
  const [adminStartDate, setAdminStartDate] = useState('');
  const [adminEndDate, setAdminEndDate] = useState('');
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const [adminError, setAdminError] = useState('');

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ticket-extension-requests?academyId=${academyId}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setRequests(data.data || []);
      else setRequests([]);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [academyId]);

  const loadStudentsForAdmin = async () => {
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
    if (showAdminCreate && academyId) {
      const t = setTimeout(loadStudentsForAdmin, 300);
      return () => clearTimeout(t);
    }
  }, [showAdminCreate, academyId, memberSearch]);

  const handleAdminCreate = async () => {
    if (!selectedUserTicketId || !adminStartDate || !adminEndDate) {
      setAdminError('회원의 수강권을 선택하고 기간(시작일·종료일)을 입력해주세요.');
      return;
    }
    const start = new Date(adminStartDate);
    const end = new Date(adminEndDate);
    if (end < start) {
      setAdminError('종료일은 시작일 이후여야 합니다.');
      return;
    }
    setAdminError('');
    setAdminSubmitting(true);
    try {
      const res = await fetch('/api/ticket-extension-requests/admin', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academyId,
          user_ticket_id: selectedUserTicketId,
          request_type: adminRequestType,
          absent_start_date: adminStartDate,
          absent_end_date: adminEndDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '등록에 실패했습니다.');
      alert('연장/일시정지가 등록되었고 즉시 반영되었습니다.');
      setShowAdminCreate(false);
      setSelectedUserTicketId(null);
      setAdminStartDate('');
      setAdminEndDate('');
      loadRequests();
    } catch (e: any) {
      setAdminError(e.message || '등록에 실패했습니다.');
    } finally {
      setAdminSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/ticket-extension-requests/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '승인에 실패했습니다.');
      alert('승인되었습니다.');
      loadRequests();
    } catch (e: any) {
      alert(e.message || '승인에 실패했습니다.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = rejectReason[id]?.trim();
    if (!reason) {
      alert('거절 사유를 입력해주세요.');
      return;
    }
    setProcessingId(id);
    try {
      const res = await fetch(`/api/ticket-extension-requests/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED', reject_reason: reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '거절 처리에 실패했습니다.');
      alert('거절 처리되었습니다.');
      setRejectReason((prev) => ({ ...prev, [id]: '' }));
      loadRequests();
    } catch (e: any) {
      alert(e.message || '거절 처리에 실패했습니다.');
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = requests.filter((r) => filter === 'ALL' || r.status === filter);
  const formatDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('ko-KR') : '-');

  return (
    <div className="space-y-6">
      <SectionHeader title="수강권 연장/일시정지 관리" />
      <p className="text-sm text-gray-500 dark:text-gray-400">
        회원이 신청한 연장/일시정지를 승인하거나 거절합니다. 관리자가 직접 회원을 검색해 연장/일시정지를 생성(즉시 승인)할 수도 있습니다.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => setShowAdminCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          관리자 직접 연장/일시정지 생성
        </button>
      </div>

      {showAdminCreate && (
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-900 dark:text-white">회원 검색 후 수강권 선택</h3>
            <button type="button" onClick={() => setShowAdminCreate(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              <X size={20} />
            </button>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
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
          <div className="max-h-48 overflow-y-auto border dark:border-neutral-700 rounded-lg">
            {studentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-gray-400" size={24} />
              </div>
            ) : students.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 dark:text-gray-400">검색 결과가 없습니다.</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-neutral-800">
                {students.map((s) => (
                  <li key={s.id} className="p-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <User size={14} />
                      {s.name || s.nickname || s.phone || s.id}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {(s.user_tickets || []).map((ut) => (
                        <label key={ut.id} className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="adminUserTicket"
                            checked={selectedUserTicketId === ut.id}
                            onChange={() => setSelectedUserTicketId(ut.id)}
                            className="rounded border-gray-300"
                          />
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {ut.tickets?.name} · 만료 {formatDate(ut.expiry_date)}
                          </span>
                        </label>
                      ))}
                      {(s.user_tickets?.length ?? 0) === 0 && (
                        <span className="text-xs text-gray-400">보유 수강권 없음</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">유형</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdminRequestType('EXTENSION')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium ${adminRequestType === 'EXTENSION' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400'}`}
                >
                  연장
                </button>
                <button
                  type="button"
                  onClick={() => setAdminRequestType('PAUSE')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium ${adminRequestType === 'PAUSE' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400'}`}
                >
                  일시정지
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">시작일</label>
                <input
                  type="date"
                  value={adminStartDate}
                  onChange={(e) => setAdminStartDate(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">종료일</label>
                <input
                  type="date"
                  value={adminEndDate}
                  onChange={(e) => setAdminEndDate(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>
          {adminError && <p className="text-sm text-red-600 dark:text-red-400">{adminError}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowAdminCreate(false)} className="px-4 py-2 border dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-300">
              취소
            </button>
            <button
              type="button"
              disabled={adminSubmitting}
              onClick={handleAdminCreate}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 inline-flex items-center gap-2"
            >
              {adminSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
              생성 및 즉시 반영
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filter === f
                ? 'bg-primary dark:bg-[#CCFF00] text-black'
                : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            {f === 'PENDING' ? '대기' : f === 'APPROVED' ? '승인됨' : f === 'REJECTED' ? '거절됨' : '전체'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-gray-400" size={32} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {filter === 'PENDING' ? '대기 중인 신청이 없습니다.' : '해당 상태의 신청이 없습니다.'}
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-neutral-800">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-600 dark:text-gray-400">수강권</th>
                  <th className="px-4 py-3 text-left text-gray-600 dark:text-gray-400">유형</th>
                  <th className="px-4 py-3 text-left text-gray-600 dark:text-gray-400">휴가/불참 기간</th>
                  <th className="px-4 py-3 text-left text-gray-600 dark:text-gray-400">신청일</th>
                  <th className="px-4 py-3 text-left text-gray-600 dark:text-gray-400">상태</th>
                  <th className="px-4 py-3 text-left text-gray-600 dark:text-gray-400">처리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {r.user_tickets?.tickets?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {r.request_type === 'EXTENSION' ? '연장' : '일시정지'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {formatDate(r.absent_start_date)} ~ {formatDate(r.absent_end_date)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {formatDate(r.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          r.status === 'PENDING'
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                            : r.status === 'APPROVED'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                        }`}
                      >
                        {r.status === 'PENDING' ? '대기' : r.status === 'APPROVED' ? '승인' : '거절'}
                      </span>
                      {r.reject_reason && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{r.reject_reason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === 'PENDING' && (
                        <div className="flex flex-col gap-2">
                          <input
                            type="text"
                            placeholder="거절 시 사유 입력"
                            value={rejectReason[r.id] || ''}
                            onChange={(e) => setRejectReason((prev) => ({ ...prev, [r.id]: e.target.value }))}
                            className="w-full max-w-xs px-2 py-1 text-xs border dark:border-neutral-700 rounded bg-white dark:bg-neutral-800"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={processingId === r.id}
                              onClick={() => handleApprove(r.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-600 text-white text-xs font-medium disabled:opacity-50"
                            >
                              {processingId === r.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                              승인
                            </button>
                            <button
                              type="button"
                              disabled={processingId === r.id || !rejectReason[r.id]?.trim()}
                              onClick={() => handleReject(r.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-600 text-white text-xs font-medium disabled:opacity-50"
                            >
                              {processingId === r.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                              거절
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
