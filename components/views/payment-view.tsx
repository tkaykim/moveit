"use client";

import { ChevronLeft, Wallet, CheckCircle } from 'lucide-react';
import { Academy, ClassInfo } from '@/types';

interface PaymentViewProps {
  academy: Academy | null;
  classInfo: (ClassInfo & { time?: string; price?: number }) | null;
  myTickets: number;
  onBack: () => void;
  onPayment: () => void;
}

export const PaymentView = ({ academy, classInfo, myTickets, onBack, onPayment }: PaymentViewProps) => {
  return (
    <div className="bg-white dark:bg-neutral-950 min-h-screen pt-12 px-5 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 -ml-2 text-black dark:text-white">
          <ChevronLeft />
        </button>
        <h2 className="text-xl font-bold text-black dark:text-white">결제하기</h2>
      </div>
      <div className="bg-neutral-100 dark:bg-neutral-900 rounded-2xl p-5 border border-neutral-200 dark:border-neutral-800 mb-6">
        <div className="flex justify-between mb-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
          <div>
            <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
              {academy?.name || "JustJerk Academy"}
            </div>
            <h3 className="text-xl font-black text-black dark:text-white">
              {classInfo?.instructor} <span className="text-sm font-normal text-neutral-600 dark:text-neutral-400">Class</span>
            </h3>
          </div>
          <div className="text-right">
            <div className="text-xs text-neutral-500 dark:text-neutral-500">시간</div>
            <div className="text-black dark:text-white font-bold">{classInfo?.time || "18:00"}</div>
          </div>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-neutral-600 dark:text-neutral-400">결제 금액</span>
          <span className="text-xl font-bold text-primary dark:text-[#CCFF00]">
            {classInfo?.price?.toLocaleString() || "35,000"}원
          </span>
        </div>
      </div>
      <div className="space-y-3 mb-8">
        <h3 className="text-black dark:text-white font-bold text-sm">결제 수단</h3>
        <button className="w-full bg-neutral-200 dark:bg-neutral-800 border-2 border-primary dark:border-[#CCFF00] rounded-xl p-4 flex justify-between items-center relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 dark:bg-[#CCFF00]/20 flex items-center justify-center">
              <Wallet className="text-primary dark:text-[#CCFF00]" size={20} />
            </div>
            <div className="text-left">
              <div className="text-black dark:text-white font-bold">보유 수강권 사용</div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">잔여: {myTickets}회</div>
            </div>
          </div>
          <div className="w-5 h-5 rounded-full bg-primary dark:bg-[#CCFF00] flex items-center justify-center">
            <CheckCircle size={14} className="text-black" />
          </div>
        </button>
      </div>
      <button 
        onClick={onPayment} 
        className="w-full bg-primary dark:bg-[#CCFF00] text-black font-black py-4 rounded-xl text-lg shadow-[0_0_20px_rgba(204,255,0,0.3)] active:scale-95 transition-transform"
      >
        1회권 차감하여 결제하기
      </button>
    </div>
  );
};




