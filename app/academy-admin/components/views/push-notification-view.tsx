"use client";

import { useState, useEffect } from 'react';
import { Bell, Users, Send, Image as ImageIcon } from 'lucide-react';
import { authFetch } from '@/lib/supabase/auth-fetch';

interface PushNotificationViewProps {
  academyId: string;
}

interface PushSummary {
  total_students: number;
  active_tokens: number;
}

export function PushNotificationView({ academyId }: PushNotificationViewProps) {
  const [summary, setSummary] = useState<PushSummary | null>(null);
  const [loading, setLoading] = useState(true);
  
  // 폼 상태
  const [target, setTarget] = useState<'all' | 'specific'>('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [displayStyle, setDisplayStyle] = useState<'default' | 'big_text'>('default');
  const [clickAction, setClickAction] = useState<'none' | 'path' | 'url'>('none');
  const [clickPath, setClickPath] = useState('');
  const [clickUrl, setClickUrl] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchSummary();
  }, [academyId]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const response = await authFetch(`/api/academy-admin/${academyId}/push`);
      if (response.ok) {
        const data = await response.json();
        setSummary(data.summary);
      } else {
        console.error('Failed to fetch push summary');
      }
    } catch (error) {
      console.error('Error fetching push summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!title || !body) {
      alert('제목과 내용을 입력해주세요.');
      return;
    }

    // 클릭 액션 검증
    if (clickAction === 'path' && !clickPath) {
      alert('이동할 경로를 입력해주세요.');
      return;
    }
    if (clickAction === 'url' && !clickUrl) {
      alert('이동할 URL을 입력해주세요.');
      return;
    }

    try {
      setSending(true);
      
      const data: any = {
        display_style: displayStyle,
      };
      
      if (clickAction === 'path') {
        data.path = clickPath;
      } else if (clickAction === 'url') {
        data.url = clickUrl;
      }
      
      if (imageUrl) {
        data.image_url = imageUrl;
      }

      const response = await authFetch(`/api/academy-admin/${academyId}/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target,
          title,
          body,
          image_url: imageUrl || undefined,
          data,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`${result.sent_count}명에게 알림을 발송했습니다.`);
        // 폼 초기화
        setTitle('');
        setBody('');
        setImageUrl('');
        setClickPath('');
        setClickUrl('');
        setDisplayStyle('default');
        setClickAction('none');
      } else {
        const error = await response.json();
        alert(`알림 발송 실패: ${error.error}`);
      }
    } catch (error) {
      console.error('Error sending push:', error);
      alert('알림 발송 중 오류가 발생했습니다.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-neutral-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
            <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">알림 발송</h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              수강생들에게 푸시 알림을 발송합니다
            </p>
          </div>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">총 수강생</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                {summary?.total_students || 0}명
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Bell className="w-8 h-8 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">활성 디바이스</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                {summary?.active_tokens || 0}개
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 알림 발송 폼 */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 shadow-sm space-y-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">알림 작성</h2>

        {/* 대상 선택 */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            발송 대상
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="all"
                checked={target === 'all'}
                onChange={(e) => setTarget(e.target.value as 'all')}
                className="w-4 h-4"
              />
              <span className="text-sm text-neutral-700 dark:text-neutral-300">전체 수강생</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="specific"
                checked={target === 'specific'}
                onChange={(e) => setTarget(e.target.value as 'specific')}
                className="w-4 h-4"
                disabled
              />
              <span className="text-sm text-neutral-400 dark:text-neutral-500">특정 수강생 (준비 중)</span>
            </label>
          </div>
        </div>

        {/* 제목 */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            제목
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="알림 제목을 입력하세요"
            className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder-neutral-400"
          />
        </div>

        {/* 내용 */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            내용
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="알림 내용을 입력하세요"
            rows={4}
            className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder-neutral-400 resize-none"
          />
        </div>

        {/* 이미지 URL */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            이미지 URL (선택)
          </label>
          <div className="flex gap-2">
            <ImageIcon className="w-5 h-5 text-neutral-400 mt-2" />
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder-neutral-400"
            />
          </div>
        </div>

        {/* 표시 스타일 */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            표시 스타일
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="default"
                checked={displayStyle === 'default'}
                onChange={(e) => setDisplayStyle(e.target.value as 'default')}
                className="w-4 h-4"
              />
              <span className="text-sm text-neutral-700 dark:text-neutral-300">기본</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="big_text"
                checked={displayStyle === 'big_text'}
                onChange={(e) => setDisplayStyle(e.target.value as 'big_text')}
                className="w-4 h-4"
              />
              <span className="text-sm text-neutral-700 dark:text-neutral-300">긴 텍스트</span>
            </label>
          </div>
        </div>

        {/* 클릭 액션 */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            클릭 시 이동
          </label>
          <div className="space-y-3">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="none"
                  checked={clickAction === 'none'}
                  onChange={(e) => setClickAction(e.target.value as 'none')}
                  className="w-4 h-4"
                />
                <span className="text-sm text-neutral-700 dark:text-neutral-300">없음</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="path"
                  checked={clickAction === 'path'}
                  onChange={(e) => setClickAction(e.target.value as 'path')}
                  className="w-4 h-4"
                />
                <span className="text-sm text-neutral-700 dark:text-neutral-300">앱 내 경로</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="url"
                  checked={clickAction === 'url'}
                  onChange={(e) => setClickAction(e.target.value as 'url')}
                  className="w-4 h-4"
                />
                <span className="text-sm text-neutral-700 dark:text-neutral-300">외부 URL</span>
              </label>
            </div>
            
            {clickAction === 'path' && (
              <input
                type="text"
                value={clickPath}
                onChange={(e) => setClickPath(e.target.value)}
                placeholder="/my/bookings"
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder-neutral-400"
              />
            )}
            {clickAction === 'url' && (
              <input
                type="url"
                value={clickUrl}
                onChange={(e) => setClickUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder-neutral-400"
              />
            )}
          </div>
        </div>

        {/* 발송 버튼 */}
        <button
          onClick={handleSend}
          disabled={sending || !title || !body}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white rounded-lg font-medium transition-colors"
        >
          <Send className="w-5 h-5" />
          {sending ? '발송 중...' : '알림 발송'}
        </button>
      </div>
    </div>
  );
}
