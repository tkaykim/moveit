"use client";

import { useState, useEffect } from 'react';
import {
  ChevronLeft, Bell, Calendar, Ticket, Megaphone, Clock,
  Smartphone, AlertTriangle, UserCheck, Video, MessageSquare,
  ShieldCheck, ChevronDown,
} from 'lucide-react';
import { usePushNotification } from '@/contexts/PushNotificationContext';
import { authFetch } from '@/lib/supabase/auth-fetch';
import type { NotificationPreferences } from '@/types/notifications';

interface NotificationSettingsProps {
  onBack: () => void;
}

function ToggleSwitch({ checked, onChange, disabled }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
        checked
          ? 'bg-primary dark:bg-[#CCFF00]'
          : 'bg-neutral-300 dark:bg-neutral-600'
      } ${disabled ? 'opacity-40' : ''}`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

interface SettingCategory {
  id: string;
  icon: any;
  iconColor: string;
  label: string;
  description: string;
  field: keyof NotificationPreferences;
  subItems?: {
    label: string;
    description: string;
  }[];
}

const SETTING_CATEGORIES: SettingCategory[] = [
  {
    id: 'class',
    icon: Calendar,
    iconColor: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30',
    label: '수업 알림',
    description: '수업 당일 미리 알림, 수업 취소 알림',
    field: 'class_reminder',
    subItems: [
      { label: '수업 당일 알림', description: '수업 시작 전 미리 알려드려요' },
      { label: '수업 취소/변경', description: '수업이 취소되거나 변경될 때' },
    ],
  },
  {
    id: 'booking',
    icon: Calendar,
    iconColor: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30',
    label: '예약 알림',
    description: '예약 확인, 예약 취소 알림',
    field: 'booking_updates',
    subItems: [
      { label: '예약 확인', description: '예약이 완료되었을 때' },
      { label: '예약 취소', description: '예약이 취소되었을 때' },
    ],
  },
  {
    id: 'attendance',
    icon: UserCheck,
    iconColor: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30',
    label: '출석 알림',
    description: '출석 확인, 결석 알림 (본인/학부모)',
    field: 'attendance_updates',
    subItems: [
      { label: '출석 확인', description: '수업 출석이 처리되었을 때' },
      { label: '결석 알림', description: '결석 시 본인 또는 학부모에게 알림' },
    ],
  },
  {
    id: 'ticket',
    icon: Ticket,
    iconColor: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30',
    label: '수강권 알림',
    description: '수강권 만료 임박, 구매 완료, 연장 승인/거절',
    field: 'ticket_updates',
    subItems: [
      { label: '만료 임박 알림', description: '수강권 만료 D-7, D-3, D-1 알림' },
      { label: '구매/연장 알림', description: '수강권 구매 완료, 연장 승인/거절' },
    ],
  },
  {
    id: 'content',
    icon: Video,
    iconColor: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30',
    label: '콘텐츠 알림',
    description: '수업 영상 등록 알림',
    field: 'content_updates',
    subItems: [
      { label: '수업 영상 업로드', description: '신청한 수업의 영상이 등록되었을 때' },
    ],
  },
  {
    id: 'consultation',
    icon: MessageSquare,
    iconColor: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30',
    label: '상담 알림',
    description: '상담 답변 도착 알림',
    field: 'consultation_updates',
    subItems: [
      { label: '상담 답변', description: '문의에 대한 답변이 등록되었을 때' },
    ],
  },
  {
    id: 'marketing',
    icon: Megaphone,
    iconColor: 'text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/30',
    label: '마케팅/이벤트',
    description: '프로모션, 이벤트, 할인 알림',
    field: 'marketing',
    subItems: [
      { label: '프로모션', description: '특별 할인 및 이벤트 안내' },
      { label: '새 소식', description: '서비스 업데이트 및 소식' },
    ],
  },
];

const REMINDER_OPTIONS = [
  { label: '30분 전', value: 30 },
  { label: '1시간 전', value: 60 },
  { label: '2시간 전', value: 120 },
  { label: '하루 전', value: 1440 },
];

export function NotificationSettings({ onBack }: NotificationSettingsProps) {
  const {
    isSupported,
    permissionGranted,
    deviceToken,
    requestPermission,
  } = usePushNotification();

  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const res = await authFetch('/api/notifications/preferences');
      if (res.ok) {
        const data = await res.json();
        setPrefs(data);
      }
    } catch (error) {
      console.error('알림 설정 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (field: string, value: boolean | number) => {
    if (!prefs) return;
    const newPrefs = { ...prefs, [field]: value };
    setPrefs(newPrefs);
    setSaving(true);
    try {
      await authFetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
    } catch (error) {
      console.error('설정 업데이트 실패:', error);
      setPrefs(prefs);
    } finally {
      setSaving(false);
    }
  };

  const handlePushToggle = async (enabled: boolean) => {
    if (enabled) {
      setRequestingPermission(true);
      try {
        const granted = await requestPermission();
        if (granted) {
          updatePreference('push_enabled', true);
        } else {
          alert('알림 권한이 거부되었습니다.\n기기 설정 > 앱 > MOVE.IT > 알림에서 허용해주세요.');
        }
      } finally {
        setRequestingPermission(false);
      }
    } else {
      updatePreference('push_enabled', false);
    }
  };

  const pushActive = prefs?.push_enabled && permissionGranted;

  const enabledCount = prefs
    ? SETTING_CATEGORIES.filter(c => prefs[c.field]).length
    : 0;

  if (loading) {
    return (
      <div className="bg-white dark:bg-neutral-950 min-h-screen pt-12 px-5">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="p-2 -ml-2 text-black dark:text-white">
            <ChevronLeft />
          </button>
          <h2 className="text-xl font-bold text-black dark:text-white">알림 설정</h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-neutral-100 dark:bg-neutral-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!prefs) return null;

  return (
    <div className="bg-white dark:bg-neutral-950 min-h-screen pt-12 px-5 pb-32 animate-in slide-in-from-right duration-300">
      {/* 헤더 */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 -ml-2 text-black dark:text-white">
          <ChevronLeft />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-black dark:text-white">알림 설정</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {enabledCount}/{SETTING_CATEGORIES.length}개 카테고리 활성
            {saving && <span className="ml-2 text-primary dark:text-[#CCFF00]">저장 중...</span>}
          </p>
        </div>
      </div>

      {/* 디바이스 상태 배너 */}
      <div className={`mb-5 p-3.5 rounded-2xl flex items-start gap-3 ${
        deviceToken
          ? 'bg-green-50 dark:bg-green-950/30'
          : 'bg-amber-50 dark:bg-amber-950/30'
      }`}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          deviceToken
            ? 'bg-green-100 dark:bg-green-900/50'
            : 'bg-amber-100 dark:bg-amber-900/50'
        }`}>
          {deviceToken ? (
            <ShieldCheck size={18} className="text-green-600 dark:text-green-400" />
          ) : (
            <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />
          )}
        </div>
        <div>
          <p className={`text-sm font-semibold ${
            deviceToken
              ? 'text-green-700 dark:text-green-400'
              : 'text-amber-700 dark:text-amber-400'
          }`}>
            {deviceToken ? '푸시 알림 활성화됨' : '푸시 알림 비활성화'}
          </p>
          <p className={`text-xs mt-0.5 ${
            deviceToken
              ? 'text-green-600/70 dark:text-green-400/70'
              : 'text-amber-600/70 dark:text-amber-400/70'
          }`}>
            {deviceToken
              ? '이 기기에서 알림을 받을 수 있습니다'
              : isSupported
                ? '아래에서 푸시 알림을 켜주세요'
                : '이 환경에서는 푸시를 지원하지 않습니다'}
          </p>
        </div>
      </div>

      {/* 푸시 알림 마스터 토글 */}
      <div className="mb-6">
        <div className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
              <Bell className="text-neutral-700 dark:text-neutral-300" size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-black dark:text-white">푸시 알림 받기</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {permissionGranted ? '알림 권한이 허용되어 있습니다' : '알림을 받으려면 활성화하세요'}
              </p>
            </div>
          </div>
          {requestingPermission ? (
            <div className="w-11 h-6 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <ToggleSwitch
              checked={!!pushActive}
              onChange={handlePushToggle}
            />
          )}
        </div>
      </div>

      {/* 수업 알림 시간 설정 */}
      {prefs.class_reminder && pushActive && (
        <div className="mb-6">
          <h3 className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 mb-2 px-1 uppercase tracking-wider">
            수업 알림 시간
          </h3>
          <div className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <Clock className="text-blue-500" size={18} />
              <p className="text-sm font-medium text-black dark:text-white">수업 시작 전 알림</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {REMINDER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => updatePreference('reminder_minutes_before', option.value)}
                  className={`py-1.5 px-3.5 rounded-xl text-xs font-medium transition-all ${
                    prefs.reminder_minutes_before === option.value
                      ? 'bg-primary dark:bg-[#CCFF00] text-black shadow-sm'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 세부 알림 카테고리 */}
      <div className="mb-6">
        <h3 className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 mb-2 px-1 uppercase tracking-wider">
          알림 유형별 설정
        </h3>
        <div className="space-y-1.5">
          {SETTING_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const disabled = !pushActive;
            const isEnabled = !!prefs[cat.field];
            const isExpanded = expandedCategory === cat.id;

            return (
              <div
                key={cat.id}
                className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden"
              >
                {/* 메인 토글 행 */}
                <div className="flex items-center gap-3 p-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cat.iconColor}`}>
                    <Icon size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      className="text-left w-full"
                      onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
                    >
                      <p className="text-sm font-bold text-black dark:text-white">{cat.label}</p>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                        {cat.description}
                      </p>
                    </button>
                  </div>
                  <ToggleSwitch
                    checked={isEnabled}
                    onChange={(v) => updatePreference(cat.field as string, v)}
                    disabled={disabled}
                  />
                </div>

                {/* 서브 아이템 (확장 시) */}
                {isExpanded && cat.subItems && (
                  <div className="border-t border-neutral-100 dark:border-neutral-800 px-4 pb-3 pt-2 ml-12 space-y-2">
                    {cat.subItems.map((sub, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                          isEnabled && !disabled ? 'bg-primary dark:bg-[#CCFF00]' : 'bg-neutral-300 dark:bg-neutral-600'
                        }`} />
                        <div>
                          <p className={`text-xs font-medium ${
                            isEnabled && !disabled ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-400 dark:text-neutral-600'
                          }`}>
                            {sub.label}
                          </p>
                          <p className="text-[10px] text-neutral-400 dark:text-neutral-500">{sub.description}</p>
                        </div>
                      </div>
                    ))}
                    {!isEnabled && (
                      <p className="text-[10px] text-neutral-400 italic">이 카테고리를 켜면 위 알림을 받습니다</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 안내 문구 */}
      <div className="text-center pb-8">
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
          알림 설정은 즉시 적용됩니다
        </p>
        <p className="text-[10px] text-neutral-400/60 dark:text-neutral-500/60 mt-0.5">
          기기 설정에서 앱 알림을 끄면 모든 푸시가 차단됩니다
        </p>
      </div>
    </div>
  );
}
