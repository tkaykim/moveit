"use client";

import { useState, useEffect } from 'react';
import { SectionHeader } from '../common/section-header';
import { Check, X, Loader2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';

interface ScheduleChangeRequestRow {
  id: string;
  schedule_id: string;
  request_type: string;
  reason: string;
  status: string;
  requested_instructor_id: string | null;
  requested_instructor_name: string | null;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
  schedules?: {
    id: string;
    start_time: string;
    end_time: string;
    is_canceled: boolean;
    classes?: {
      id: string;
      title: string | null;
      academies?: { id: string; name_kr: string | null };
    };
    instructors?: { id: string; name_kr: string | null; name_en: string | null };
  };
  requested_by?: { id: string; name_kr: string | null; name_en: string | null };
  requested_instructor?: { id: string; name_kr: string | null; name_en: string | null } | null;
}

interface ScheduleChangeRequestsViewProps {
  academyId: string;
}

export function ScheduleChangeRequestsView({ academyId }: ScheduleChangeRequestsViewProps) {
  const [requests, setRequests] = useState<ScheduleChangeRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const url = filter === 'ALL'
        ? `/api/academy-admin/${academyId}/schedule-change-requests`
        : `/api/academy-admin/${academyId}/schedule-change-requests?status=${filter}`;
      const res = await fetchWithAuth(url);
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
  }, [academyId, filter]);

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      const res = await fetchWithAuth(`/api/academy-admin/${academyId}/schedule-change-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED', admin_note: adminNote[id]?.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '승인에 실패했습니다.');
      setAdminNote((prev) => ({ ...prev, [id]: '' }));
      setSelectedId(null);
      loadRequests();
    } catch (e: any) {
      alert(e.message || '승인에 실패했습니다.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const note = adminNote[id]?.trim();
    setProcessingId(id);
    try {
      const res = await fetchWithAuth(`/api/academy-admin/${academyId}/schedule-change-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED', admin_note: note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '거절 처리에 실패했습니다.');
      setAdminNote((prev) => ({ ...prev, [id]: '' }));
      setSelectedId(null);
      loadRequests();
    } catch (e: any) {
      alert(e.message || '거절 처리에 실패했습니다.');
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = requests;
  const formatDate = (s: string | null) => (s ? new Date(s).toLocaleString('ko-KR') : '-');
  const selected = selectedId ? requests.find((r) => r.id === selectedId) : null;

  return (
    <div className="space-y-6">
      <SectionHeader title="대강/취소 신청 관리" />
      <p className="text-sm text-gray-500 dark:text-gray-400">
        강사가 신청한 대강(강사 변경) 및 수업 취소 요청을 승인하거나 거절합니다.
      </p>

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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-neutral-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-600 dark:text-gray-400">유형</th>
                    <th className="px-4 py-3 text-left text-gray-600 dark:text-gray-400">수업 · 일시</th>
                    <th className="px-4 py-3 text-left text-gray-600 dark:text-gray-400">신청 강사</th>
                    <th className="px-4 py-3 text-left text-gray-600 dark:text-gray-400">신청일</th>
                    <th className="px-4 py-3 text-left text-gray-600 dark:text-gray-400">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={`hover:bg-gray-50 dark:hover:bg-neutral-800/50 cursor-pointer ${selectedId === r.id ? 'bg-primary/10 dark:bg-primary/10' : ''}`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {r.request_type === 'SUBSTITUTE' ? '대강' : '취소'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        <div>{r.schedules?.classes?.title || '-'}</div>
                        <div className="text-xs">{formatDate(r.schedules?.start_time || null)}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {r.requested_by?.name_kr || r.requested_by?.name_en || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(r.created_at)}</td>
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selected && (
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 p-4 space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {selected.request_type === 'SUBSTITUTE' ? '대강' : '취소'} 신청 상세
              </h3>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">수업</dt>
                  <dd className="text-gray-900 dark:text-white">{selected.schedules?.classes?.title || '-'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">일시</dt>
                  <dd className="text-gray-900 dark:text-white">{formatDate(selected.schedules?.start_time || null)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">학원</dt>
                  <dd className="text-gray-900 dark:text-white">{selected.schedules?.classes?.academies?.name_kr || '-'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">신청 강사</dt>
                  <dd className="text-gray-900 dark:text-white">{selected.requested_by?.name_kr || selected.requested_by?.name_en || '-'}</dd>
                </div>
                {selected.request_type === 'SUBSTITUTE' && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">대강 강사</dt>
                    <dd className="text-gray-900 dark:text-white">
                      {selected.requested_instructor
                        ? selected.requested_instructor.name_kr || selected.requested_instructor.name_en
                        : selected.requested_instructor_name || '-'}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">사유</dt>
                  <dd className="text-gray-900 dark:text-white whitespace-pre-wrap">{selected.reason || '-'}</dd>
                </div>
                {selected.admin_note && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">처리 메모</dt>
                    <dd className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selected.admin_note}</dd>
                  </div>
                )}
              </dl>

              {selected.status === 'PENDING' && (
                <>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">처리 시 사유 (선택, 거절 시 권장)</label>
                    <textarea
                      value={adminNote[selected.id] || ''}
                      onChange={(e) => setAdminNote((prev) => ({ ...prev, [selected.id]: e.target.value }))}
                      placeholder="승인/거절 시 참고할 메모"
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={processingId === selected.id}
                      onClick={() => handleApprove(selected.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium disabled:opacity-50"
                    >
                      {processingId === selected.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      승인
                    </button>
                    <button
                      type="button"
                      disabled={processingId === selected.id}
                      onClick={() => handleReject(selected.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium disabled:opacity-50"
                    >
                      {processingId === selected.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                      거절
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
