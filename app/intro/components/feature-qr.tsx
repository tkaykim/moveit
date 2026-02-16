'use client';

import React, { useState } from 'react';
import { QrCode, CheckCircle2, User } from 'lucide-react';

const DEMO_STUDENTS = [
  { name: '김민지', class: 'K-POP 입문', time: '18:00' },
  { name: '이준호', class: '걸스힙합', time: '19:30' },
  { name: '박서연', class: '코레오그래피', time: '21:00' },
];

export function FeatureQr() {
  const [scanning, setScanning] = useState(false);
  const [checkedIn, setCheckedIn] = useState<number[]>([]);
  const [currentScan, setCurrentScan] = useState<number | null>(null);

  const handleScan = () => {
    if (scanning) return;
    const nextIndex = checkedIn.length;
    if (nextIndex >= DEMO_STUDENTS.length) {
      setCheckedIn([]);
      return;
    }

    setScanning(true);
    setCurrentScan(nextIndex);
    
    setTimeout(() => {
      setCheckedIn(prev => [...prev, nextIndex]);
      setScanning(false);
      setTimeout(() => setCurrentScan(null), 1500);
    }, 1200);
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm">
      {/* QR Scanner Area — 아이콘·프레임 모두 가운데, 잘림 방지 */}
      <div className="relative aspect-square max-h-[200px] bg-neutral-950 overflow-hidden flex items-center justify-center p-4">
        <div className="absolute inset-0 flex items-center justify-center p-4">
          {/* Scan Lines (중앙 정렬, 컨테이너 안에 완전히 수용) */}
          <div className="relative w-[min(140px,65%)] aspect-square max-w-full border-2 border-[#CCFF00]/40 rounded-xl flex items-center justify-center shrink-0">
            <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-[#CCFF00] rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-[#CCFF00] rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-[#CCFF00] rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-[#CCFF00] rounded-br-lg" />
            {scanning && (
              <div className="absolute inset-0 overflow-hidden rounded-xl">
                <div className="absolute inset-x-0 h-0.5 bg-[#CCFF00] animate-[scanline_1.2s_ease-in-out_infinite" />
              </div>
            )}
            <QrCode className="text-[#CCFF00]/30 relative z-10 w-12 h-12 shrink-0" size={48} />
          </div>
        </div>

        {/* Success Overlay */}
        {currentScan !== null && !scanning && (
          <div className="absolute inset-0 z-20 bg-green-500/20 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
            <div className="text-center">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-2 animate-in zoom-in duration-300" />
              <p className="text-white font-bold text-sm">{DEMO_STUDENTS[currentScan].name}</p>
              <p className="text-green-300 text-xs">출석 완료!</p>
            </div>
          </div>
        )}
      </div>

      {/* Scan Button — 가운데 정렬 */}
      <div className="p-3 text-center">
        <button
          onClick={handleScan}
          disabled={scanning}
          className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${
            scanning
              ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
              : checkedIn.length >= DEMO_STUDENTS.length
                ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                : 'bg-neutral-900 dark:bg-[#CCFF00] text-white dark:text-black hover:opacity-90 active:scale-[0.98]'
          }`}
        >
          {scanning ? 'QR 스캔 중...' : checkedIn.length >= DEMO_STUDENTS.length ? '다시 체험하기' : 'QR 스캔 시뮬레이션'}
        </button>
      </div>

      {/* Check-in Log — 가운데 정렬 */}
      <div className="border-t border-neutral-100 dark:border-neutral-800 p-3 text-center">
        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mb-2">출석 로그</p>
        <div className="space-y-1.5">
          {checkedIn.length === 0 ? (
            <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center py-2">QR 스캔 버튼을 눌러 체험해보세요</p>
          ) : (
            checkedIn.map((idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 animate-in slide-in-from-left duration-300">
                <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-neutral-900 dark:text-white">{DEMO_STUDENTS[idx].name}</span>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400 ml-2">{DEMO_STUDENTS[idx].class} {DEMO_STUDENTS[idx].time}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes scanline {
          0% { top: 0; }
          50% { top: 100%; }
          100% { top: 0; }
        }
      `}</style>
    </div>
  );
}
