"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import {
  AlertTriangle,
  Lightbulb,
  Bug,
  Clock,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  ChevronDown,
  Filter,
  Building2,
  User,
  MessageSquare,
  Save,
} from 'lucide-react';

type RequestType = 'bug_report' | 'feature_request';
type Status = 'pending' | 'in_progress' | 'completed';

interface SupportRequest {
  id: string;
  request_type: RequestType;
  status: Status;
  title: string;
  bug_situation: string | null;
  current_state: string;
  improvement_request: string;
  user_id: string;
  academy_id: string;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  // joined data
  users?: { name: string | null; nickname: string | null; email: string | null } | null;
  academies?: { name_kr: string | null; name_en: string | null } | null;
}

const STATUS_CONFIG: Record<Status, { label: string; color: string; bgColor: string; icon: typeof Clock }> = {
  pending: { label: '접수대기중', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800', icon: Clock },
  in_progress: { label: '구현중', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800', icon: Loader2 },
  completed: { label: '처리완료', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800', icon: CheckCircle2 },
};

export default function AdminSupportRequestsPage() {
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);
  const [filterType, setFilterType] = useState<'all' | RequestType>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | Status>('all');

  // Admin edit states
  const [editStatus, setEditStatus] = useState<Status>('pending');
  const [editNote, setEditNote] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchRequests = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('support_requests')
        .select('*, users(name, nickname, email), academies(name_kr, name_en)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data || []) as SupportRequest[]);
    } catch (err) {
      console.error('Error fetching support requests:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.role === 'SUPER_ADMIN') {
      fetchRequests();
    }
  }, [profile, fetchRequests]);

  const filteredRequests = requests.filter((req) => {
    if (filterType !== 'all' && req.request_type !== filterType) return false;
    if (filterStatus !== 'all' && req.status !== filterStatus) return false;
    return true;
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getUserName = (req: SupportRequest) => {
    return req.users?.nickname || req.users?.name || req.users?.email || '알 수 없음';
  };

  const getAcademyName = (req: SupportRequest) => {
    return req.academies?.name_kr || req.academies?.name_en || '알 수 없음';
  };

  const handleOpenDetail = (req: SupportRequest) => {
    setSelectedRequest(req);
    setEditStatus(req.status);
    setEditNote(req.admin_note || '');
  };

  const handleSave = async () => {
    if (!selectedRequest) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('support_requests')
        .update({
          status: editStatus,
          admin_note: editNote || null,
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      // Update local state
      setRequests((prev) =>
        prev.map((r) =>
          r.id === selectedRequest.id
            ? { ...r, status: editStatus, admin_note: editNote || null }
            : r
        )
      );
      setSelectedRequest((prev) =>
        prev ? { ...prev, status: editStatus, admin_note: editNote || null } : null
      );
    } catch (err) {
      console.error('Error updating support request:', err);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const statusCounts = {
    all: requests.length,
    pending: requests.filter((r) => r.status === 'pending').length,
    in_progress: requests.filter((r) => r.status === 'in_progress').length,
    completed: requests.filter((r) => r.status === 'completed').length,
  };

  if (profile?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-neutral-500 dark:text-neutral-400">접근 권한이 없습니다.</p>
      </div>
    );
  }

  // 상세 보기
  if (selectedRequest) {
    const statusConfig = STATUS_CONFIG[selectedRequest.status as Status];
    const StatusIcon = statusConfig.icon;
    return (
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => setSelectedRequest(null)}
          className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft size={18} />
          <span>목록으로 돌아가기</span>
        </button>

        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          {/* 헤더 */}
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig.bgColor} ${statusConfig.color}`}>
                    <StatusIcon size={12} className={selectedRequest.status === 'in_progress' ? 'animate-spin' : ''} />
                    {statusConfig.label}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                    selectedRequest.request_type === 'bug_report'
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
                      : 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800'
                  }`}>
                    {selectedRequest.request_type === 'bug_report' ? <Bug size={12} /> : <Lightbulb size={12} />}
                    {selectedRequest.request_type === 'bug_report' ? '버그 신고' : '기능 요청'}
                  </span>
                </div>
                <h1 className="text-xl font-bold text-neutral-900 dark:text-white">
                  {selectedRequest.title}
                </h1>
                <div className="flex items-center gap-4 mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                  <span className="flex items-center gap-1">
                    <User size={14} />
                    {getUserName(selectedRequest)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Building2 size={14} />
                    {getAcademyName(selectedRequest)}
                  </span>
                  <span>{formatDate(selectedRequest.created_at)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 본문 */}
          <div className="p-6 space-y-6">
            {selectedRequest.request_type === 'bug_report' && selectedRequest.bug_situation && (
              <div>
                <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                  어떤 상황에서 발생하나요?
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 text-sm whitespace-pre-wrap">
                  {selectedRequest.bug_situation}
                </p>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                현재 상태
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 text-sm whitespace-pre-wrap">
                {selectedRequest.current_state}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                개선 요청안
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 text-sm whitespace-pre-wrap">
                {selectedRequest.improvement_request}
              </p>
            </div>
          </div>

          {/* 관리자 영역 */}
          <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
              <MessageSquare size={16} />
              관리자 처리
            </h3>

            <div className="space-y-4">
              {/* 상태 변경 */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  처리 상태
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(STATUS_CONFIG) as [Status, typeof STATUS_CONFIG[Status]][]).map(([key, config]) => {
                    const SIcon = config.icon;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setEditStatus(key)}
                        className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg border-2 text-xs font-medium transition-all ${
                          editStatus === key
                            ? `${config.bgColor} ${config.color} border-current`
                            : 'border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600'
                        }`}
                      >
                        <SIcon size={14} className={editStatus === key && key === 'in_progress' ? 'animate-spin' : ''} />
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 관리자 메모 */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  관리자 메모
                </label>
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="처리 현황 또는 안내사항을 작성해주세요..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00] focus:border-transparent outline-none transition-all text-sm resize-none"
                />
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-2.5 bg-neutral-900 dark:bg-[#CCFF00] text-white dark:text-black font-semibold rounded-xl hover:bg-neutral-800 dark:hover:bg-[#CCFF00]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    저장
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 목록 뷰
  return (
    <div>
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
          고장신고 / 개발요청 관리
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          모든 학원에서 접수된 버그 신고 및 기능 요청을 관리합니다.
        </p>
      </div>

      {/* 상태별 카운트 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <p className="text-2xl font-bold text-neutral-900 dark:text-white">{statusCounts.all}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">전체</p>
        </div>
        <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{statusCounts.pending}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">접수대기중</p>
        </div>
        <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{statusCounts.in_progress}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">구현중</p>
        </div>
        <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{statusCounts.completed}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">처리완료</p>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Filter size={14} className="text-neutral-400" />
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">필터:</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 outline-none focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00]"
          >
            <option value="all">전체 유형</option>
            <option value="bug_report">버그 신고</option>
            <option value="feature_request">기능 요청</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 outline-none focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00]"
          >
            <option value="all">전체 상태</option>
            <option value="pending">접수대기중</option>
            <option value="in_progress">구현중</option>
            <option value="completed">처리완료</option>
          </select>
        </div>
      </div>

      {/* 요청 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-neutral-400" />
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <AlertTriangle size={40} className="mx-auto text-neutral-300 dark:text-neutral-600 mb-3" />
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">
            {requests.length === 0 ? '접수된 요청이 없습니다.' : '조건에 맞는 요청이 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRequests.map((req) => {
            const statusConfig = STATUS_CONFIG[req.status as Status];
            const StatusIcon = statusConfig.icon;
            return (
              <button
                key={req.id}
                onClick={() => handleOpenDetail(req)}
                className="w-full text-left p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusConfig.bgColor} ${statusConfig.color}`}>
                        <StatusIcon size={10} className={req.status === 'in_progress' ? 'animate-spin' : ''} />
                        {statusConfig.label}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        req.request_type === 'bug_report'
                          ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
                          : 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800'
                      }`}>
                        {req.request_type === 'bug_report' ? '버그' : '기능요청'}
                      </span>
                    </div>
                    <h3 className="font-semibold text-neutral-900 dark:text-white text-sm truncate">
                      {req.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                      <span className="flex items-center gap-1">
                        <User size={12} />
                        {getUserName(req)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Building2 size={12} />
                        {getAcademyName(req)}
                      </span>
                      <span>{formatDate(req.created_at)}</span>
                    </div>
                  </div>
                  <ChevronDown size={16} className="text-neutral-400 -rotate-90 flex-shrink-0 mt-1" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
