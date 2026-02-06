"use client";

import { useState, useEffect } from 'react';
import { SectionHeader } from '../common/section-header';
import { Check, X, Loader2, Plus } from 'lucide-react';
import { AdminExtensionCreateModal } from '../modals/admin-extension-create-modal';
import { ExtensionPolicySettingsCard } from './extension-policy-settings-card';

interface ExtensionRequest {
  id: string;
  user_ticket_id: string;
  request_type: string;
  extension_days: number | null;
  absent_start_date: string | null;
  absent_end_date: string | null;
  reason: string | null;
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

interface ExtensionRequestsViewProps {
  academyId: string;
}

export function ExtensionRequestsView({ academyId }: ExtensionRequestsViewProps) {
  const [requests, setRequests] = useState<ExtensionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  // 관리자 직접 생성 모달
  const [showAdminCreateModal, setShowAdminCreateModal] = useState(false);

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

      <ExtensionPolicySettingsCard academyId={academyId} />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => setShowAdminCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          관리자 직접 연장/일시정지 생성
        </button>
      </div>

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
                  <th className="px-4 py-3 text-left text-gray-600 dark:text-gray-400">일수/기간</th>
                  <th className="px-4 py-3 text-left text-gray-600 dark:text-gray-400">사유</th>
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
                      {r.request_type === 'EXTENSION'
                        ? `${r.extension_days || 0}일`
                        : `${formatDate(r.absent_start_date)} ~ ${formatDate(r.absent_end_date)}`}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-xs truncate" title={r.reason || ''}>
                      {r.reason || '-'}
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

      {/* 관리자 직접 생성 모달 */}
      <AdminExtensionCreateModal
        isOpen={showAdminCreateModal}
        onClose={() => setShowAdminCreateModal(false)}
        academyId={academyId}
        onSuccess={loadRequests}
      />
    </div>
  );
}
