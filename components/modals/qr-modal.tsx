"use client";

import { fetchWithAuth } from '@/lib/api/auth-fetch';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, RefreshCw, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface QrModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  bookingInfo?: {
    className?: string;
    academyName?: string;
    startTime?: string;
  };
}

const QR_EXPIRY_SECONDS = 180; // 3분

export const QrModal = ({ isOpen, onClose, bookingId, bookingInfo }: QrModalProps) => {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(QR_EXPIRY_SECONDS);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const expiryRef = useRef<number>(0);

  const fetchToken = useCallback(async () => {
    if (!bookingId) return;
    
    setLoading(true);
    setError(null);

    try {
      const res = await fetchWithAuth('/api/attendance/qr-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'QR 코드 생성에 실패했습니다.');
        setToken(null);
        return;
      }

      setToken(data.token);
      setRemainingSeconds(QR_EXPIRY_SECONDS);
      expiryRef.current = Date.now() + QR_EXPIRY_SECONDS * 1000;
    } catch {
      setError('네트워크 오류가 발생했습니다.');
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  // 모달 열릴 때 토큰 발급
  useEffect(() => {
    if (isOpen && bookingId) {
      fetchToken();
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isOpen, bookingId, fetchToken]);

  // 카운트다운 타이머
  useEffect(() => {
    if (!isOpen || !token) return;

    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((expiryRef.current - Date.now()) / 1000));
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        // 만료 시 자동 재발급
        fetchToken();
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isOpen, token, fetchToken]);

  // 모달 닫힐 때 상태 초기화
  useEffect(() => {
    if (!isOpen) {
      setToken(null);
      setError(null);
      setRemainingSeconds(QR_EXPIRY_SECONDS);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeDisplay = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  const isExpiring = remainingSeconds <= 30;

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const hours = date.getHours();
    const mins = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${mins}`;
  };

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-sm animate-in fade-in" 
      onClick={onClose}
    >
      {/* 모달 전체를 다크 테마로: 화면 빛 출력 최소화 */}
      <div 
        className="bg-neutral-900 rounded-3xl p-8 w-[90%] max-w-[360px] flex flex-col items-center relative border border-neutral-700" 
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        <h3 className="text-xl font-bold text-white mb-1">QR CHECK-IN</h3>
        <p className="text-xs text-neutral-400 mb-4">입장 시 리더기에 태그해주세요</p>

        {/* 예약 정보 */}
        {bookingInfo && (
          <div className="w-full bg-neutral-800 rounded-xl p-3 mb-4 text-center">
            <div className="font-semibold text-sm text-white">
              {bookingInfo.className}
            </div>
            {bookingInfo.academyName && (
              <div className="text-xs text-neutral-400 mt-0.5">
                {bookingInfo.academyName}
              </div>
            )}
            {bookingInfo.startTime && (
              <div className="text-xs text-neutral-400 mt-0.5">
                {formatTime(bookingInfo.startTime)}
              </div>
            )}
          </div>
        )}

        {/* QR 코드 영역: 회색 배경으로 빛 출력 ~40% 감소 */}
        <div className="w-64 h-64 p-2 rounded-2xl mb-4 flex items-center justify-center" style={{ backgroundColor: '#909090' }}>
          {loading ? (
            <Loader2 size={48} className="text-neutral-600 animate-spin" />
          ) : error ? (
            <div className="text-center px-4">
              <p className="text-sm text-red-400 mb-3">{error}</p>
              <button
                onClick={fetchToken}
                className="flex items-center gap-2 mx-auto text-sm text-[#CCFF00] font-medium hover:underline"
              >
                <RefreshCw size={14} />
                다시 시도
              </button>
            </div>
          ) : token ? (
            <QRCodeSVG
              value={token}
              size={240}
              level="L"
              includeMargin={true}
              bgColor="#909090"
              fgColor="#000000"
            />
          ) : null}
        </div>

        {/* 타이머 + 새로고침 */}
        {token && (
          <div className="flex items-center gap-3">
            <div className={`text-sm font-medium font-mono ${
              isExpiring 
                ? 'text-red-400 animate-pulse' 
                : 'text-neutral-400'
            }`}>
              {timeDisplay} 남음
            </div>
            <button
              onClick={fetchToken}
              disabled={loading}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors"
              title="QR 코드 새로고침"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        )}

        {/* 인식 안내 */}
        <p className="text-[10px] text-neutral-500 mt-3 text-center">
          인식이 안 되면 화면 밝기를 낮춰주세요
        </p>
      </div>
    </div>
  );
};
