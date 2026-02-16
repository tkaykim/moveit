"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bell, Users, Send, Loader2, CheckCircle, XCircle,
  FlaskConical, ChevronDown, ChevronUp, Calendar, UserCheck2,
  Ticket, Video, MessageSquare, Megaphone, Clock, AlertTriangle,
  User, BookOpen, Image as ImageIcon,
} from 'lucide-react';
import { authFetch } from '@/lib/supabase/auth-fetch';

/* ───── 시나리오 정의 ───── */
interface ScenarioContext {
  user?: any;
  booking?: any;
  ticket?: any;
  classItem?: any;
  schedule?: any;
  academy?: any;
}

interface Scenario {
  id: string;
  icon: any;
  label: string;
  category: string;
  color: string;
  description: string;
  requiredData: ('user' | 'booking' | 'ticket' | 'class' | 'schedule')[];
  generateMessage: (ctx: ScenarioContext) => { title: string; body: string; type: string; path: string };
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = hour >= 12 ? '오후' : '오전';
  const h12 = hour > 12 ? hour - 12 : hour || 12;
  return `${month}/${day} ${ampm} ${h12}:${min}`;
}

const SCENARIOS: Scenario[] = [
  {
    id: 'booking_confirmed', icon: Calendar, label: '예약 확인', category: '예약',
    color: 'text-teal-600 bg-teal-50 dark:bg-teal-900/20 dark:text-teal-400',
    description: '수업 예약 완료 알림', requiredData: ['user', 'class', 'schedule'],
    generateMessage: (ctx) => {
      const academy = ctx.academy?.name_kr || ctx.schedule?.academy_name || '학원';
      const cls = ctx.schedule?.class_title || ctx.classItem?.title || '수업';
      const time = ctx.schedule?.start_time ? ` ${formatTime(ctx.schedule.start_time)}` : '';
      return { title: '예약 완료', body: `${academy} ${cls} 수업이 예약되었습니다.${time}`, type: 'booking_confirmed', path: '/my/bookings' };
    },
  },
  {
    id: 'booking_cancelled', icon: Calendar, label: '예약 취소', category: '예약',
    color: 'text-neutral-600 bg-neutral-100 dark:bg-neutral-800 dark:text-neutral-400',
    description: '수업 예약 취소 알림', requiredData: ['user', 'class', 'schedule'],
    generateMessage: (ctx) => {
      const academy = ctx.academy?.name_kr || '학원';
      const cls = ctx.schedule?.class_title || ctx.classItem?.title || '수업';
      const time = ctx.schedule?.start_time ? ` (${formatTime(ctx.schedule.start_time)})` : '';
      return { title: '예약 취소', body: `${academy} ${cls} 예약이 취소되었습니다.${time}`, type: 'booking_cancelled', path: '/my/bookings' };
    },
  },
  {
    id: 'class_reminder', icon: Clock, label: '수업 당일 알림', category: '수업',
    color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400',
    description: '오늘 수업 예정 알림', requiredData: ['user', 'class', 'schedule'],
    generateMessage: (ctx) => {
      const academy = ctx.academy?.name_kr || '학원';
      const cls = ctx.schedule?.class_title || ctx.classItem?.title || '수업';
      const time = ctx.schedule?.start_time ? formatTime(ctx.schedule.start_time) : '오후';
      return { title: '오늘 수업이 있어요!', body: `${time} ${academy} ${cls} 수업이 예정되어 있습니다. 준비물을 확인해주세요!`, type: 'class_reminder', path: '/my/bookings' };
    },
  },
  {
    id: 'attendance_checked', icon: UserCheck2, label: '출석 확인', category: '출석',
    color: 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400',
    description: '출석 처리 완료 알림', requiredData: ['user', 'class', 'schedule'],
    generateMessage: (ctx) => {
      const academy = ctx.academy?.name_kr || '학원';
      const cls = ctx.schedule?.class_title || ctx.classItem?.title || '수업';
      const time = ctx.schedule?.start_time ? ` ${formatTime(ctx.schedule.start_time)}` : '';
      return { title: '출석 체크 완료', body: `${academy} ${cls} 출석이 확인되었습니다.${time}`, type: 'attendance_checked', path: '/my/bookings' };
    },
  },
  {
    id: 'attendance_absent', icon: AlertTriangle, label: '결석 알림', category: '출석',
    color: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
    description: '수업 결석 알림', requiredData: ['user', 'class', 'schedule'],
    generateMessage: (ctx) => {
      const academy = ctx.academy?.name_kr || '학원';
      const cls = ctx.schedule?.class_title || ctx.classItem?.title || '수업';
      const userName = ctx.user?.name || '수강생';
      return { title: '결석 알림', body: `${userName}님이 ${academy} ${cls} 수업에 결석하였습니다.`, type: 'attendance_absent', path: '/my/bookings' };
    },
  },
  {
    id: 'ticket_expiry_7d', icon: Ticket, label: '수강권 만료 D-7', category: '수강권',
    color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400',
    description: '수강권 7일 전 만료 알림', requiredData: ['user', 'ticket'],
    generateMessage: (ctx) => {
      const academy = ctx.academy?.name_kr || ctx.ticket?.academy_name || '학원';
      const ticketName = ctx.ticket?.ticket_name || '수강권';
      const remaining = ctx.ticket?.remaining_count;
      const remainStr = remaining != null ? ` 남은 횟수: ${remaining}회` : '';
      return { title: '수강권 만료 임박 (D-7)', body: `${academy} ${ticketName}이(가) 7일 후 만료됩니다.${remainStr} 연장 신청을 해주세요.`, type: 'ticket_expiring', path: '/my/tickets' };
    },
  },
  {
    id: 'ticket_expiry_3d', icon: Ticket, label: '수강권 만료 D-3', category: '수강권',
    color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400',
    description: '수강권 3일 전 만료 알림', requiredData: ['user', 'ticket'],
    generateMessage: (ctx) => {
      const academy = ctx.academy?.name_kr || ctx.ticket?.academy_name || '학원';
      const ticketName = ctx.ticket?.ticket_name || '수강권';
      const remaining = ctx.ticket?.remaining_count;
      const remainStr = remaining != null ? ` 남은 횟수: ${remaining}회` : '';
      return { title: '수강권 만료 임박 (D-3)', body: `${academy} ${ticketName}이(가) 3일 후 만료됩니다.${remainStr} 서둘러 사용하세요!`, type: 'ticket_expiring', path: '/my/tickets' };
    },
  },
  {
    id: 'ticket_expiry_1d', icon: Ticket, label: '수강권 만료 D-1', category: '수강권',
    color: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
    description: '수강권 내일 만료 알림', requiredData: ['user', 'ticket'],
    generateMessage: (ctx) => {
      const academy = ctx.academy?.name_kr || ctx.ticket?.academy_name || '학원';
      const ticketName = ctx.ticket?.ticket_name || '수강권';
      const remaining = ctx.ticket?.remaining_count;
      const remainStr = remaining != null ? ` 남은 횟수: ${remaining}회.` : '';
      return { title: '수강권 내일 만료!', body: `${academy} ${ticketName}이(가) 내일 만료됩니다!${remainStr} 지금 연장 신청하세요.`, type: 'ticket_expiring', path: '/my/tickets' };
    },
  },
  {
    id: 'video_uploaded', icon: Video, label: '수업 영상 등록', category: '콘텐츠',
    color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400',
    description: '수업 영상 업로드 알림', requiredData: ['user', 'class'],
    generateMessage: (ctx) => {
      const academy = ctx.academy?.name_kr || '학원';
      const cls = ctx.classItem?.title || '수업';
      const today = new Date();
      const dateStr = `${today.getMonth() + 1}/${today.getDate()}`;
      return { title: '수업 영상이 등록되었습니다', body: `${dateStr} ${academy} ${cls} 수업 영상이 업로드되었습니다. 지금 확인해보세요!`, type: 'video_uploaded', path: '/my/bookings' };
    },
  },
  {
    id: 'consultation_reply', icon: MessageSquare, label: '상담 답변', category: '상담',
    color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-400',
    description: '상담 답변 등록 알림', requiredData: ['user'],
    generateMessage: (ctx) => {
      const academy = ctx.academy?.name_kr || '학원';
      return { title: '상담 답변이 도착했습니다', body: `${academy}에서 문의하신 상담에 답변이 등록되었습니다.`, type: 'consultation_reply', path: '/notifications' };
    },
  },
  {
    id: 'marketing', icon: Megaphone, label: '공지/이벤트', category: '마케팅',
    color: 'text-pink-600 bg-pink-50 dark:bg-pink-900/20 dark:text-pink-400',
    description: '이벤트/프로모션 알림', requiredData: ['user'],
    generateMessage: (ctx) => {
      const academy = ctx.academy?.name_kr || '학원';
      return { title: `${academy} 이벤트 안내`, body: `특별 이벤트가 진행 중입니다! 자세한 내용을 확인해보세요.`, type: 'marketing', path: '/' };
    },
  },
];

/* ───── Main Component ───── */
interface PushNotificationViewProps {
  academyId: string;
}

export function PushNotificationView({ academyId }: PushNotificationViewProps) {
  const [activeTab, setActiveTab] = useState<'scenario' | 'custom'>('scenario');
  const [summary, setSummary] = useState<{ total_students: number; active_tokens: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchSummary(); }, [academyId]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const res = await authFetch(`/api/academy-admin/${academyId}/push`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
      }
    } catch (err) {
      console.error('Error fetching push summary:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
          <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">알림 발송</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">수강생들에게 푸시 알림을 발송합니다</p>
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-neutral-800 rounded-lg p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Users className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-xs text-neutral-500">수강생</p>
              <p className="text-xl font-bold text-neutral-900 dark:text-white">{loading ? '-' : `${summary?.total_students || 0}명`}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-neutral-800 rounded-lg p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Bell className="w-7 h-7 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-xs text-neutral-500">활성 디바이스</p>
              <p className="text-xl font-bold text-neutral-900 dark:text-white">{loading ? '-' : `${summary?.active_tokens || 0}개`}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('scenario')}
          className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all ${
            activeTab === 'scenario'
              ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}
        >
          <FlaskConical size={14} className="inline mr-1.5" />시나리오 알림
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all ${
            activeTab === 'custom'
              ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}
        >
          <Send size={14} className="inline mr-1.5" />직접 작성
        </button>
      </div>

      {activeTab === 'scenario' && (
        <ScenarioSection academyId={academyId} onSent={fetchSummary} />
      )}
      {activeTab === 'custom' && (
        <CustomSendSection academyId={academyId} onSent={fetchSummary} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   시나리오 알림 섹션
   ═══════════════════════════════════════════════════════════ */
function ScenarioSection({ academyId, onSent }: { academyId: string; onSent: () => void }) {
  const [scenarioData, setScenarioData] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(false);

  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedScheduleId, setSelectedScheduleId] = useState('');

  const [userSearch, setUserSearch] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatedBody, setGeneratedBody] = useState('');
  const [generatedPath, setGeneratedPath] = useState('');

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (selectedUserId) fetchData(selectedUserId); }, [selectedUserId]);

  const fetchData = async (userId?: string) => {
    try {
      setLoadingData(true);
      const url = userId
        ? `/api/academy-admin/${academyId}/push/scenario-data?user_id=${userId}`
        : `/api/academy-admin/${academyId}/push/scenario-data`;
      const res = await authFetch(url);
      if (res.ok) {
        const data = await res.json();
        setScenarioData((prev: any) => ({ ...(prev || {}), ...data }));
      }
    } catch (err) {
      console.error('Failed to fetch scenario data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const scenario = useMemo(() => SCENARIOS.find(s => s.id === selectedScenario), [selectedScenario]);

  const filteredUsers = useMemo(() => {
    const all = scenarioData?.users || [];
    if (!userSearch.trim()) return all.slice(0, 50);
    const q = userSearch.toLowerCase();
    return all.filter((u: any) =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }, [scenarioData?.users, userSearch]);

  const selectedUser = useMemo(() => scenarioData?.users?.find((u: any) => u.id === selectedUserId), [scenarioData?.users, selectedUserId]);
  const selectedTicket = useMemo(() => scenarioData?.user_tickets?.find((t: any) => t.id === selectedTicketId), [scenarioData?.user_tickets, selectedTicketId]);
  const selectedClass = useMemo(() => scenarioData?.classes?.find((c: any) => c.id === selectedClassId), [scenarioData?.classes, selectedClassId]);
  const selectedSchedule = useMemo(() => scenarioData?.schedules?.find((s: any) => s.id === selectedScheduleId), [scenarioData?.schedules, selectedScheduleId]);

  const generateMessage = useCallback(() => {
    if (!scenario) return;
    const msg = scenario.generateMessage({
      user: selectedUser,
      ticket: selectedTicket,
      classItem: selectedClass,
      schedule: selectedSchedule,
      academy: scenarioData?.academy,
    });
    setGeneratedTitle(msg.title);
    setGeneratedBody(msg.body);
    setGeneratedPath(msg.path);
    setResult(null);
  }, [scenario, selectedUser, selectedTicket, selectedClass, selectedSchedule, scenarioData?.academy]);

  useEffect(() => {
    if (scenario && selectedUserId) generateMessage();
  }, [selectedScenario, selectedUserId, selectedTicketId, selectedClassId, selectedScheduleId]);

  const handleSend = async () => {
    if (!generatedTitle || !generatedBody) return setResult({ success: false, message: '메시지를 먼저 생성하세요.' });
    if (!selectedUserId) return setResult({ success: false, message: '대상 유저를 선택하세요.' });

    setSending(true);
    setResult(null);
    try {
      const data: Record<string, string> = { display_style: 'big_text' };
      if (generatedPath) data.path = generatedPath;

      const res = await authFetch(`/api/academy-admin/${academyId}/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'specific',
          user_ids: [selectedUserId],
          title: generatedTitle,
          body: generatedBody,
          data,
        }),
      });
      const resData = await res.json();
      if (res.ok) {
        setResult({ success: true, message: `${selectedUser?.name || '유저'}에게 알림 발송 완료!` });
        onSent();
      } else {
        setResult({ success: false, message: resData.error || '발송 실패' });
      }
    } catch (err: any) {
      setResult({ success: false, message: err.message });
    } finally {
      setSending(false);
    }
  };

  const needsClass = scenario?.requiredData.includes('class');
  const needsSchedule = scenario?.requiredData.includes('schedule');
  const needsTicket = scenario?.requiredData.includes('ticket');

  const scenariosByCategory = useMemo(() => {
    const cats: Record<string, Scenario[]> = {};
    SCENARIOS.forEach(s => { if (!cats[s.category]) cats[s.category] = []; cats[s.category].push(s); });
    return cats;
  }, []);

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6 space-y-6">
      {/* Step 1: 시나리오 */}
      <div className="space-y-3">
        <StepLabel step={1} label="시나리오 선택" />
        {Object.entries(scenariosByCategory).map(([cat, items]) => (
          <div key={cat}>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">{cat}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {items.map(s => {
                const Icon = s.icon;
                const active = selectedScenario === s.id;
                return (
                  <button key={s.id} type="button" onClick={() => { setSelectedScenario(s.id); setResult(null); }}
                    className={`text-left p-2.5 rounded-lg border transition-all ${active ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500' : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-400'}`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <div className={`w-5 h-5 rounded flex items-center justify-center ${s.color}`}><Icon size={11} /></div>
                      <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200">{s.label}</span>
                    </div>
                    <p className="text-[10px] text-neutral-400 leading-tight">{s.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Step 2: 유저 */}
      {selectedScenario && (
        <div className="space-y-3">
          <StepLabel step={2} label="대상 수강생 선택" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <User size={14} className="text-neutral-400" />
              <input type="text" value={userSearch}
                onChange={e => { setUserSearch(e.target.value); setShowUserDropdown(true); }}
                onFocus={() => setShowUserDropdown(true)}
                placeholder="이름, 이메일, 전화번호로 검색..."
                className="flex-1 px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {selectedUser && (
              <div className="mt-2 flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <User size={14} className="text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{selectedUser.name || selectedUser.email}</span>
                <span className="text-xs text-blue-500">{selectedUser.email}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ml-auto ${selectedUser.has_token ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-red-100 dark:bg-red-900/30 text-red-600'}`}>
                  {selectedUser.has_token ? '토큰 있음' : '토큰 없음'}
                </span>
              </div>
            )}
            {showUserDropdown && (
              <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg">
                {loadingData && !scenarioData?.users ? (
                  <div className="p-4 text-center text-sm text-neutral-500"><Loader2 size={16} className="animate-spin inline mr-2" />로딩 중...</div>
                ) : filteredUsers.length === 0 ? (
                  <div className="p-4 text-center text-sm text-neutral-500">검색 결과 없음</div>
                ) : filteredUsers.map((u: any) => (
                  <button key={u.id} type="button"
                    onClick={() => { setSelectedUserId(u.id); setUserSearch(u.name || u.email); setShowUserDropdown(false); setSelectedTicketId(''); }}
                    className={`w-full text-left px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-700 border-b border-neutral-100 dark:border-neutral-700 last:border-0 ${selectedUserId === u.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-white">{u.name || '이름 없음'}</p>
                        <p className="text-xs text-neutral-500">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {u.has_token && <span className="w-2 h-2 bg-green-500 rounded-full" />}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: 데이터 선택 */}
      {selectedScenario && selectedUserId && (
        <div className="space-y-3">
          <StepLabel step={3} label="관련 데이터 선택" />
          {(needsClass || needsSchedule) && (
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400"><BookOpen size={12} /> 수업</label>
              <select value={selectedClassId} onChange={e => { setSelectedClassId(e.target.value); setSelectedScheduleId(''); }}
                className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none">
                <option value="">수업을 선택하세요</option>
                {(scenarioData?.classes || []).map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
          )}
          {needsSchedule && selectedClassId && (
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400"><Calendar size={12} /> 시간대</label>
              <select value={selectedScheduleId} onChange={e => setSelectedScheduleId(e.target.value)}
                className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none">
                <option value="">시간대를 선택하세요 (선택)</option>
                {(scenarioData?.schedules || []).filter((s: any) => s.class_id === selectedClassId).map((s: any) => (
                  <option key={s.id} value={s.id}>{formatTime(s.start_time)}</option>
                ))}
              </select>
            </div>
          )}
          {needsTicket && (
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400"><Ticket size={12} /> 수강권</label>
              {(scenarioData?.user_tickets || []).length === 0 ? (
                <p className="text-xs text-neutral-400 p-2 bg-neutral-50 dark:bg-neutral-900 rounded-lg">해당 수강생의 활성 수강권이 없습니다</p>
              ) : (
                <select value={selectedTicketId} onChange={e => setSelectedTicketId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none">
                  <option value="">수강권을 선택하세요</option>
                  {(scenarioData?.user_tickets || []).map((t: any) => (
                    <option key={t.id} value={t.id}>{t.ticket_name}{t.remaining_count != null ? ` (${t.remaining_count}회)` : ''}{t.expiry_date ? ` ~${t.expiry_date}` : ''}</option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 4: 미리보기 & 발송 */}
      {generatedTitle && (
        <div className="space-y-3">
          <StepLabel step={4} label="메시지 미리보기 (수정 가능)" />
          <div className="bg-neutral-100 dark:bg-neutral-900 rounded-xl p-4">
            <p className="text-[10px] font-medium text-neutral-400 uppercase mb-2">푸시 알림 미리보기</p>
            <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm overflow-hidden max-w-sm">
              <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                <div className="w-4 h-4 rounded bg-blue-500" /><span className="text-[10px] text-neutral-500 font-medium">MOVE.IT</span>
                <span className="text-[10px] text-neutral-400 ml-auto">지금</span>
              </div>
              <div className="px-3 pb-3">
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">{generatedTitle}</p>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5 whitespace-pre-wrap">{generatedBody}</p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">제목</label>
              <input type="text" value={generatedTitle} onChange={e => setGeneratedTitle(e.target.value)}
                className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">내용</label>
              <textarea value={generatedBody} onChange={e => setGeneratedBody(e.target.value)} rows={3}
                className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">클릭 시 이동</label>
              <input type="text" value={generatedPath} onChange={e => setGeneratedPath(e.target.value)}
                className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none" />
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${result.success ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
          {result.success ? <CheckCircle size={16} /> : <XCircle size={16} />}{result.message}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={generateMessage} disabled={!selectedScenario || !selectedUserId}
          className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 text-sm">
          <FlaskConical size={16} /> 재생성
        </button>
        <button onClick={handleSend} disabled={sending || !generatedTitle || !generatedBody || !selectedUserId}
          className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 text-sm">
          {sending ? <><Loader2 size={16} className="animate-spin" /> 발송 중...</> : <><Send size={16} /> 발송</>}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   직접 작성 섹션
   ═══════════════════════════════════════════════════════════ */
function CustomSendSection({ academyId, onSent }: { academyId: string; onSent: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [clickPath, setClickPath] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSend = async () => {
    if (!title || !body) return setResult({ success: false, message: '제목과 내용을 입력해주세요.' });
    setSending(true);
    setResult(null);
    try {
      const data: any = { display_style: 'big_text' };
      if (clickPath) data.path = clickPath;
      if (imageUrl) data.image_url = imageUrl;

      const res = await authFetch(`/api/academy-admin/${academyId}/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'all', title, body, image_url: imageUrl || undefined, data }),
      });
      const resData = await res.json();
      if (res.ok) {
        setResult({ success: true, message: `${resData.sent_count}명에게 알림 발송 완료!` });
        setTitle(''); setBody(''); setImageUrl(''); setClickPath('');
        onSent();
      } else {
        setResult({ success: false, message: resData.error || '발송 실패' });
      }
    } catch (err: any) {
      setResult({ success: false, message: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6 space-y-4">
      <p className="text-sm text-neutral-500">전체 수강생에게 자유 형식의 알림을 발송합니다.</p>
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">제목 *</label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="알림 제목"
          className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none" />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">내용 *</label>
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="알림 내용" rows={4}
          className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none resize-none" />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">이미지 URL (선택)</label>
        <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..."
          className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none" />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">클릭 시 이동 경로 (선택)</label>
        <input type="text" value={clickPath} onChange={e => setClickPath(e.target.value)} placeholder="/my/bookings"
          className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none" />
      </div>
      {result && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${result.success ? 'bg-green-50 dark:bg-green-900/20 text-green-700' : 'bg-red-50 dark:bg-red-900/20 text-red-700'}`}>
          {result.success ? <CheckCircle size={16} /> : <XCircle size={16} />}{result.message}
        </div>
      )}
      <button onClick={handleSend} disabled={sending || !title || !body}
        className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 text-sm">
        {sending ? <><Loader2 size={16} className="animate-spin" /> 발송 중...</> : <><Send size={16} /> 전체 수강생 알림 발송</>}
      </button>
    </div>
  );
}

/* ───── StepLabel ───── */
function StepLabel({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">{step}</div>
      <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{label}</span>
    </div>
  );
}
