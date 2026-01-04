"use client";

import { Bell, User, QrCode, ChevronLeft, Gift, MessageCircle, CreditCard, FileText } from 'lucide-react';
import { QrModal } from '@/components/modals/qr-modal';
import { useState } from 'react';
import { ViewState } from '@/types';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { useAuth } from '@/contexts/AuthContext';
import { MyTab } from '@/components/auth/MyTab';
import { UserMenu } from '@/components/auth/UserMenu';

interface MyPageViewProps {
  myTickets: number;
  onQrOpen: () => void;
  onNavigate?: (view: ViewState) => void;
  onAcademyClick?: (academy: any) => void;
  onDancerClick?: (dancer: any) => void;
}

export const MyPageView = ({ myTickets, onQrOpen, onNavigate, onAcademyClick, onDancerClick }: MyPageViewProps) => {
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { user, profile, loading } = useAuth();

  // profile이 없어도 user 정보로 기본값 사용
  const displayName = profile?.nickname || profile?.name || user?.email?.split('@')[0] || '사용자';
  const profileImage = profile?.profile_image || null;
  const userEmail = profile?.email || user?.email || null;

  return (
    <>
      <div className="pt-12 px-5 pb-24 animate-in fade-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-black dark:text-white">마이 무브</h2>
          <div className="flex gap-3 items-center">
            <ThemeToggle />
            {user ? (
              <UserMenu />
            ) : (
              <Bell className="text-neutral-500 dark:text-neutral-500" />
            )}
          </div>
        </div>

        {/* 프로필 */}
        {loading ? (
          <div className="w-full flex items-center gap-4 mb-6 p-3 rounded-2xl">
            <div className="w-16 h-16 rounded-full bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
            <div className="flex-1">
              <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse w-24 mb-2" />
            </div>
          </div>
        ) : user ? (
          <button
            onClick={() => onNavigate?.('SETTINGS')}
            className="w-full flex items-center gap-4 mb-6 p-3 rounded-2xl hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors active:scale-[0.98]"
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-primary dark:from-[#CCFF00] to-green-500 p-[2px]">
              <div className="w-full h-full rounded-full bg-white dark:bg-black flex items-center justify-center overflow-hidden">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="text-black dark:text-white" size={24} />
                )}
              </div>
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-black dark:text-white">
                  {displayName}
                </h2>
                <ChevronLeft className="rotate-180 text-neutral-400" size={16} />
              </div>
              {userEmail && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {userEmail}
                </p>
              )}
            </div>
          </button>
        ) : (
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="w-full flex items-center gap-4 mb-6 p-3 rounded-2xl hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors active:scale-[0.98] border-2 border-dashed border-neutral-300 dark:border-neutral-700"
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-primary dark:from-[#CCFF00] to-green-500 p-[2px]">
              <div className="w-full h-full rounded-full bg-white dark:bg-black flex items-center justify-center overflow-hidden">
                <User className="text-black dark:text-white" size={24} />
              </div>
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-black dark:text-white">
                  로그인하세요
                </h2>
                <ChevronLeft className="rotate-180 text-neutral-400" size={16} />
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                로그인하여 더 많은 기능을 이용하세요
              </p>
            </div>
          </button>
        )}

        {/* 통계 */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-center">
            <div className="text-2xl font-black text-black dark:text-white mb-1">0</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 font-bold">포인트</div>
            <div className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">P</div>
          </div>
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-center">
            <div className="text-2xl font-black text-black dark:text-white mb-1">0</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 font-bold">쿠폰</div>
            <div className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">개</div>
          </div>
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-center">
            <div className="text-2xl font-black text-black dark:text-white mb-1">0</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 font-bold">찜</div>
            <div className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">개</div>
          </div>
        </div>

        {/* 주요 버튼 */}
        <button 
          onClick={() => setIsQrOpen(true)} 
          className="w-full bg-neutral-900 dark:bg-neutral-800 text-white rounded-2xl p-4 flex items-center justify-between mb-3 active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-xl">
              <QrCode size={24} />
            </div>
            <div className="text-left">
              <div className="text-base font-bold">QR코드로 출석하기</div>
            </div>
          </div>
        </button>

        <button 
          className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-4 flex items-center justify-between mb-6 active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="bg-neutral-200 dark:bg-neutral-700 p-2 rounded-xl">
              <Gift size={24} className="text-black dark:text-white" />
            </div>
            <div className="text-left">
              <div className="text-base font-bold text-black dark:text-white">친구 초대하기</div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">추천하고 포인트 받기</div>
            </div>
          </div>
        </button>

        {/* 빠른 메뉴 */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <button 
            onClick={() => onNavigate?.('TICKETS')}
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-[0.98] transition-transform"
          >
            <User className="text-neutral-600 dark:text-neutral-400" size={20} />
            <span className="text-xs font-bold text-black dark:text-white">회원권</span>
          </button>
          <button 
            onClick={() => onNavigate?.('PAYMENT_HISTORY')}
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-[0.98] transition-transform"
          >
            <CreditCard className="text-neutral-600 dark:text-neutral-400" size={20} />
            <span className="text-xs font-bold text-black dark:text-white">결제내역</span>
          </button>
          <button className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-[0.98] transition-transform">
            <MessageCircle className="text-neutral-600 dark:text-neutral-400" size={20} />
            <span className="text-xs font-bold text-black dark:text-white">상담톡</span>
          </button>
          <button className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-[0.98] transition-transform">
            <FileText className="text-neutral-600 dark:text-neutral-400" size={20} />
            <span className="text-xs font-bold text-black dark:text-white">후기관리</span>
          </button>
        </div>

        {/* 메뉴 리스트 */}
        <div className="space-y-1 mb-6">
          <button className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-left flex items-center justify-between active:scale-[0.98] transition-transform">
            <span className="text-sm font-bold text-black dark:text-white">시설등록요청</span>
            <ChevronLeft className="rotate-180 text-neutral-400" size={16} />
          </button>
          <button className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-left flex items-center justify-between active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-black dark:text-white">친구초대</span>
              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">5,000P 받기</span>
            </div>
            <ChevronLeft className="rotate-180 text-neutral-400" size={16} />
          </button>
          <button className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-left flex items-center justify-between active:scale-[0.98] transition-transform">
            <span className="text-sm font-bold text-black dark:text-white">1:1 문의</span>
            <ChevronLeft className="rotate-180 text-neutral-400" size={16} />
          </button>
          <button 
            onClick={() => onNavigate?.('FAQ')}
            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-left flex items-center justify-between active:scale-[0.98] transition-transform"
          >
            <span className="text-sm font-bold text-black dark:text-white">FAQ</span>
            <ChevronLeft className="rotate-180 text-neutral-400" size={16} />
          </button>
          <button 
            onClick={() => onNavigate?.('NOTICES')}
            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-left flex items-center justify-between active:scale-[0.98] transition-transform"
          >
            <span className="text-sm font-bold text-black dark:text-white">공지/이벤트</span>
            <ChevronLeft className="rotate-180 text-neutral-400" size={16} />
          </button>
          <button 
            onClick={() => onNavigate?.('SETTINGS')}
            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-left flex items-center justify-between active:scale-[0.98] transition-transform"
          >
            <span className="text-sm font-bold text-black dark:text-white">설정</span>
            <ChevronLeft className="rotate-180 text-neutral-400" size={16} />
          </button>
        </div>

        {/* 배너 */}
        <div className="bg-neutral-100 dark:bg-neutral-800 rounded-2xl p-5 mb-6">
          <div className="text-sm font-bold text-black dark:text-white mb-1">댄스를 시작하는 당신에게</div>
          <div className="text-xs text-neutral-600 dark:text-neutral-400">MOVE.IT에서 클래스를 예약해보세요</div>
        </div>
      </div>
      <QrModal isOpen={isQrOpen} onClose={() => setIsQrOpen(false)} />
      <MyTab isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
};
