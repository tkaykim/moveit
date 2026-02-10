"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import {
  AlertTriangle,
  Lightbulb,
  Bug,
  Plus,
  ArrowLeft,
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
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
}

const STATUS_CONFIG: Record<Status, { label: string; color: string; bgColor: string; icon: typeof Clock }> = {
  pending: { label: '접수대기중', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800', icon: Clock },
  in_progress: { label: '구현중', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800', icon: Loader2 },
  completed: { label: '처리완료', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800', icon: CheckCircle2 },
};

export default function SupportPage() {
  const params = useParams();
  const academyId = params.academyId as string;
  const { user, profile } = useAuth();

  const [view, setView] = useState<'list' | 'form'>('list');
  const [requestType, setRequestType] = useState<RequestType>('bug_report');
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [bugSituation, setBugSituation] = useState('');
  const [currentState, setCurrentState] = useState('');
  const [improvementRequest, setImprovementRequest] = useState('');

  const fetchRequests = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase || !user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('support_requests')
        .select('*')
        .eq('user_id', user.id)
        .eq('academy_id', academyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data || []) as SupportRequest[]);
    } catch (err) {
      console.error('Error fetching support requests:', err);
    } finally {
      setLoading(false);
    }
  }, [user, academyId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const resetForm = () => {
    setTitle('');
    setBugSituation('');
    setCurrentState('');
    setImprovementRequest('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !user) return;

    setSubmitting(true);
    try {
      const payload: any = {
        request_type: requestType,
        title,
        current_state: currentState,
        improvement_request: improvementRequest,
        user_id: user.id,
        academy_id: academyId,
      };

      if (requestType === 'bug_report') {
        payload.bug_situation = bugSituation;
      }

      const { error } = await supabase
        .from('support_requests')
        .insert([payload]);

      if (error) throw error;

      resetForm();
      setView('list');
      fetchRequests();
    } catch (err) {
      console.error('Error submitting support request:', err);
      alert('제출 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

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
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
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
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                  {formatDate(selectedRequest.created_at)}
                </p>
              </div>
            </div>
          </div>

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

            {selectedRequest.admin_note && (
              <div className="border-t border-neutral-200 dark:border-neutral-800 pt-6">
                <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                  관리자 메모
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm whitespace-pre-wrap">
                  {selectedRequest.admin_note}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 폼 뷰
  if (view === 'form') {
    return (
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => { setView('list'); resetForm(); }}
          className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft size={18} />
          <span>목록으로 돌아가기</span>
        </button>

        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">
              {requestType === 'bug_report' ? '버그 신고' : '기능 요청'}
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              빠르고 정확한 처리를 위해 최대한 자세히 작성을 부탁드립니다.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* 요청 유형 선택 */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                요청 유형
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRequestType('bug_report')}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    requestType === 'bug_report'
                      ? 'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/20'
                      : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                  }`}
                >
                  <Bug size={20} className={requestType === 'bug_report' ? 'text-red-500' : 'text-neutral-400'} />
                  <div className="text-left">
                    <p className={`text-sm font-semibold ${requestType === 'bug_report' ? 'text-red-600 dark:text-red-400' : 'text-neutral-700 dark:text-neutral-300'}`}>
                      버그 신고
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      잘못 작동되는 게 있나요?
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setRequestType('feature_request')}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    requestType === 'feature_request'
                      ? 'border-purple-400 dark:border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                  }`}
                >
                  <Lightbulb size={20} className={requestType === 'feature_request' ? 'text-purple-500' : 'text-neutral-400'} />
                  <div className="text-left">
                    <p className={`text-sm font-semibold ${requestType === 'feature_request' ? 'text-purple-600 dark:text-purple-400' : 'text-neutral-700 dark:text-neutral-300'}`}>
                      기능 요청
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      필요한 기능이 있으신가요?
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* 제목 */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                제목 <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={requestType === 'bug_report' ? '예: 스케줄 페이지에서 날짜 선택이 안 됩니다' : '예: 수강생 출석 통계 기능 추가 요청'}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00] focus:border-transparent outline-none transition-all text-sm"
              />
            </div>

            {/* 버그 상황 (버그 신고 전용) */}
            {requestType === 'bug_report' && (
              <div>
                <label htmlFor="bugSituation" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  어떤 상황에서 발생하나요? <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="bugSituation"
                  required
                  value={bugSituation}
                  onChange={(e) => setBugSituation(e.target.value)}
                  placeholder="예: 스케줄 관리 페이지에서 날짜를 클릭하면 아무 반응이 없습니다. 크롬 브라우저에서 발생합니다."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00] focus:border-transparent outline-none transition-all text-sm resize-none"
                />
              </div>
            )}

            {/* 현재 상태 */}
            <div>
              <label htmlFor="currentState" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                현재 상태 <span className="text-red-500">*</span>
              </label>
              <textarea
                id="currentState"
                required
                value={currentState}
                onChange={(e) => setCurrentState(e.target.value)}
                placeholder={requestType === 'bug_report'
                  ? '예: 달력에서 날짜를 선택하면 오류 메시지가 표시됩니다.'
                  : '예: 현재는 수강생 출석을 일일이 확인해야 합니다.'}
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00] focus:border-transparent outline-none transition-all text-sm resize-none"
              />
            </div>

            {/* 개선 요청안 */}
            <div>
              <label htmlFor="improvementRequest" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                개선 요청안 <span className="text-red-500">*</span>
              </label>
              <textarea
                id="improvementRequest"
                required
                value={improvementRequest}
                onChange={(e) => setImprovementRequest(e.target.value)}
                placeholder={requestType === 'bug_report'
                  ? '예: 날짜를 클릭하면 해당 날짜의 스케줄이 정상적으로 표시되어야 합니다.'
                  : '예: 월간/주간 출석 통계를 한눈에 볼 수 있는 대시보드가 있으면 좋겠습니다.'}
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00] focus:border-transparent outline-none transition-all text-sm resize-none"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-neutral-900 dark:bg-[#CCFF00] text-white dark:text-black font-semibold rounded-xl hover:bg-neutral-800 dark:hover:bg-[#CCFF00]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    제출 중...
                  </>
                ) : (
                  '제출하기'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 목록 뷰
  return (
    <div className="max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
            고장신고 / 개발요청사항
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            버그 신고 및 기능 개선 요청을 접수하고 처리 상태를 확인할 수 있습니다.
          </p>
        </div>
        <button
          onClick={() => setView('form')}
          className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 dark:bg-[#CCFF00] text-white dark:text-black font-semibold rounded-xl hover:bg-neutral-800 dark:hover:bg-[#CCFF00]/90 transition-all text-sm"
        >
          <Plus size={16} />
          새 요청
        </button>
      </div>

      {/* 카드 형태의 안내 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="p-5 rounded-2xl border-2 border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <Bug size={20} className="text-red-500" />
            </div>
            <h3 className="font-semibold text-neutral-900 dark:text-white text-sm">잘못 작동되는 게 있나요?</h3>
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            오류, 버그 등 정상적으로 작동하지 않는 기능을 신고해주세요.
          </p>
          <button
            onClick={() => { setRequestType('bug_report'); setView('form'); }}
            className="mt-3 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
          >
            버그 신고하기 &rarr;
          </button>
        </div>
        <div className="p-5 rounded-2xl border-2 border-purple-100 dark:border-purple-900/30 bg-purple-50/50 dark:bg-purple-900/10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Lightbulb size={20} className="text-purple-500" />
            </div>
            <h3 className="font-semibold text-neutral-900 dark:text-white text-sm">필요한 기능이 있으신가요?</h3>
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            추가되었으면 하는 기능이나 개선사항을 요청해주세요.
          </p>
          <button
            onClick={() => { setRequestType('feature_request'); setView('form'); }}
            className="mt-3 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline"
          >
            기능 요청하기 &rarr;
          </button>
        </div>
      </div>

      {/* 내 요청 목록 */}
      <div>
        <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">
          내 요청 목록
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-neutral-400" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
            <AlertCircle size={40} className="mx-auto text-neutral-300 dark:text-neutral-600 mb-3" />
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              아직 접수한 요청이 없습니다.
            </p>
            <p className="text-neutral-400 dark:text-neutral-500 text-xs mt-1">
              위 카드를 클릭하여 새 요청을 작성해보세요.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const statusConfig = STATUS_CONFIG[req.status as Status];
              const StatusIcon = statusConfig.icon;
              return (
                <button
                  key={req.id}
                  onClick={() => setSelectedRequest(req)}
                  className="w-full text-left p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
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
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                        {formatDate(req.created_at)}
                      </p>
                    </div>
                    <ChevronDown size={16} className="text-neutral-400 -rotate-90 flex-shrink-0 mt-1" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
