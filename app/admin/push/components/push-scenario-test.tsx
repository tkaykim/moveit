"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FlaskConical, Search, ChevronDown, ChevronUp, Send, Loader2,
  CheckCircle, XCircle, Calendar, UserCheck2, Ticket, Video,
  MessageSquare, Megaphone, Bell, Clock, AlertTriangle, User,
  Building2, BookOpen,
} from 'lucide-react';
import { authFetch } from '@/lib/supabase/auth-fetch';

/* ───── 시나리오 정의 ───── */
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

interface ScenarioContext {
  user?: any;
  booking?: any;
  ticket?: any;
  classItem?: any;
  schedule?: any;
  academy?: any;
}

const SCENARIOS: Scenario[] = [
  {
    id: 'booking_confirmed',
    icon: Calendar,
    label: '예약 확인',
    category: '예약',
    color: 'text-teal-600 bg-teal-50 dark:bg-teal-900/20 dark:text-teal-400',
    description: '수업 예약이 완료되었을 때 발송되는 알림',
    requiredData: ['user', 'class', 'schedule'],
    generateMessage: (ctx) => {
      const academy = ctx.schedule?.academy_name || ctx.classItem?.academy_name || '학원';
      const cls = ctx.schedule?.class_title || ctx.classItem?.title || '수업';
      const time = ctx.schedule?.start_time ? formatTime(ctx.schedule.start_time) : '';
      return {
        title: '예약 완료',
        body: `${academy} ${cls} 수업이 예약되었습니다.${time ? ` ${time}` : ''}`,
        type: 'booking_confirmed',
        path: '/my/bookings',
      };
    },
  },
  {
    id: 'booking_cancelled',
    icon: Calendar,
    label: '예약 취소',
    category: '예약',
    color: 'text-neutral-600 bg-neutral-100 dark:bg-neutral-800 dark:text-neutral-400',
    description: '수업 예약이 취소되었을 때 발송되는 알림',
    requiredData: ['user', 'class', 'schedule'],
    generateMessage: (ctx) => {
      const academy = ctx.schedule?.academy_name || ctx.classItem?.academy_name || '학원';
      const cls = ctx.schedule?.class_title || ctx.classItem?.title || '수업';
      const time = ctx.schedule?.start_time ? ` (${formatTime(ctx.schedule.start_time)})` : '';
      return {
        title: '예약 취소',
        body: `${academy} ${cls} 예약이 취소되었습니다.${time}`,
        type: 'booking_cancelled',
        path: '/my/bookings',
      };
    },
  },
  {
    id: 'class_reminder',
    icon: Clock,
    label: '수업 당일 알림',
    category: '수업',
    color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400',
    description: '오늘 예정된 수업이 있음을 알리는 알림',
    requiredData: ['user', 'class', 'schedule'],
    generateMessage: (ctx) => {
      const academy = ctx.schedule?.academy_name || ctx.classItem?.academy_name || '학원';
      const cls = ctx.schedule?.class_title || ctx.classItem?.title || '수업';
      const time = ctx.schedule?.start_time ? formatTime(ctx.schedule.start_time) : '오후';
      return {
        title: '오늘 수업이 있어요!',
        body: `${time} ${academy} ${cls} 수업이 예정되어 있습니다. 준비물을 확인해주세요!`,
        type: 'class_reminder',
        path: '/my/bookings',
      };
    },
  },
  {
    id: 'attendance_checked',
    icon: UserCheck2,
    label: '출석 확인',
    category: '출석',
    color: 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400',
    description: 'QR 또는 수동 출석 처리 시 발송되는 알림',
    requiredData: ['user', 'class', 'schedule'],
    generateMessage: (ctx) => {
      const academy = ctx.schedule?.academy_name || ctx.classItem?.academy_name || '학원';
      const cls = ctx.schedule?.class_title || ctx.classItem?.title || '수업';
      const time = ctx.schedule?.start_time ? ` ${formatTime(ctx.schedule.start_time)}` : '';
      return {
        title: '출석 체크 완료',
        body: `${academy} ${cls} 출석이 확인되었습니다.${time}`,
        type: 'attendance_checked',
        path: '/my/bookings',
      };
    },
  },
  {
    id: 'attendance_absent',
    icon: AlertTriangle,
    label: '결석 알림',
    category: '출석',
    color: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
    description: '수업에 결석한 경우 발송되는 알림',
    requiredData: ['user', 'class', 'schedule'],
    generateMessage: (ctx) => {
      const academy = ctx.schedule?.academy_name || ctx.classItem?.academy_name || '학원';
      const cls = ctx.schedule?.class_title || ctx.classItem?.title || '수업';
      const userName = ctx.user?.display_name || '수강생';
      return {
        title: '결석 알림',
        body: `${userName}님이 ${academy} ${cls} 수업에 결석하였습니다. 확인해주세요.`,
        type: 'attendance_absent',
        path: '/my/bookings',
      };
    },
  },
  {
    id: 'ticket_expiry_7d',
    icon: Ticket,
    label: '수강권 만료 D-7',
    category: '수강권',
    color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400',
    description: '수강권 만료 7일 전 알림',
    requiredData: ['user', 'ticket'],
    generateMessage: (ctx) => {
      const academy = ctx.ticket?.academy_name || '학원';
      const ticketName = ctx.ticket?.ticket_name || '수강권';
      const remaining = ctx.ticket?.remaining_count;
      const remainStr = remaining != null ? ` 남은 횟수: ${remaining}회` : '';
      return {
        title: '수강권 만료 임박 (D-7)',
        body: `${academy} ${ticketName}이(가) 7일 후 만료됩니다.${remainStr} 연장 신청을 해주세요.`,
        type: 'ticket_expiring',
        path: '/my/tickets',
      };
    },
  },
  {
    id: 'ticket_expiry_3d',
    icon: Ticket,
    label: '수강권 만료 D-3',
    category: '수강권',
    color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400',
    description: '수강권 만료 3일 전 알림',
    requiredData: ['user', 'ticket'],
    generateMessage: (ctx) => {
      const academy = ctx.ticket?.academy_name || '학원';
      const ticketName = ctx.ticket?.ticket_name || '수강권';
      const remaining = ctx.ticket?.remaining_count;
      const remainStr = remaining != null ? ` 남은 횟수: ${remaining}회` : '';
      return {
        title: '수강권 만료 임박 (D-3)',
        body: `${academy} ${ticketName}이(가) 3일 후 만료됩니다.${remainStr} 서둘러 사용하세요!`,
        type: 'ticket_expiring',
        path: '/my/tickets',
      };
    },
  },
  {
    id: 'ticket_expiry_1d',
    icon: Ticket,
    label: '수강권 만료 D-1',
    category: '수강권',
    color: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
    description: '수강권 만료 1일 전 긴급 알림',
    requiredData: ['user', 'ticket'],
    generateMessage: (ctx) => {
      const academy = ctx.ticket?.academy_name || '학원';
      const ticketName = ctx.ticket?.ticket_name || '수강권';
      const remaining = ctx.ticket?.remaining_count;
      const remainStr = remaining != null ? ` 남은 횟수: ${remaining}회.` : '';
      return {
        title: '수강권 내일 만료!',
        body: `${academy} ${ticketName}이(가) 내일 만료됩니다!${remainStr} 지금 연장 신청하세요.`,
        type: 'ticket_expiring',
        path: '/my/tickets',
      };
    },
  },
  {
    id: 'ticket_purchased',
    icon: Ticket,
    label: '수강권 구매 완료',
    category: '수강권',
    color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400',
    description: '수강권 구매 완료 시 발송되는 알림',
    requiredData: ['user', 'ticket'],
    generateMessage: (ctx) => {
      const academy = ctx.ticket?.academy_name || '학원';
      const ticketName = ctx.ticket?.ticket_name || '수강권';
      const remaining = ctx.ticket?.remaining_count;
      const remainStr = remaining != null ? ` 잔여 횟수: ${remaining}회` : '';
      return {
        title: '수강권 구매 완료',
        body: `${academy} ${ticketName}을(를) 구매하셨습니다.${remainStr}`,
        type: 'ticket_purchased',
        path: '/my/tickets',
      };
    },
  },
  {
    id: 'extension_approved',
    icon: CheckCircle,
    label: '연장 승인',
    category: '수강권',
    color: 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400',
    description: '수강권 연장 요청 승인 시 발송되는 알림',
    requiredData: ['user', 'ticket'],
    generateMessage: (ctx) => {
      const academy = ctx.ticket?.academy_name || '학원';
      const ticketName = ctx.ticket?.ticket_name || '수강권';
      return {
        title: `${academy} 수강권 연장 승인`,
        body: `${ticketName} 연장 요청이 승인되었습니다.`,
        type: 'extension_approved',
        path: '/my/tickets',
      };
    },
  },
  {
    id: 'extension_rejected',
    icon: XCircle,
    label: '연장 거절',
    category: '수강권',
    color: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
    description: '수강권 연장 요청 거절 시 발송되는 알림',
    requiredData: ['user', 'ticket'],
    generateMessage: (ctx) => {
      const academy = ctx.ticket?.academy_name || '학원';
      const ticketName = ctx.ticket?.ticket_name || '수강권';
      return {
        title: `${academy} 수강권 연장 거절`,
        body: `${ticketName} 연장 요청이 거절되었습니다. 사유: 운영 정책 변경`,
        type: 'extension_rejected',
        path: '/my/tickets',
      };
    },
  },
  {
    id: 'video_uploaded',
    icon: Video,
    label: '수업 영상 등록',
    category: '콘텐츠',
    color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400',
    description: '수업 영상이 업로드되었을 때 발송되는 알림',
    requiredData: ['user', 'class'],
    generateMessage: (ctx) => {
      const academy = ctx.classItem?.academy_name || '학원';
      const cls = ctx.classItem?.title || '수업';
      const today = new Date();
      const dateStr = `${today.getMonth() + 1}/${today.getDate()}`;
      return {
        title: '수업 영상이 등록되었습니다',
        body: `${dateStr} ${academy} ${cls} 수업 영상이 업로드되었습니다. 지금 확인해보세요!`,
        type: 'video_uploaded',
        path: '/my/bookings',
      };
    },
  },
  {
    id: 'consultation_reply',
    icon: MessageSquare,
    label: '상담 답변',
    category: '상담',
    color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-400',
    description: '상담 답변 등록 시 발송되는 알림',
    requiredData: ['user'],
    generateMessage: (ctx) => {
      return {
        title: '상담 답변이 도착했습니다',
        body: `문의하신 상담에 답변이 등록되었습니다. 확인해주세요.`,
        type: 'consultation_reply',
        path: '/notifications',
      };
    },
  },
  {
    id: 'marketing',
    icon: Megaphone,
    label: '마케팅/이벤트',
    category: '마케팅',
    color: 'text-pink-600 bg-pink-50 dark:bg-pink-900/20 dark:text-pink-400',
    description: '이벤트/프로모션 알림',
    requiredData: ['user'],
    generateMessage: (ctx) => {
      return {
        title: '이벤트 안내',
        body: `지금 가입하면 첫 달 수강료 30% 할인! 놓치지 마세요!`,
        type: 'marketing',
        path: '/',
      };
    },
  },
];

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

/* ───── Component ───── */
interface PushScenarioTestProps {
  usersWithTokens: any[];
  onSent: () => void;
}

export function PushScenarioTest({ usersWithTokens, onSent }: PushScenarioTestProps) {
  const [expanded, setExpanded] = useState(true);
  
  // 시나리오 데이터
  const [scenarioData, setScenarioData] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(false);
  
  // 선택 상태
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
  
  // 유저 검색
  const [userSearch, setUserSearch] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  
  // 생성된 메시지 (수동 편집 가능)
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatedBody, setGeneratedBody] = useState('');
  const [generatedPath, setGeneratedPath] = useState('');
  
  // 발송 상태
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // 초기 데이터 로드
  useEffect(() => {
    fetchScenarioData();
  }, []);

  // 유저 선택 시 해당 유저의 예약/수강권 데이터 추가 로드
  useEffect(() => {
    if (selectedUserId) {
      fetchScenarioData(selectedUserId);
    }
  }, [selectedUserId]);

  const fetchScenarioData = async (userId?: string) => {
    try {
      setLoadingData(true);
      const url = userId 
        ? `/api/admin/push/scenario-data?user_id=${userId}`
        : '/api/admin/push/scenario-data';
      const res = await authFetch(url);
      if (res.ok) {
        const data = await res.json();
        setScenarioData((prev: any) => ({
          ...(prev || {}),
          ...data,
        }));
      }
    } catch (err) {
      console.error('Failed to fetch scenario data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  // 현재 선택된 시나리오
  const scenario = useMemo(
    () => SCENARIOS.find(s => s.id === selectedScenario),
    [selectedScenario]
  );

  // 유저 목록 필터링
  const filteredUsers = useMemo(() => {
    const allUsers = scenarioData?.users || [];
    if (!userSearch.trim()) return allUsers.slice(0, 50);
    const q = userSearch.toLowerCase();
    return allUsers.filter((u: any) =>
      (u.display_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }, [scenarioData?.users, userSearch]);

  // 선택된 유저 객체
  const selectedUser = useMemo(
    () => scenarioData?.users?.find((u: any) => u.id === selectedUserId),
    [scenarioData?.users, selectedUserId]
  );

  // 선택된 엔티티들
  const selectedBooking = useMemo(
    () => scenarioData?.user_bookings?.find((b: any) => b.id === selectedBookingId),
    [scenarioData?.user_bookings, selectedBookingId]
  );

  const selectedTicket = useMemo(
    () => scenarioData?.user_tickets?.find((t: any) => t.id === selectedTicketId),
    [scenarioData?.user_tickets, selectedTicketId]
  );

  const selectedClass = useMemo(
    () => scenarioData?.classes?.find((c: any) => c.id === selectedClassId),
    [scenarioData?.classes, selectedClassId]
  );

  const selectedSchedule = useMemo(
    () => scenarioData?.schedules?.find((s: any) => s.id === selectedScheduleId),
    [scenarioData?.schedules, selectedScheduleId]
  );

  // 메시지 생성
  const generateMessage = useCallback(() => {
    if (!scenario) return;
    
    const ctx: ScenarioContext = {
      user: selectedUser,
      booking: selectedBooking,
      ticket: selectedTicket,
      classItem: selectedClass,
      schedule: selectedSchedule,
    };

    const msg = scenario.generateMessage(ctx);
    setGeneratedTitle(msg.title);
    setGeneratedBody(msg.body);
    setGeneratedPath(msg.path);
    setResult(null);
  }, [scenario, selectedUser, selectedBooking, selectedTicket, selectedClass, selectedSchedule]);

  // 시나리오나 데이터 선택이 바뀔 때 자동 생성
  useEffect(() => {
    if (scenario && selectedUserId) {
      generateMessage();
    }
  }, [selectedScenario, selectedUserId, selectedBookingId, selectedTicketId, selectedClassId, selectedScheduleId]);

  // 발송
  const handleSend = async () => {
    if (!generatedTitle || !generatedBody) {
      setResult({ success: false, message: '메시지를 먼저 생성하세요.' });
      return;
    }
    if (!selectedUserId) {
      setResult({ success: false, message: '대상 유저를 선택하세요.' });
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const data: Record<string, string> = {
        display_style: 'big_text',
      };
      if (generatedPath) {
        data.path = generatedPath;
      }

      const res = await authFetch('/api/admin/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: generatedTitle,
          message: generatedBody,
          target: 'specific',
          user_ids: [selectedUserId],
          data,
          trigger_worker: true,
        }),
      });

      const resData = await res.json();
      if (res.ok) {
        setResult({
          success: true,
          message: `${selectedUser?.display_name || '유저'}에게 "${scenario?.label || ''}" 시나리오 알림 발송 완료!`,
        });
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

  // 시나리오에 필요한 데이터 필드 체크
  const needsClass = scenario?.requiredData.includes('class');
  const needsSchedule = scenario?.requiredData.includes('schedule');
  const needsTicket = scenario?.requiredData.includes('ticket');
  const needsBooking = scenario?.requiredData.includes('booking');

  // 카테고리별 그룹화
  const scenariosByCategory = useMemo(() => {
    const cats: Record<string, Scenario[]> = {};
    SCENARIOS.forEach(s => {
      if (!cats[s.category]) cats[s.category] = [];
      cats[s.category].push(s);
    });
    return cats;
  }, []);

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
      {/* 헤더 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FlaskConical size={18} className="text-purple-600 dark:text-purple-400" />
          <div className="text-left">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
              시나리오 테스트
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              실제 유저/수업/수강권 데이터로 각 알림 시나리오를 테스트합니다
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div className="p-6 space-y-6">
          {/* Step 1: 시나리오 선택 */}
          <div className="space-y-3">
            <StepLabel step={1} label="시나리오 선택" />
            <div className="space-y-3">
              {Object.entries(scenariosByCategory).map(([category, scenarios]) => (
                <div key={category}>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">{category}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                    {scenarios.map(s => {
                      const Icon = s.icon;
                      const isActive = selectedScenario === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSelectedScenario(s.id);
                            setResult(null);
                          }}
                          className={`text-left p-2.5 rounded-lg border transition-all ${
                            isActive
                              ? 'border-purple-500 dark:border-purple-400 bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-500 dark:ring-purple-400'
                              : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-400'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <div className={`w-5 h-5 rounded flex items-center justify-center ${s.color}`}>
                              <Icon size={11} />
                            </div>
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
          </div>

          {/* Step 2: 대상 유저 선택 */}
          {selectedScenario && (
            <div className="space-y-3">
              <StepLabel step={2} label="대상 유저 선택" />
              <div className="relative">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-neutral-400" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      setShowUserDropdown(true);
                    }}
                    onFocus={() => setShowUserDropdown(true)}
                    placeholder="이름, 이메일, 전화번호로 검색..."
                    className="flex-1 px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                
                {selectedUser && (
                  <div className="mt-2 flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <User size={14} className="text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                      {selectedUser.display_name || selectedUser.email}
                    </span>
                    <span className="text-xs text-purple-500">{selectedUser.email}</span>
                    {selectedUser.has_token && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full ml-auto">
                        토큰 있음
                      </span>
                    )}
                    {!selectedUser.has_token && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full ml-auto">
                        토큰 없음
                      </span>
                    )}
                  </div>
                )}

                {showUserDropdown && (
                  <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg">
                    {loadingData && !scenarioData?.users ? (
                      <div className="p-4 text-center text-sm text-neutral-500">
                        <Loader2 size={16} className="animate-spin inline mr-2" />로딩 중...
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="p-4 text-center text-sm text-neutral-500">검색 결과 없음</div>
                    ) : (
                      filteredUsers.map((u: any) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setSelectedUserId(u.id);
                            setUserSearch(u.display_name || u.email);
                            setShowUserDropdown(false);
                            // 데이터 초기화
                            setSelectedBookingId('');
                            setSelectedTicketId('');
                          }}
                          className={`w-full text-left px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-700 border-b border-neutral-100 dark:border-neutral-700 last:border-0 ${
                            selectedUserId === u.id ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-neutral-900 dark:text-white">
                                {u.display_name || '이름 없음'}
                              </p>
                              <p className="text-xs text-neutral-500">{u.email}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {u.has_token && (
                                <span className="w-2 h-2 bg-green-500 rounded-full" title="푸시 토큰 있음" />
                              )}
                              <span className="text-[10px] text-neutral-400">{u.role}</span>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: 관련 데이터 선택 */}
          {selectedScenario && selectedUserId && (
            <div className="space-y-3">
              <StepLabel step={3} label="관련 데이터 선택" />
              
              {/* 수업 선택 */}
              {(needsClass || needsSchedule) && (
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                    <BookOpen size={12} /> 수업 선택
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => {
                      setSelectedClassId(e.target.value);
                      setSelectedScheduleId('');
                    }}
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none"
                  >
                    <option value="">수업을 선택하세요</option>
                    {(scenarioData?.classes || []).map((c: any) => (
                      <option key={c.id} value={c.id}>
                        [{c.academy_name}] {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 스케줄 선택 */}
              {needsSchedule && selectedClassId && (
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                    <Calendar size={12} /> 시간대 선택
                  </label>
                  <select
                    value={selectedScheduleId}
                    onChange={(e) => setSelectedScheduleId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none"
                  >
                    <option value="">시간대를 선택하세요 (선택)</option>
                    {(scenarioData?.schedules || [])
                      .filter((s: any) => s.class_id === selectedClassId)
                      .map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {formatTime(s.start_time)} ~ {s.end_time ? formatTime(s.end_time) : ''}
                        </option>
                      ))
                    }
                  </select>
                </div>
              )}

              {/* 해당 유저의 예약 선택 */}
              {needsBooking && (
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                    <Calendar size={12} /> 예약 선택 (유저의 기존 예약)
                  </label>
                  {(scenarioData?.user_bookings || []).length === 0 ? (
                    <p className="text-xs text-neutral-400 p-2 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                      해당 유저의 활성 예약이 없습니다
                    </p>
                  ) : (
                    <select
                      value={selectedBookingId}
                      onChange={(e) => setSelectedBookingId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none"
                    >
                      <option value="">예약을 선택하세요</option>
                      {(scenarioData?.user_bookings || []).map((b: any) => (
                        <option key={b.id} value={b.id}>
                          [{b.academy_name}] {b.class_title}
                          {b.start_time ? ` - ${formatTime(b.start_time)}` : ''} ({b.status})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* 수강권 선택 */}
              {needsTicket && (
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                    <Ticket size={12} /> 수강권 선택 (유저의 보유 수강권)
                  </label>
                  {(scenarioData?.user_tickets || []).length === 0 ? (
                    <p className="text-xs text-neutral-400 p-2 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                      해당 유저의 활성 수강권이 없습니다
                    </p>
                  ) : (
                    <select
                      value={selectedTicketId}
                      onChange={(e) => setSelectedTicketId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none"
                    >
                      <option value="">수강권을 선택하세요</option>
                      {(scenarioData?.user_tickets || []).map((t: any) => (
                        <option key={t.id} value={t.id}>
                          [{t.academy_name}] {t.ticket_name}
                          {t.remaining_count != null ? ` (${t.remaining_count}회 남음)` : ''}
                          {t.expiry_date ? ` ~${t.expiry_date}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 4: 생성된 메시지 미리보기 & 수정 */}
          {generatedTitle && (
            <div className="space-y-3">
              <StepLabel step={4} label="메시지 미리보기 (수정 가능)" />
              
              {/* 알림 프리뷰 */}
              <div className="bg-neutral-100 dark:bg-neutral-800 rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-medium text-neutral-400 uppercase">푸시 알림 미리보기</p>
                <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm overflow-hidden max-w-sm">
                  <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                    <div className="w-4 h-4 rounded bg-primary dark:bg-[#CCFF00]" />
                    <span className="text-[10px] text-neutral-500 font-medium">MOVE.IT</span>
                    <span className="text-[10px] text-neutral-400 ml-auto">지금</span>
                  </div>
                  <div className="px-3 pb-3">
                    <p className="text-sm font-semibold text-neutral-900 dark:text-white">{generatedTitle}</p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5 whitespace-pre-wrap">{generatedBody}</p>
                  </div>
                </div>
              </div>

              {/* 수정 가능한 폼 */}
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">제목</label>
                  <input
                    type="text"
                    value={generatedTitle}
                    onChange={(e) => setGeneratedTitle(e.target.value)}
                    className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">내용</label>
                  <textarea
                    value={generatedBody}
                    onChange={(e) => setGeneratedBody(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">클릭 시 이동 경로</label>
                  <input
                    type="text"
                    value={generatedPath}
                    onChange={(e) => setGeneratedPath(e.target.value)}
                    placeholder="/my/bookings"
                    className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 결과 메시지 */}
          {result && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
              result.success
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
            }`}>
              {result.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
              {result.message}
            </div>
          )}

          {/* 발송 버튼 */}
          <div className="flex gap-3">
            <button
              onClick={generateMessage}
              disabled={!selectedScenario || !selectedUserId}
              className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors text-sm"
            >
              <FlaskConical size={16} /> 메시지 재생성
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !generatedTitle || !generatedBody || !selectedUserId}
              className="flex-1 py-3 bg-purple-600 dark:bg-purple-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors text-sm"
            >
              {sending ? (
                <><Loader2 size={16} className="animate-spin" /> 발송 중...</>
              ) : (
                <><Send size={16} /> 시나리오 테스트 발송</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───── StepLabel ───── */
function StepLabel({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 rounded-full bg-purple-600 dark:bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center">
        {step}
      </div>
      <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{label}</span>
    </div>
  );
}
