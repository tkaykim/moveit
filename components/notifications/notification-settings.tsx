"use client";

import { useState, useEffect } from 'react';
import { ChevronLeft, Bell, Calendar, Ticket, ShoppingCart, Megaphone, Clock, Smartphone, AlertTriangle } from 'lucide-react';
import { usePushNotification } from '@/contexts/PushNotificationContext';
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
      className={`relative w-11 h-6 rounded-full transition-colors ${
        checked
          ? 'bg-primary dark:bg-[#CCFF00]'
          : 'bg-neutral-300 dark:bg-neutral-600'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

export function NotificationSettings({ onBack }: NotificationSettingsProps) {
  const {
    isSupported,
    permissionGranted,
    deviceToken,
    requestPermission,
    debugInfo,
  } = usePushNotification();

  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const res = await fetch('/api/notifications/preferences');
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
      await fetch('/api/notifications/preferences', {
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

  /** 푸시 알림 마스터 토글 - 실제 OS 권한 요청 */
  const handlePushToggle = async (enabled: boolean) => {
    if (enabled) {
      setRequestingPermission(true);
      try {
        const granted = await requestPermission();
        if (granted) {
          updatePreference('push_enabled', true);
        } else {
          // 권한 거부됨 - 시스템 설정으로 안내
          alert('알림 권한이 거부되었습니다.\n기기 설정 > 앱 > MOVE.IT > 알림에서 허용해주세요.');
        }
      } finally {
        setRequestingPermission(false);
      }
    } else {
      updatePreference('push_enabled', false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-neutral-950 min-h-screen pt-12 px-5">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="p-2 -ml-2 text-black dark:text-white">
            <ChevronLeft />
          </button>
          <h2 className="text-xl font-bold text-black dark:text-white">알림 설정</h2>
        </div>
        <div className="text-center py-12 text-neutral-500">로딩 중...</div>
      </div>
    );
  }

  if (!prefs) return null;

  const settingItems = [
    {
      icon: Calendar,
      label: '수업 알림',
      description: '수업 시작 전 미리 알림을 받습니다',
      field: 'class_reminder' as const,
      value: prefs.class_reminder,
    },
    {
      icon: ShoppingCart,
      label: '예약 알림',
      description: '예약 확인/취소 알림을 받습니다',
      field: 'booking_updates' as const,
      value: prefs.booking_updates,
    },
    {
      icon: Ticket,
      label: '수강권 알림',
      description: '수강권 구매/만료 알림을 받습니다',
      field: 'ticket_updates' as const,
      value: prefs.ticket_updates,
    },
    {
      icon: Megaphone,
      label: '마케팅/이벤트',
      description: '프로모션, 이벤트 알림을 받습니다',
      field: 'marketing' as const,
      value: prefs.marketing,
    },
  ];

  const reminderOptions = [
    { label: '30분 전', value: 30 },
    { label: '1시간 전', value: 60 },
    { label: '2시간 전', value: 120 },
    { label: '하루 전', value: 1440 },
  ];

  return (
    <div className="bg-white dark:bg-neutral-950 min-h-screen pt-12 px-5 pb-24 animate-in slide-in-from-right duration-300">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 -ml-2 text-black dark:text-white">
          <ChevronLeft />
        </button>
        <h2 className="text-xl font-bold text-black dark:text-white">알림 설정</h2>
        {saving && <span className="text-xs text-neutral-400 ml-auto">저장 중...</span>}
      </div>

      {/* 디바이스 상태 배너 */}
      <div className={`mb-4 p-3 rounded-xl flex items-center gap-3 text-sm ${
        deviceToken
          ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400'
          : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
      }`}>
        {deviceToken ? (
          <>
            <Smartphone size={18} />
            <span>이 기기에서 푸시 알림을 받을 수 있습니다</span>
          </>
        ) : (
          <>
            <AlertTriangle size={18} />
            <span>
              {isSupported
                ? '알림을 허용하면 푸시 알림을 받을 수 있습니다'
                : '이 환경에서는 앱 푸시를 지원하지 않습니다'}
            </span>
          </>
        )}
      </div>

      {/* 푸시 알림 마스터 토글 */}
      <div className="mb-6">
        <h3 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-2 px-1">
          푸시 알림
        </h3>
        <div className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="text-neutral-600 dark:text-neutral-400" size={20} />
            <div>
              <p className="text-sm font-bold text-black dark:text-white">푸시 알림</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {permissionGranted ? '앱 푸시 알림이 허용되어 있습니다' : '앱 푸시 알림을 받으려면 활성화하세요'}
              </p>
            </div>
          </div>
          {requestingPermission ? (
            <div className="w-11 h-6 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <ToggleSwitch
              checked={prefs.push_enabled && permissionGranted}
              onChange={handlePushToggle}
            />
          )}
        </div>
      </div>

      {/* 세부 알림 설정 */}
      <div className="mb-6">
        <h3 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-2 px-1">
          알림 유형
        </h3>
        <div className="space-y-1">
          {settingItems.map((item) => {
            const Icon = item.icon;
            const disabled = !prefs.push_enabled || !permissionGranted;
            return (
              <div
                key={item.field}
                className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Icon className="text-neutral-600 dark:text-neutral-400" size={20} />
                  <div>
                    <p className="text-sm font-bold text-black dark:text-white">{item.label}</p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      {item.description}
                    </p>
                  </div>
                </div>
                <ToggleSwitch
                  checked={item.value}
                  onChange={(v) => updatePreference(item.field, v)}
                  disabled={disabled}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* 디버그 정보 (임시) */}
      <div className="mb-4 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
        <p className="text-[10px] font-mono text-neutral-500 dark:text-neutral-400 mb-1">Push Debug Info:</p>
        <p className="text-[10px] font-mono text-neutral-600 dark:text-neutral-300 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
          {debugInfo || 'no info'}
          {typeof window !== 'undefined' && (window as any).__PUSH_DEBUG ? 
            '\n\nEarly: ' + ((window as any).__PUSH_DEBUG || []).join('\n') : ''}
        </p>
        <div className="mt-2 flex gap-2">
          <button
            onClick={async () => {
              const result = await requestPermission();
              alert('권한 요청 결과: ' + result);
            }}
            className="px-3 py-1 bg-blue-500 text-white text-xs rounded-lg"
          >
            수동 권한 요청
          </button>
          <button
            onClick={() => {
              const cap = (window as any).Capacitor;
              const info = {
                cap: !!cap,
                platform: cap?.getPlatform?.(),
                isNative: cap?.isNativePlatform?.(),
                bridge: !!(window as any).androidBridge,
                plugins: cap?.Plugins ? Object.keys(cap.Plugins) : 'none',
                pluginAvail: cap?.isPluginAvailable?.('PushNotifications'),
                earlyDebug: (window as any).__PUSH_DEBUG,
              };
              alert(JSON.stringify(info, null, 2));
            }}
            className="px-3 py-1 bg-gray-500 text-white text-xs rounded-lg"
          >
            브릿지 상태
          </button>
        </div>
      </div>

      {/* 수업 알림 시간 설정 */}
      {prefs.class_reminder && prefs.push_enabled && permissionGranted && (
        <div className="mb-6">
          <h3 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-2 px-1">
            수업 알림 시간
          </h3>
          <div className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <Clock className="text-neutral-600 dark:text-neutral-400" size={20} />
              <p className="text-sm font-bold text-black dark:text-white">수업 시작 전 알림</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {reminderOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => updatePreference('reminder_minutes_before', option.value)}
                  className={`py-1.5 px-3 rounded-xl text-xs font-medium transition-all ${
                    prefs.reminder_minutes_before === option.value
                      ? 'bg-primary dark:bg-[#CCFF00] text-black'
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
    </div>
  );
}
