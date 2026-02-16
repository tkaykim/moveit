"use client";

import { useState, useEffect } from 'react';
import {
  Bell, Calendar, UserCheck2, Ticket, Video, MessageSquare, Megaphone, Clock, AlertTriangle, CheckCircle, XCircle, Loader2
} from 'lucide-react';
import { authFetch } from '@/lib/supabase/auth-fetch';

interface AcademyNotificationSettingsViewProps {
  academyId: string;
}

interface Settings {
  booking_confirmed: boolean;
  booking_cancelled: boolean;
  class_reminder: boolean;
  class_cancelled: boolean;
  attendance_checked: boolean;
  attendance_absent: boolean;
  ticket_purchased: boolean;
  ticket_expiry: boolean;
  video_uploaded: boolean;
  consultation_reply: boolean;
  marketing: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  booking_confirmed: true,
  booking_cancelled: true,
  class_reminder: true,
  class_cancelled: true,
  attendance_checked: true,
  attendance_absent: true,
  ticket_purchased: true,
  ticket_expiry: true,
  video_uploaded: true,
  consultation_reply: true,
  marketing: true,
};

const CATEGORIES = [
  {
    id: 'booking',
    label: '예약 관리',
    icon: Calendar,
    description: '수업 예약 및 취소 관련 알림',
    items: [
      { key: 'booking_confirmed', label: '예약 완료 알림', desc: '수강생이 수업을 예약했을 때 발송' },
      { key: 'booking_cancelled', label: '예약 취소 알림', desc: '수강생이 예약을 취소했을 때 발송' },
    ]
  },
  {
    id: 'class',
    label: '수업 관리',
    icon: Clock,
    description: '수업 일정 및 변동 사항 알림',
    items: [
      { key: 'class_reminder', label: '수업 당일 알림', desc: '수업 시작 전 리마인더 발송' },
      { key: 'class_cancelled', label: '수업 취소 알림', desc: '학원 사정으로 수업이 취소될 때 발송' },
    ]
  },
  {
    id: 'attendance',
    label: '출석 관리',
    icon: UserCheck2,
    description: '등하원 및 결석 알림',
    items: [
      { key: 'attendance_checked', label: '출석 확인 알림', desc: '출석 체크 시 수강생/학부모에게 발송' },
      { key: 'attendance_absent', label: '결석 알림', desc: '결석 처리 시 학부모에게 발송' },
    ]
  },
  {
    id: 'ticket',
    label: '수강권 관리',
    icon: Ticket,
    description: '수강권 구매 및 만료 알림',
    items: [
      { key: 'ticket_purchased', label: '수강권 구매 완료', desc: '수강권 결제/등록 완료 시 발송' },
      { key: 'ticket_expiry', label: '수강권 만료 임박', desc: '수강권 만료 7일/3일/1일 전 발송' },
    ]
  },
  {
    id: 'content',
    label: '콘텐츠/상담',
    icon: Video,
    description: '영상 업로드 및 상담 답변 알림',
    items: [
      { key: 'video_uploaded', label: '수업 영상 등록', desc: '수업 영상이 업로드되었을 때 발송' },
      { key: 'consultation_reply', label: '상담 답변 등록', desc: '문의하신 상담에 답변이 달렸을 때 발송' },
    ]
  },
  {
    id: 'marketing',
    label: '마케팅',
    icon: Megaphone,
    description: '이벤트 및 프로모션 알림',
    items: [
      { key: 'marketing', label: '마케팅/이벤트 알림', desc: '전체 공지 및 이벤트 알림 수신 동의' },
    ]
  },
];

export function AcademyNotificationSettingsView({ academyId }: AcademyNotificationSettingsViewProps) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, [academyId]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await authFetch(`/api/academy-admin/${academyId}/push/settings`);
      if (res.ok) {
        const data = await res.json();
        // Merge with defaults to handle missing keys
        setSettings({ ...DEFAULT_SETTINGS, ...data });
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
      setMessage({ type: 'error', text: '설정을 불러오는데 실패했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: keyof Settings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    
    // Debounced save or immediate save? Let's do immediate for better UX feedback, but maybe with a small delay if user clicks rapidly.
    // For simplicity, let's just save.
    saveSettings(newSettings);
  };

  const saveSettings = async (newSettings: Settings) => {
    try {
      setSaving(true);
      setMessage(null);
      const res = await authFetch(`/api/academy-admin/${academyId}/push/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });

      if (!res.ok) throw new Error('Failed to save');
      
      // Optional: Show success toast
    } catch (err) {
      console.error('Failed to save settings:', err);
      setMessage({ type: 'error', text: '설정 저장에 실패했습니다.' });
      // Revert UI on error? Ideally yes, but for now let's just show error.
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-neutral-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300">학원 알림 설정</h3>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 leading-relaxed">
              우리 학원에서 발송되는 자동 알림을 설정합니다.<br/>
              여기서 끄면(OFF), 해당 상황이 발생해도 수강생에게 알림이 전송되지 않습니다.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          return (
            <div key={cat.id} className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
              <div className="px-5 py-3 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 flex items-center gap-2">
                <Icon size={16} className="text-neutral-500" />
                <span className="font-semibold text-sm text-neutral-700 dark:text-neutral-300">{cat.label}</span>
              </div>
              <div className="p-2 divide-y divide-neutral-100 dark:divide-neutral-700">
                {cat.items.map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-3 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors rounded-md">
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">{item.label}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">{item.desc}</p>
                    </div>
                    <button
                      onClick={() => handleToggle(item.key as keyof Settings)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        settings[item.key as keyof Settings] ? 'bg-blue-600' : 'bg-neutral-200 dark:bg-neutral-600'
                      }`}
                    >
                      <span
                        className={`${
                          settings[item.key as keyof Settings] ? 'translate-x-6' : 'translate-x-1'
                        } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {message && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium animate-in slide-in-from-bottom-5 ${
          message.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}
          {message.text}
        </div>
      )}
    </div>
  );
}
