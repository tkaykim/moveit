"use client";

import { Bell, User, QrCode, ChevronLeft, Gift, Ticket, Heart, Share2, MessageCircle, HelpCircle, Megaphone, Settings, CreditCard, FileText, LogIn, LogOut } from 'lucide-react';
import { QrModal } from '@/components/modals/qr-modal';
import { SignupModal } from '@/components/auth/signup-modal';
import { LoginModal } from '@/components/auth/login-modal';
import { useState, useEffect } from 'react';
import { HistoryLog, Academy, Dancer, ViewState } from '@/types';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { useAuth } from '@/lib/auth/auth-context';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ThemeToggle } from '@/components/common/theme-toggle';

interface MyPageViewProps {
  myTickets: number;
  onQrOpen: () => void;
  onNavigate?: (view: ViewState) => void;
  onAcademyClick?: (academy: Academy) => void;
  onDancerClick?: (dancer: Dancer) => void;
}

// DB Academy를 UI Academy로 변환
function transformAcademy(dbAcademy: any): Academy {
  const name = dbAcademy.name_kr || dbAcademy.name_en || '이름 없음';
  const images = (dbAcademy.images && Array.isArray(dbAcademy.images)) ? dbAcademy.images : [];
  const sortedImages = images.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
  const imageUrl = sortedImages.length > 0 
    ? sortedImages[0].url 
    : dbAcademy.logo_url;

  return {
    id: dbAcademy.id,
    name_kr: dbAcademy.name_kr,
    name_en: dbAcademy.name_en,
    tags: dbAcademy.tags,
    logo_url: dbAcademy.logo_url,
    name,
    dist: undefined,
    rating: undefined,
    price: undefined,
    badges: [],
    img: imageUrl || undefined,
    academyId: dbAcademy.id,
    address: dbAcademy.address,
  };
}

// DB Instructor를 UI Dancer로 변환
function transformInstructor(dbInstructor: any): Dancer {
  const name = dbInstructor.name_kr || dbInstructor.name_en || '이름 없음';
  const specialties = dbInstructor.specialties || '';
  const genre = specialties.split(',')[0]?.trim() || 'ALL';
  const crew = specialties.split(',')[1]?.trim() || '';

  return {
    id: dbInstructor.id,
    name_kr: dbInstructor.name_kr,
    name_en: dbInstructor.name_en,
    bio: dbInstructor.bio,
    instagram_url: dbInstructor.instagram_url,
    specialties: dbInstructor.specialties,
    name,
    crew: crew || undefined,
    genre: genre || undefined,
    followers: undefined,
    img: dbInstructor.profile_image_url || undefined,
  };
}

// Booking을 HistoryLog로 변환
function transformBooking(booking: any): HistoryLog {
  const classData = booking.classes || {};
  const instructor = classData.instructors || {};
  const academy = classData.academies || {};
  const date = booking.created_at ? new Date(booking.created_at) : new Date();
  
  return {
    id: booking.id,
    date: booking.created_at 
      ? date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
      : '-',
    class: classData.title || '클래스 정보 없음',
    instructor: instructor.name_kr || instructor.name_en || '강사 정보 없음',
    studio: academy.name_kr || academy.name_en || academy.address || '학원 정보 없음',
    status: booking.status === 'CONFIRMED' || booking.status === 'COMPLETED' ? 'ATTENDED' : booking.status as 'ATTENDED' | 'ABSENT' | 'CONFIRMED',
  };
}

export const MyPageView = ({ myTickets, onQrOpen, onNavigate, onAcademyClick, onDancerClick }: MyPageViewProps) => {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>([]);
  const [userName, setUserName] = useState('사용자');
  const [userEmail, setUserEmail] = useState('');
  const [userProfileImage, setUserProfileImage] = useState<string | null>(null);
  const [totalTickets, setTotalTickets] = useState(0);
  const [remainingTickets, setRemainingTickets] = useState(0);
  const [loading, setLoading] = useState(true);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [points, setPoints] = useState(0);
  const [coupons, setCoupons] = useState(0);
  const [favorites, setFavorites] = useState(0);
  const [savedTab, setSavedTab] = useState<'ACADEMY' | 'DANCER'>('ACADEMY');
  const [savedAcademies, setSavedAcademies] = useState<Academy[]>([]);
  const [savedDancers, setSavedDancers] = useState<Dancer[]>([]);

  useEffect(() => {
    // AuthContext에서 사용자 정보 가져오기
    if (profile) {
      const name = profile.name || profile.nickname || user?.email?.split('@')[0] || '사용자';
      setUserName(name);
      setUserEmail(profile.email || user?.email || '');
      setUserProfileImage(profile.profile_image || null);
    } else if (user) {
      const name = user.email?.split('@')[0] || '사용자';
      setUserName(name);
      setUserEmail(user.email || '');
    } else {
      setUserName('사용자');
      setUserEmail('');
      setUserProfileImage(null);
    }

    async function loadUserData() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          setLoading(false);
          return;
        }

        // 사용자 프로필은 AuthContext에서 이미 가져왔으므로 여기서는 추가 데이터만 로드

        // 포인트, 쿠폰은 아직 테이블이 없으므로 0으로 설정
        setPoints(0);
        setCoupons(0);
        
        // 찜한 학원 목록 로드
        const { data: academyFavorites } = await (supabase as any)
          .from('academy_favorites')
          .select(`
            *,
            academies (*)
          `)
          .eq('user_id', user.id);
        
        const savedAcademiesList = ((academyFavorites || []) as any[])
          .map((fav: any) => transformAcademy(fav.academies))
          .filter((academy: Academy) => academy.id); // 유효한 학원만 필터링
        setSavedAcademies(savedAcademiesList);
        
        // 찜한 강사 목록 로드
        const { data: instructorFavorites } = await (supabase as any)
          .from('instructor_favorites')
          .select(`
            *,
            instructors (*)
          `)
          .eq('user_id', user.id);
        
        const savedDancersList = ((instructorFavorites || []) as any[])
          .map((fav: any) => transformInstructor(fav.instructors))
          .filter((dancer: Dancer) => dancer.id); // 유효한 강사만 필터링
        setSavedDancers(savedDancersList);
        
        setFavorites(savedAcademiesList.length + savedDancersList.length);

        // 수강권 정보 가져오기
        const { data: userTickets } = await (supabase as any)
          .from('user_tickets')
          .select('*, tickets(*)')
          .eq('user_id', user.id)
          .eq('status', 'ACTIVE');
        
        const activeTickets = userTickets || [];
        const total = activeTickets.reduce((sum: number, ut: any) => sum + (ut.remaining_count || 0), 0);
        setTotalTickets(total);
        setRemainingTickets(total);

        // 예약 내역 가져오기 (bookings는 class_id를 가지고 있음)
        const { data: bookings } = await (supabase as any)
          .from('bookings')
          .select(`
            *,
            classes (
              *,
              academies (*),
              instructors (*)
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        const logs = ((bookings || []) as any[]).map(transformBooking);
        setHistoryLogs(logs);

        // 이번 달 출석 수 계산
        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();
        const thisMonthBookings = ((bookings || []) as any[]).filter((b: any) => {
          if (!b.created_at) return false;
          const bookingDate = new Date(b.created_at);
          return bookingDate.getMonth() === thisMonth && 
                 bookingDate.getFullYear() === thisYear && 
                 b.status === 'CONFIRMED';
        });
        setAttendanceCount(thisMonthBookings.length);
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadUserData();
  }, [user, profile]);

  const handleLogin = () => {
    setIsSignupModalOpen(false);
    setIsLoginModalOpen(true);
  };

  const handleSignup = () => {
    setIsLoginModalOpen(false);
    setIsSignupModalOpen(true);
  };

  const handleAuthSuccess = () => {
    // 인증 성공 후 페이지 새로고침
    router.refresh();
  };

  const handleLogout = async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      await signOut();
      router.push('/');
      router.refresh();
    }
  };

  if (authLoading || loading) {
    return (
      <div className="pt-12 px-5 pb-24 animate-in fade-in">
        <div className="text-center py-12 text-neutral-500">로딩 중...</div>
      </div>
    );
  }

  // 로그인되지 않은 경우
  if (!user) {
    return (
      <div className="pt-12 px-5 pb-24 animate-in fade-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-black dark:text-white">마이 무브</h2>
          <div className="flex gap-3 items-center">
            <ThemeToggle />
            <Bell className="text-neutral-500 dark:text-neutral-500" />
          </div>
        </div>

        {/* 로그인 안내 */}
        <div className="space-y-3 mb-6">
          <button
            onClick={handleLogin}
            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-primary dark:from-[#CCFF00] to-green-500 p-[2px]">
                <div className="w-full h-full rounded-full bg-white dark:bg-black flex items-center justify-center">
                  <LogIn className="text-black dark:text-white" size={24} />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-black dark:text-white mb-1">
                  로그인하세요
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  로그인하여 모든 기능을 이용하세요
                </p>
              </div>
              <ChevronLeft className="rotate-180 text-neutral-400" size={16} />
            </div>
          </button>
          <button
            onClick={handleSignup}
            className="w-full bg-primary dark:bg-[#CCFF00] text-black font-semibold rounded-2xl p-4 text-center hover:bg-primary/90 dark:hover:bg-[#CCFF00]/90 transition-colors active:scale-[0.98]"
          >
            회원가입
          </button>
        </div>

        {/* 비회원도 볼 수 있는 메뉴 */}
        <div className="space-y-1 mb-6">
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
        </div>
      </div>
    );
  }

  // 로그인된 경우
  return (
    <>
      <div className="pt-12 px-5 pb-24 animate-in fade-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-black dark:text-white">마이 무브</h2>
          <div className="flex gap-3 items-center">
            <ThemeToggle />
            <Bell className="text-neutral-500 dark:text-neutral-500" />
          </div>
        </div>

        {/* 프로필 */}
        <button
          onClick={() => onNavigate?.('SETTINGS')}
          className="w-full flex items-center gap-4 mb-6 p-3 rounded-2xl hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors active:scale-[0.98]"
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-primary dark:from-[#CCFF00] to-green-500 p-[2px]">
            <div className="w-full h-full rounded-full bg-white dark:bg-black flex items-center justify-center overflow-hidden">
              {userProfileImage ? (
                <Image 
                  src={userProfileImage}
                  alt={userName}
                  width={64}
                  height={64}
                  className="object-cover"
                />
              ) : (
                <User className="text-black dark:text-white" size={24} />
              )}
            </div>
          </div>
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-black dark:text-white">
                {userName}
              </h2>
              <ChevronLeft className="rotate-180 text-neutral-400" size={16} />
            </div>
            {userEmail && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {userEmail}
              </p>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleLogout();
            }}
            className="px-3 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-red-500 dark:hover:text-red-400 transition-colors flex items-center gap-1.5 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-red-300 dark:hover:border-red-700"
            title="로그아웃"
            aria-label="로그아웃"
          >
            <LogOut size={16} />
            <span className="text-xs font-medium">로그아웃</span>
          </button>
        </button>

        {/* 통계 */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-center">
            <div className="text-2xl font-black text-black dark:text-white mb-1">{points}</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 font-bold">포인트</div>
            <div className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">P</div>
          </div>
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-center">
            <div className="text-2xl font-black text-black dark:text-white mb-1">{coupons}</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 font-bold">쿠폰</div>
            <div className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">개</div>
          </div>
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-center">
            <div className="text-2xl font-black text-black dark:text-white mb-1">{favorites}</div>
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

        {/* 찜한 목록 */}
        <div className="space-y-4 mb-6">
          <h3 className="text-lg font-bold text-black dark:text-white">찜한 목록</h3>
          <div className="flex bg-neutral-100 dark:bg-neutral-900 p-1 rounded-xl border border-neutral-200 dark:border-neutral-800 mb-4">
            <button 
              onClick={() => setSavedTab('ACADEMY')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                savedTab === 'ACADEMY' 
                  ? 'bg-white dark:bg-neutral-800 text-black dark:text-white shadow-sm' 
                  : 'text-neutral-500 dark:text-neutral-500'
              }`}
            >
              학원 ({savedAcademies.length})
            </button>
            <button 
              onClick={() => setSavedTab('DANCER')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                savedTab === 'DANCER' 
                  ? 'bg-white dark:bg-neutral-800 text-black dark:text-white shadow-sm' 
                  : 'text-neutral-500 dark:text-neutral-500'
              }`}
            >
              강사 ({savedDancers.length})
            </button>
          </div>

          <div className="space-y-3">
            {savedTab === 'ACADEMY' && (
              savedAcademies.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-neutral-500 dark:text-neutral-400 mb-4">찜한 학원이 없습니다.</p>
                  <button
                    onClick={() => onNavigate?.('ACADEMY')}
                    className="px-6 py-2 bg-primary dark:bg-[#CCFF00] text-black font-bold rounded-lg hover:opacity-90 transition-opacity"
                  >
                    찜하러 가기
                  </button>
                </div>
              ) : (
                savedAcademies.map(item => (
                  <div 
                    key={item.id}
                    onClick={() => onAcademyClick?.(item)}
                    className="bg-white dark:bg-neutral-900 p-3 rounded-2xl flex gap-3 items-center border border-neutral-200 dark:border-neutral-800 cursor-pointer active:scale-[0.98] transition-transform"
                  >
                    <div className="w-16 h-16 rounded-xl flex-shrink-0 relative overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                      {(item.img || item.logo_url) ? (
                        <Image 
                          src={item.img || item.logo_url || ''}
                          alt={item.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-neutral-100 dark:bg-neutral-800" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-black dark:text-white font-bold text-sm">{item.name}</h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-500">{item.address || '주소 정보 없음'}</p>
                    </div>
                    <button className="text-primary dark:text-[#CCFF00] p-2">
                      <Heart fill="currentColor" size={18} />
                    </button>
                  </div>
                ))
              )
            )}
            {savedTab === 'DANCER' && (
              savedDancers.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-neutral-500 dark:text-neutral-400 mb-4">찜한 강사가 없습니다.</p>
                  <button
                    onClick={() => onNavigate?.('DANCER')}
                    className="px-6 py-2 bg-primary dark:bg-[#CCFF00] text-black font-bold rounded-lg hover:opacity-90 transition-opacity"
                  >
                    찜하러 가기
                  </button>
                </div>
              ) : (
                savedDancers.map(item => (
                  <div 
                    key={item.id}
                    onClick={() => onDancerClick?.(item)}
                    className="bg-white dark:bg-neutral-900 p-3 rounded-2xl flex gap-3 items-center border border-neutral-200 dark:border-neutral-800 cursor-pointer active:scale-[0.98] transition-transform"
                  >
                    <div className="w-16 h-16 rounded-xl flex-shrink-0 relative overflow-hidden">
                      <Image 
                        src={item.img || `https://picsum.photos/seed/dancer${item.id}/64/64`}
                        alt={item.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-black dark:text-white font-bold text-sm">{item.name}</h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-500">
                        {item.genre || 'ALL'} {item.crew ? `• ${item.crew}` : ''}
                      </p>
                    </div>
                    <button className="text-primary dark:text-[#CCFF00] p-2">
                      <Heart fill="currentColor" size={18} />
                    </button>
                  </div>
                ))
              )
            )}
          </div>
        </div>

        {/* 최근 수강 기록 */}
        <div className="space-y-4 mb-6">
          <h3 className="text-lg font-bold text-black dark:text-white">최근 수강 기록</h3>
          {historyLogs.length === 0 ? (
            <div className="text-center py-12 text-neutral-500">수강 기록이 없습니다.</div>
          ) : (
            historyLogs.slice(0, 5).map((log) => (
              <div 
                key={log.id} 
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex justify-between items-center"
              >
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-500 mb-1">{log.date}</div>
                  <div className="text-black dark:text-white font-bold">{log.class}</div>
                  <div className="text-xs text-neutral-600 dark:text-neutral-400">{log.studio} • {log.instructor}</div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded ${
                  log.status === 'ATTENDED' || log.status === 'CONFIRMED'
                    ? 'bg-primary/10 dark:bg-[#CCFF00]/10 text-primary dark:text-[#CCFF00]' 
                    : 'bg-red-500/10 dark:bg-red-500/10 text-red-500 dark:text-red-400'
                }`}>
                  {log.status === 'ATTENDED' || log.status === 'CONFIRMED' ? '출석완료' : '결석'}
                </span>
              </div>
            ))
          )}
        </div>

        {/* 채팅 문의 플로팅 버튼 */}
        <button className="fixed bottom-32 right-5 bg-neutral-900 dark:bg-neutral-800 text-white p-4 rounded-full z-30 flex flex-col items-center gap-1 active:scale-95 transition-transform">
          <MessageCircle size={24} />
          <span className="text-[10px] font-bold">문의</span>
        </button>
      </div>
      <QrModal isOpen={isQrOpen} onClose={() => setIsQrOpen(false)} />
      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)}
        enableLogging={false}
        onSuccess={handleAuthSuccess}
        onSwitchToSignup={handleSignup}
      />
      <SignupModal 
        isOpen={isSignupModalOpen} 
        onClose={() => setIsSignupModalOpen(false)}
        enableLogging={false}
        onSuccess={handleAuthSuccess}
        onSwitchToLogin={handleLogin}
      />
    </>
  );
};

