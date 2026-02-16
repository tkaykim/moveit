"use client";

import { useState } from 'react';
import {
  Send, Loader2, CheckCircle, XCircle, ChevronDown, ChevronUp,
  Users, UserCheck, Building2, Image as ImageIcon, Link, Smartphone,
  Eye, Type, AlignLeft, FileText, Zap, Calendar, UserCheck2, Ticket,
  Video, Bell, Megaphone, MessageSquare, Clock,
} from 'lucide-react';
import { authFetch } from '@/lib/supabase/auth-fetch';

/* ───── types ───── */
export type TargetType = 'all' | 'all_with_token' | 'specific' | 'role' | 'academy';
export type DisplayStyle = 'default' | 'big_text' | 'big_picture';
export type ClickAction = 'none' | 'path' | 'url';

interface PushSendFormProps {
  usersWithTokens: any[];
  totalTokens: number;
  allUsers?: any[];
  onSent: () => void;
}

/* ───── 역할 목록 ───── */
const ROLES = [
  { value: 'USER', label: '일반 유저' },
  { value: 'SUPER_ADMIN', label: '최고관리자' },
  { value: 'ACADEMY_OWNER', label: '학원 대표' },
  { value: 'ACADEMY_MANAGER', label: '학원 매니저' },
  { value: 'INSTRUCTOR', label: '강사' },
];

/* ───── 앱 내 경로 프리셋 ───── */
const PATH_PRESETS = [
  { value: '/', label: '홈' },
  { value: '/book', label: '예약 (수업 탐색)' },
  { value: '/notifications', label: '알림함' },
  { value: '/my', label: '마이페이지' },
  { value: '/my/tickets', label: '내 수강권' },
  { value: '/my/bookings', label: '내 예약' },
];

/* ───── 알림 유형별 테스트 프리셋 ───── */
interface NotificationPreset {
  id: string;
  icon: any;
  label: string;
  category: string;
  color: string;
  title: string;
  message: string;
  clickAction: ClickAction;
  clickPath: string;
  displayStyle: DisplayStyle;
}

const NOTIFICATION_PRESETS: NotificationPreset[] = [
  {
    id: 'class_reminder',
    icon: Calendar,
    label: '수업 당일 알림',
    category: '수업',
    color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400',
    title: '오늘 수업이 있어요!',
    message: '오후 3:00 GB 댄스 아카데미 - K-POP 기초반 수업이 오늘 예정되어 있습니다. 준비물을 확인해주세요!',
    clickAction: 'path',
    clickPath: '/my/bookings',
    displayStyle: 'big_text',
  },
  {
    id: 'attendance_checked',
    icon: UserCheck2,
    label: '출석 확인',
    category: '출석',
    color: 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400',
    title: '출석이 확인되었습니다',
    message: 'GB 댄스 아카데미 K-POP 기초반 수업에 정상 출석 처리되었습니다. 남은 수강권: 7회',
    clickAction: 'path',
    clickPath: '/my/tickets',
    displayStyle: 'default',
  },
  {
    id: 'attendance_absent',
    icon: UserCheck2,
    label: '결석 알림 (학부모)',
    category: '출석',
    color: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
    title: '자녀 결석 알림',
    message: '자녀(홍길동)가 오늘 GB 댄스 아카데미 K-POP 기초반 수업에 결석하였습니다. 확인해주세요.',
    clickAction: 'path',
    clickPath: '/my/bookings',
    displayStyle: 'big_text',
  },
  {
    id: 'ticket_expiry_7d',
    icon: Ticket,
    label: '수강권 만료 D-7',
    category: '수강권',
    color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400',
    title: '수강권 만료 임박 (D-7)',
    message: 'GB 댄스 아카데미 K-POP 기초반 수강권이 7일 후 만료됩니다. 남은 횟수 3회를 사용하시거나, 연장 신청을 해주세요.',
    clickAction: 'path',
    clickPath: '/my/tickets',
    displayStyle: 'big_text',
  },
  {
    id: 'ticket_expiry_1d',
    icon: Ticket,
    label: '수강권 만료 D-1',
    category: '수강권',
    color: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
    title: '수강권 내일 만료!',
    message: 'GB 댄스 아카데미 K-POP 기초반 수강권이 내일 만료됩니다! 남은 횟수: 2회. 지금 연장 신청하세요.',
    clickAction: 'path',
    clickPath: '/my/tickets',
    displayStyle: 'big_text',
  },
  {
    id: 'video_uploaded',
    icon: Video,
    label: '수업 영상 등록',
    category: '콘텐츠',
    color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400',
    title: '수업 영상이 등록되었습니다',
    message: '2/15(토) K-POP 기초반 수업 영상이 업로드되었습니다. 지금 확인해보세요!',
    clickAction: 'path',
    clickPath: '/my/bookings',
    displayStyle: 'default',
  },
  {
    id: 'booking_confirmed',
    icon: Calendar,
    label: '예약 확인',
    category: '예약',
    color: 'text-teal-600 bg-teal-50 dark:bg-teal-900/20 dark:text-teal-400',
    title: '예약이 확인되었습니다',
    message: '2/20(목) 오후 3:00 GB 댄스 아카데미 K-POP 기초반 수업 예약이 확정되었습니다.',
    clickAction: 'path',
    clickPath: '/my/bookings',
    displayStyle: 'default',
  },
  {
    id: 'booking_cancelled',
    icon: Calendar,
    label: '예약 취소',
    category: '예약',
    color: 'text-neutral-600 bg-neutral-100 dark:bg-neutral-800 dark:text-neutral-400',
    title: '예약이 취소되었습니다',
    message: '2/20(목) 오후 3:00 GB 댄스 아카데미 K-POP 기초반 수업 예약이 취소되었습니다.',
    clickAction: 'path',
    clickPath: '/my/bookings',
    displayStyle: 'default',
  },
  {
    id: 'consultation_reply',
    icon: MessageSquare,
    label: '상담 답변',
    category: '상담',
    color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-400',
    title: '상담 답변이 도착했습니다',
    message: 'GB 댄스 아카데미에서 문의하신 "수업 시간 변경 관련" 상담에 답변이 등록되었습니다.',
    clickAction: 'path',
    clickPath: '/notifications',
    displayStyle: 'big_text',
  },
  {
    id: 'marketing',
    icon: Megaphone,
    label: '마케팅/이벤트',
    category: '마케팅',
    color: 'text-pink-600 bg-pink-50 dark:bg-pink-900/20 dark:text-pink-400',
    title: '신규 회원 할인 이벤트!',
    message: '지금 가입하면 첫 달 수강료 30% 할인! 기간: 2/16 ~ 2/28. 놓치지 마세요!',
    clickAction: 'path',
    clickPath: '/',
    displayStyle: 'big_text',
  },
  {
    id: 'system',
    icon: Bell,
    label: '시스템 공지',
    category: '시스템',
    color: 'text-neutral-600 bg-neutral-100 dark:bg-neutral-800 dark:text-neutral-400',
    title: '시스템 점검 안내',
    message: '2/20(목) 오전 2:00 ~ 5:00 서버 점검이 예정되어 있습니다. 이 시간 동안 서비스 이용이 제한될 수 있습니다.',
    clickAction: 'none',
    clickPath: '',
    displayStyle: 'big_text',
  },
];

/* ───── component ───── */
export function PushSendForm({ usersWithTokens, totalTokens, onSent }: PushSendFormProps) {
  // 콘텐츠
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // 표시 방식
  const [displayStyle, setDisplayStyle] = useState<DisplayStyle>('default');

  // 발송 대상
  const [targetType, setTargetType] = useState<TargetType>('all_with_token');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');

  // 클릭 액션
  const [clickAction, setClickAction] = useState<ClickAction>('none');
  const [clickPath, setClickPath] = useState('');
  const [clickUrl, setClickUrl] = useState('');

  // 프리셋
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(true);

  // UI 상태
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  /* ───── 프리셋 적용 ───── */
  const applyPreset = (preset: NotificationPreset) => {
    setTitle(preset.title);
    setMessage(preset.message);
    setDisplayStyle(preset.displayStyle);
    setClickAction(preset.clickAction);
    setClickPath(preset.clickPath);
    setClickUrl('');
    setImageUrl('');
    setActivePreset(preset.id);
    setResult(null);
  };

  /* ───── 발송 ───── */
  const handleSend = async () => {
    if (!title.trim()) return setResult({ success: false, message: '제목을 입력하세요.' });
    if (!message.trim()) return setResult({ success: false, message: '내용을 입력하세요.' });
    if (targetType === 'specific' && selectedUsers.length === 0)
      return setResult({ success: false, message: '발송 대상 유저를 선택하세요.' });
    if (targetType === 'role' && selectedRoles.length === 0)
      return setResult({ success: false, message: '역할을 하나 이상 선택하세요.' });
    if (clickAction === 'path' && !clickPath.trim())
      return setResult({ success: false, message: '앱 내 경로를 입력하세요.' });
    if (clickAction === 'url' && !clickUrl.trim())
      return setResult({ success: false, message: 'URL을 입력하세요.' });

    const data: Record<string, string> = { display_style: displayStyle };
    if (clickAction === 'path') data.path = clickPath.trim().replace(/^\/*/, '/');
    if (clickAction === 'url') data.url = clickUrl.trim();
    if (imageUrl.trim()) data.image_url = imageUrl.trim();

    setSending(true);
    setResult(null);

    try {
      const res = await authFetch('/api/admin/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          image_url: imageUrl.trim() || undefined,
          target: targetType === 'specific' ? 'specific' : targetType === 'role' ? 'role' : 'all',
          user_ids: targetType === 'specific' ? selectedUsers : [],
          roles: targetType === 'role' ? selectedRoles : [],
          data,
          trigger_worker: true,
        }),
      });

      const resData = await res.json();
      if (res.ok) {
        setResult({
          success: true,
          message: `발송 완료! 토큰 ${resData.summary?.total_tokens || 0}개, 유저 ${resData.summary?.logged_in_users || 0}명`,
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

  const toggleUser = (userId: string) =>
    setSelectedUsers(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);

  const toggleRole = (role: string) =>
    setSelectedRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);

  const filteredUsers = usersWithTokens.filter((u: any) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return (u.display_name || '').toLowerCase().includes(q) ||
           (u.email || '').toLowerCase().includes(q);
  });

  const targetLabel = () => {
    switch (targetType) {
      case 'all': return `전체 유저`;
      case 'all_with_token': return `토큰 등록 기기 전체 (${totalTokens}대)`;
      case 'specific': return `선택한 유저 (${selectedUsers.length}명)`;
      case 'role': return `역할별 (${selectedRoles.map(r => ROLES.find(x => x.value === r)?.label).join(', ') || '미선택'})`;
      default: return '';
    }
  };

  /* ───── btn 스타일 ───── */
  const tabCls = (active: boolean) =>
    `px-3 py-2 rounded-lg text-xs sm:text-sm font-medium border transition-all whitespace-nowrap ${
      active
        ? 'bg-primary dark:bg-[#CCFF00] text-black border-primary dark:border-[#CCFF00]'
        : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:border-neutral-400'
    }`;

  /* ───── render ───── */
  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
        <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
          <Send size={18} /> 푸시 알림 발송
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">제목, 내용, 대상, 표시 형식, 클릭 액션을 설정하세요</p>
      </div>

      <div className="p-6 space-y-5">
        {/* ── 0. 알림 유형별 테스트 프리셋 ── */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowPresets(!showPresets)}
            className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            <Zap size={14} /> 빠른 테스트 프리셋
            {showPresets ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {showPresets && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {NOTIFICATION_PRESETS.map(preset => {
                const Icon = preset.icon;
                const isActive = activePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={`text-left p-2.5 rounded-xl border transition-all ${
                      isActive
                        ? 'border-primary dark:border-[#CCFF00] bg-primary/5 dark:bg-[#CCFF00]/10 ring-1 ring-primary dark:ring-[#CCFF00]'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className={`w-5 h-5 rounded flex items-center justify-center ${preset.color}`}>
                        <Icon size={11} />
                      </div>
                      <span className="text-[10px] text-neutral-400 font-medium">{preset.category}</span>
                    </div>
                    <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200 leading-tight">{preset.label}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 1. 콘텐츠 섹션 ── */}
        <div className="space-y-3">
          <SectionLabel icon={<Type size={14} />} label="콘텐츠" />

          {/* 제목 */}
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">제목 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="알림 제목 (필수)"
              maxLength={100}
              className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00] outline-none"
            />
            <span className="text-xs text-neutral-400 float-right mt-0.5">{title.length}/100</span>
          </div>

          {/* 내용 */}
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">내용 *</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="알림 내용을 입력하세요 (필수)"
              rows={4}
              maxLength={500}
              className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00] outline-none resize-none"
            />
            <span className="text-xs text-neutral-400 float-right mt-0.5">{message.length}/500</span>
          </div>

          {/* 이미지 URL */}
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
              이미지 URL <span className="text-neutral-400">(선택)</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <ImageIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full pl-9 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
            </div>
            {imageUrl && (
              <div className="mt-2 relative w-full max-w-xs h-24 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                <img src={imageUrl} alt="미리보기" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
              </div>
            )}
          </div>
        </div>

        {/* ── 2. 표시 방식 ── */}
        <div className="space-y-2">
          <SectionLabel icon={<AlignLeft size={14} />} label="표시 방식" />
          <div className="flex flex-wrap gap-2">
            {([
              { value: 'default' as const, label: '기본', desc: '한 줄 요약' },
              { value: 'big_text' as const, label: '긴 글', desc: '펼치면 전체 표시' },
              { value: 'big_picture' as const, label: '이미지', desc: '큰 이미지 포함' },
            ] as const).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setDisplayStyle(opt.value);
                  if (opt.value === 'big_picture' && !imageUrl) {
                    // 이미지 스타일 선택 시 이미지 URL 필요 안내
                  }
                }}
                className={tabCls(displayStyle === opt.value)}
              >
                {opt.label} <span className="hidden sm:inline text-[10px] opacity-60">({opt.desc})</span>
              </button>
            ))}
          </div>
          {displayStyle === 'big_picture' && !imageUrl && (
            <p className="text-xs text-amber-600 dark:text-amber-400">이미지 스타일을 사용하려면 위에 이미지 URL을 입력하세요.</p>
          )}
        </div>

        {/* ── 3. 발송 대상 ── */}
        <div className="space-y-2">
          <SectionLabel icon={<Users size={14} />} label="발송 대상" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setTargetType('all_with_token')} className={tabCls(targetType === 'all_with_token')}>
              <Smartphone size={14} className="inline mr-1" /> 토큰 전체 ({totalTokens})
            </button>
            <button type="button" onClick={() => setTargetType('specific')} className={tabCls(targetType === 'specific')}>
              <UserCheck size={14} className="inline mr-1" /> 특정 유저
            </button>
            <button type="button" onClick={() => setTargetType('role')} className={tabCls(targetType === 'role')}>
              <Building2 size={14} className="inline mr-1" /> 역할별
            </button>
          </div>

          {/* 역할 선택 */}
          {targetType === 'role' && (
            <div className="flex flex-wrap gap-2 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
              {ROLES.map(role => (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => toggleRole(role.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    selectedRoles.includes(role.value)
                      ? 'bg-primary dark:bg-[#CCFF00] text-black border-transparent'
                      : 'bg-white dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-600'
                  }`}
                >
                  {role.label}
                </button>
              ))}
            </div>
          )}

          {/* 유저 선택 */}
          {targetType === 'specific' && (
            <div className="space-y-2">
              <input
                type="text"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="이름 또는 이메일로 검색..."
                className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none"
              />
              <div className="max-h-48 overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
                {filteredUsers.length === 0 ? (
                  <div className="p-4 text-sm text-neutral-500 text-center">토큰이 등록된 유저가 없습니다</div>
                ) : (
                  filteredUsers.map((user: any) => (
                    <label
                      key={user.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer border-b border-neutral-100 dark:border-neutral-800 last:border-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => toggleUser(user.id)}
                        className="w-4 h-4 rounded border-neutral-300 text-primary focus:ring-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                          {user.display_name || user.email || user.id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-neutral-500 truncate">{user.email}</p>
                      </div>
                      <span className="text-xs text-neutral-400">{user.tokens?.length || 0}대</span>
                    </label>
                  ))
                )}
              </div>
              {selectedUsers.length > 0 && (
                <p className="text-xs text-primary dark:text-[#CCFF00]">{selectedUsers.length}명 선택됨</p>
              )}
            </div>
          )}
        </div>

        {/* ── 4. 클릭 시 이동 ── */}
        <div className="space-y-2">
          <SectionLabel icon={<Link size={14} />} label="클릭 시 이동" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setClickAction('none')} className={tabCls(clickAction === 'none')}>
              이동 없음
            </button>
            <button type="button" onClick={() => setClickAction('path')} className={tabCls(clickAction === 'path')}>
              앱 내 경로
            </button>
            <button type="button" onClick={() => setClickAction('url')} className={tabCls(clickAction === 'url')}>
              외부 URL
            </button>
          </div>

          {clickAction === 'path' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {PATH_PRESETS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setClickPath(p.value)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
                      clickPath === p.value
                        ? 'bg-neutral-900 dark:bg-white text-white dark:text-black border-transparent'
                        : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-600'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={clickPath}
                onChange={e => setClickPath(e.target.value)}
                placeholder="/book, /notifications 등"
                className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none"
              />
            </div>
          )}
          {clickAction === 'url' && (
            <input
              type="url"
              value={clickUrl}
              onChange={e => setClickUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none"
            />
          )}
        </div>

        {/* ── 미리보기 토글 ── */}
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
        >
          <Eye size={14} />
          미리보기
          {showPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showPreview && (
          <NotificationPreview
            title={title || '알림 제목'}
            body={message || '알림 내용이 여기에 표시됩니다.'}
            imageUrl={displayStyle === 'big_picture' ? imageUrl : ''}
            displayStyle={displayStyle}
          />
        )}

        {/* ── 요약 + 발송 버튼 ── */}
        <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4 space-y-2">
          <p className="text-xs text-neutral-500">발송 요약</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-neutral-400">대상:</span> <span className="text-neutral-900 dark:text-white font-medium">{targetLabel()}</span></div>
            <div><span className="text-neutral-400">표시:</span> <span className="text-neutral-900 dark:text-white font-medium">
              {displayStyle === 'default' ? '기본' : displayStyle === 'big_text' ? '긴 글 확장' : '이미지 포함'}
            </span></div>
            <div><span className="text-neutral-400">클릭:</span> <span className="text-neutral-900 dark:text-white font-medium">
              {clickAction === 'none' ? '이동 없음' : clickAction === 'path' ? clickPath || '미입력' : clickUrl || '미입력'}
            </span></div>
            {imageUrl && <div><span className="text-neutral-400">이미지:</span> <span className="text-neutral-900 dark:text-white font-medium">첨부됨</span></div>}
          </div>
        </div>

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
        <button
          onClick={handleSend}
          disabled={sending || !title.trim() || !message.trim()}
          className="w-full py-3.5 bg-primary dark:bg-[#CCFF00] text-black font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity text-sm"
        >
          {sending ? (
            <><Loader2 size={18} className="animate-spin" /> 발송 중...</>
          ) : (
            <><Send size={18} /> 푸시 알림 발송</>
          )}
        </button>
      </div>
    </div>
  );
}

/* ───── 섹션 라벨 ───── */
function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
      {icon} {label}
    </div>
  );
}

/* ───── 미리보기 ───── */
function NotificationPreview({
  title, body, imageUrl, displayStyle,
}: { title: string; body: string; imageUrl: string; displayStyle: DisplayStyle }) {
  return (
    <div className="bg-neutral-100 dark:bg-neutral-800 rounded-xl p-4 space-y-3">
      <p className="text-[10px] font-medium text-neutral-400 uppercase">Android 알림 미리보기</p>
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm overflow-hidden max-w-sm">
        {/* 상단 앱 이름 */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-1">
          <div className="w-4 h-4 rounded bg-primary dark:bg-[#CCFF00]" />
          <span className="text-[10px] text-neutral-500 font-medium">MOVE.IT</span>
          <span className="text-[10px] text-neutral-400 ml-auto">지금</span>
        </div>

        {/* 제목 + 내용 */}
        <div className="px-3 pb-2">
          <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{title}</p>
          <p className={`text-xs text-neutral-600 dark:text-neutral-400 mt-0.5 ${
            displayStyle === 'big_text' ? 'whitespace-pre-wrap' : 'truncate'
          }`}>
            {body}
          </p>
        </div>

        {/* 이미지 */}
        {displayStyle === 'big_picture' && imageUrl && (
          <div className="px-3 pb-3">
            <div className="w-full h-36 bg-neutral-200 dark:bg-neutral-700 rounded-lg overflow-hidden">
              <img
                src={imageUrl}
                alt="알림 이미지"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.parentElement!.innerHTML = '<div class="flex items-center justify-center h-full text-xs text-neutral-400">이미지 로드 실패</div>';
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
