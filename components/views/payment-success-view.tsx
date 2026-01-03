"use client";

import { CheckCircle } from 'lucide-react';
import { ViewState } from '@/types';

interface PaymentSuccessViewProps {
  myTickets: number;
  onNavigate: (view: ViewState) => void;
}

export const PaymentSuccessView = ({ myTickets, onNavigate }: PaymentSuccessViewProps) => {
  return (
    <div className="bg-white dark:bg-neutral-950 min-h-screen flex flex-col items-center justify-center p-6 animate-in zoom-in-95 duration-300 text-center">
      <div className="w-24 h-24 rounded-full bg-primary dark:bg-[#CCFF00] flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(204,255,0,0.4)]">
        <CheckCircle size={48} className="text-black" />
      </div>
      <h2 className="text-3xl font-black text-black dark:text-white mb-2">예약 완료!</h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-8">수업 시작 10분 전까지 학원에 도착해주세요.</p>
      <div className="bg-neutral-100 dark:bg-neutral-900 w-full rounded-2xl p-6 mb-8 border border-neutral-200 dark:border-neutral-800">
        <div className="flex justify-between mb-2">
          <span className="text-neutral-500 dark:text-neutral-500 text-sm">잔여 수강권</span>
          <span className="text-black dark:text-white font-bold">{myTickets}회</span>
        </div>
        <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
          <div className="h-full bg-primary dark:bg-[#CCFF00] w-[75%]"></div>
        </div>
      </div>
      <button 
        onClick={() => onNavigate('MY')} 
        className="w-full bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white font-bold py-4 rounded-xl mb-3"
      >
        예약 내역 확인하기
      </button>
      <button 
        onClick={() => onNavigate('HOME')} 
        className="text-neutral-500 dark:text-neutral-500 text-sm underline"
      >
        홈으로 돌아가기
      </button>
    </div>
  );
};



