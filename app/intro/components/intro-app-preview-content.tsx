'use client';

import React from 'react';
import { Search, Navigation, LayoutGrid, MapPin, Bell } from 'lucide-react';
import Link from 'next/link';

export function IntroAppPreviewContent() {
  return (
    <div className="pb-8 animate-in fade-in duration-300">
      <header className="px-4 pt-6 pb-3 bg-white dark:bg-neutral-950">
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-lg font-black italic tracking-tighter">
            MOVE<span className="text-neutral-800 dark:text-[#CCFF00]">.</span>IT
          </h1>
          <Bell className="text-neutral-500" size={20} />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
          <input
            type="text"
            readOnly
            placeholder="장르, 강사, 학원 검색"
            className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl py-2.5 pl-9 pr-3 text-sm text-neutral-500"
          />
        </div>
      </header>

      <div className="px-4 mt-3 flex gap-2">
        <div className="flex-1 flex items-center gap-2 px-3 py-3 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/40 dark:to-blue-900/30 border border-blue-200/60 dark:border-blue-800/40">
          <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
            <Navigation className="text-white" size={18} />
          </div>
          <div>
            <p className="text-[12px] font-bold text-blue-900 dark:text-blue-100">내 주변</p>
            <p className="text-[10px] text-blue-600/80 dark:text-blue-300/70">댄스학원 찾기</p>
          </div>
        </div>
        <div className="flex-1 flex items-center gap-2 px-3 py-3 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/40 dark:to-purple-900/30 border border-purple-200/60 dark:border-purple-800/40">
          <div className="w-9 h-9 rounded-lg bg-purple-500 flex items-center justify-center flex-shrink-0">
            <LayoutGrid className="text-white" size={18} />
          </div>
          <div>
            <p className="text-[12px] font-bold text-purple-900 dark:text-purple-100">장르별</p>
            <p className="text-[10px] text-purple-600/80 dark:text-purple-300/70">댄스학원 찾기</p>
          </div>
        </div>
      </div>

      <div className="mt-5 px-4">
        <h2 className="text-sm font-bold text-black dark:text-white mb-2">주변 댄스학원</h2>
        <div className="space-y-2">
          {[
            { name: '무빗 댄스 스튜디오', address: '서울 강남구', price: '120,000원~', tags: '힙합, 와킹' },
            { name: '비트 댄스 아카데미', address: '서울 마포구', price: '99,000원~', tags: '재즈, 컨템포러리' },
          ].map((item, i) => (
            <div
              key={i}
              className="flex gap-2.5 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-2.5"
            >
              <div className="w-14 h-14 rounded-lg bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
                <MapPin className="text-neutral-400" size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-black dark:text-white truncate">{item.name}</p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">{item.address}</p>
                <div className="flex gap-1 mt-1">
                  {item.tags.split(', ').map((tag, j) => (
                    <span key={j} className="text-[9px] px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <span className="text-xs font-bold text-neutral-800 dark:text-[#CCFF00] flex-shrink-0 self-center">
                {item.price}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 px-4">
        <h2 className="text-sm font-bold text-black dark:text-white mb-2">내 수강권</h2>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded">정규권</span>
              <p className="text-[13px] font-bold text-black dark:text-white mt-1">4주 정규반</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">~ 2025.03.15 · 잔여 8회</p>
            </div>
            <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">무빗 스튜디오</span>
          </div>
        </div>
      </div>

      <div className="mt-4 px-4 text-center">
        <Link
          href="/intro/demo"
          className="inline-flex items-center text-xs font-semibold text-[#CCFF00] dark:text-[#CCFF00] hover:underline"
        >
          전체 데모 체험하기 →
        </Link>
      </div>
    </div>
  );
}
