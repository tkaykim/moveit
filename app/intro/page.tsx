'use client';

import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Users, 
  CreditCard, 
  Menu,
  X,
  Settings,
  Database,
  Ticket,
  QrCode,
  Bell,
  CalendarDays,
  BookOpen,
  UserCog,
  Sun,
  Moon
} from 'lucide-react';
import { ComparisonTable } from './components/comparison-table';
import { FeatureAttendance } from './components/feature-attendance';
import { FeatureTicket } from './components/feature-ticket';
import { FeatureCalendar } from './components/feature-calendar';
import { FeatureQr } from './components/feature-qr';
import { FeaturePush } from './components/feature-push';
import { PricingCards } from './components/pricing-cards';

const INTRO_THEME_KEY = 'intro-theme';

export default function IntroPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [year, setYear] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = localStorage.getItem(INTRO_THEME_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });

  useEffect(() => {
    setYear(String(new Date().getFullYear()));
  }, []);

  useEffect(() => {
    localStorage.setItem(INTRO_THEME_KEY, theme);
  }, [theme]);

  // intro 테마에 맞춰 document에 dark 클래스 동기화 — 라이트일 때 dark: 스타일이 적용되지 않도록
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isMobileMenuOpen]);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  const isLight = theme === 'light';

  return (
    <div className={`min-h-screen font-sans ${isLight ? 'bg-white text-neutral-900' : 'dark bg-neutral-950 text-neutral-100'}`}>
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/95 dark:bg-neutral-950/95 backdrop-blur border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-5xl mx-auto px-4 h-14 flex justify-between items-center">
          <div className="flex items-center cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <span className="text-xl font-bold text-neutral-900 dark:text-[#CCFF00]">MoveIt</span>
            <span className="ml-2 text-xs text-neutral-500 hidden sm:inline">댄스학원 운영 관리</span>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <button
              type="button"
              onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
              className="p-2 rounded-lg text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-[#CCFF00] transition-colors"
              aria-label={isLight ? '다크 모드로 전환' : '라이트 모드로 전환'}
            >
              {isLight ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <a href="#comparison" className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-[#CCFF00]">비교</a>
            <a href="#admin" className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-[#CCFF00]">관리자</a>
            <a href="#pricing" className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-[#CCFF00]">요금제</a>
            <a href="#contact" className="text-sm font-semibold text-white bg-neutral-900 dark:bg-[#CCFF00] dark:text-black px-3 py-1.5 rounded-lg">도입 문의</a>
          </div>
          <div className="flex sm:hidden items-center gap-1">
            <button
              type="button"
              onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
              className="p-2 rounded-lg text-neutral-500"
              aria-label={isLight ? '다크 모드' : '라이트 모드'}
            >
              {isLight ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 rounded-lg text-neutral-600 dark:text-neutral-400" aria-expanded={isMobileMenuOpen}>
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {isMobileMenuOpen && (
          <div className="sm:hidden fixed inset-0 top-14 z-40 bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 px-4 py-4 space-y-2">
            <a href="#comparison" onClick={closeMobileMenu} className="block py-2.5 font-medium text-neutral-900 dark:text-white">비교</a>
            <a href="#admin" onClick={closeMobileMenu} className="block py-2.5 font-medium text-neutral-900 dark:text-white">관리자</a>
            <a href="#pricing" onClick={closeMobileMenu} className="block py-2.5 font-medium text-neutral-900 dark:text-white">요금제</a>
            <a href="#contact" onClick={closeMobileMenu} className="block py-3 mt-4 text-center font-bold bg-neutral-900 dark:bg-[#CCFF00] dark:text-black text-white rounded-lg">도입 문의</a>
          </div>
        )}
      </nav>

      {/* ═══════ Hero (포인트만, 가운데 정렬) ═══════ */}
      <section className="py-8 sm:py-12 md:py-16 max-w-5xl mx-auto px-4 text-center bg-white dark:bg-transparent">
        <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-[#CCFF00]/15 text-neutral-700 dark:text-[#CCFF00] text-xs font-medium mb-4">
          현직 댄스학원 운영진이 직접 개발
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight leading-[1.15] mb-8 text-neutral-900 dark:text-white">
          댄스학원 운영,<br className="sm:hidden" />
          <span className="text-emerald-700 dark:text-[#CCFF00]">이제 무빗으로</span> 확실하게
        </h1>
        <div className="flex flex-col gap-4 max-w-2xl mx-auto">
          <p className="text-base sm:text-xl md:text-2xl font-bold text-neutral-800 dark:text-neutral-200 leading-snug px-1">
            회원·수강권을 일일이 <span className="text-amber-700 dark:text-amber-400">수기</span>로 관리 중이신가요?
          </p>
          <p className="text-base sm:text-xl md:text-2xl font-bold text-neutral-800 dark:text-neutral-200 leading-snug px-1">
            <span className="text-amber-700 dark:text-amber-400">헬스장 프로그램에 끼워</span> 맞춰 쓰고 계신가요?
          </p>
        </div>
      </section>

      {/* ═══════ 왜 댄스 학원은 전용 플랫폼을 써야 할까요? (비교 테이블) ═══════ */}
      <section id="comparison" className="py-10 md:py-14 bg-white dark:bg-neutral-950 overflow-x-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 px-1">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 text-neutral-900 dark:text-white">
              왜 댄스 학원은 전용 플랫폼을 써야 할까요?
            </h2>
            <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-300 break-words max-w-2xl mx-auto">
              헬스장, 필라테스용 프로그램으로는 해결할 수 없는 댄스 학원만의 니즈를 담았습니다.
            </p>
          </div>
          <ComparisonTable />
        </div>
      </section>

      {/* ═══════ 어떠한 댄스학원이든 지원 (1행 3열 카드) ═══════ */}
      <section className="py-10 md:py-14 bg-neutral-50 dark:bg-neutral-900/30">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-center text-xl sm:text-2xl md:text-3xl font-bold mb-2 text-neutral-900 dark:text-white">어떠한 댄스학원이든 지원</h2>
          <p className="text-center text-sm sm:text-base text-neutral-600 dark:text-neutral-300 mb-8">복잡한 운영 방식도 무빗 하나로 처리합니다.</p>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {[
              { icon: Calendar, line1: '기간제 학원', line2: '(정규 클래스)', color: 'text-neutral-900 dark:text-[#CCFF00]' },
              { icon: CreditCard, line1: '쿠폰제 학원', line2: '(팝업수업)', color: 'text-pink-600 dark:text-pink-400' },
              { icon: Users, line1: '단일 워크샵', line2: null, color: 'text-purple-600 dark:text-purple-400' },
            ].map(({ icon: Icon, line1, line2, color }) => (
              <div key={line1} className="p-4 sm:p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50 text-center">
                <div className="flex justify-center mb-2 sm:mb-3">
                  <Icon className={`w-7 h-7 sm:w-8 sm:h-8 ${color}`} />
                </div>
                <h3 className="font-bold text-xs sm:text-base leading-tight">
                  {line1}
                  {line2 != null && <><br /><span className="font-normal text-neutral-600 dark:text-neutral-400">{line2}</span></>}
                </h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ 관리자 대시보드 소개 ═══════ */}
      <section className="py-10 md:py-14 max-w-5xl mx-auto px-4 bg-white dark:bg-transparent">
        <h2 className="text-center text-xl sm:text-2xl md:text-3xl font-bold mb-2 text-neutral-900 dark:text-white">관리자 대시보드</h2>
        <p className="text-center text-sm sm:text-base text-neutral-600 dark:text-neutral-300 mb-8 max-w-2xl mx-auto">
          오늘의 수업 관리, 수업별 신청 인원(관리자에게만 보입니다), 클래스·스케줄·출석·수강권 기능을 한 화면에서.
        </p>
        <div className="relative rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-10 bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 flex items-center px-4 gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400/80" />
            <div className="w-3 h-3 rounded-full bg-amber-400/80" />
            <div className="w-3 h-3 rounded-full bg-green-400/80" />
            <span className="ml-3 text-[10px] text-neutral-400 font-medium">MoveIt 관리자</span>
          </div>
          <div className="pt-10 p-4 md:p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { icon: BookOpen, label: '클래스 관리', desc: '반 생성·관리', color: 'bg-blue-50 dark:bg-blue-900/20', iconColor: 'text-blue-600 dark:text-blue-400' },
                { icon: CalendarDays, label: '스케줄 관리', desc: '수업 일정', color: 'bg-purple-50 dark:bg-purple-900/20', iconColor: 'text-purple-600 dark:text-purple-400' },
                { icon: UserCog, label: '출석/신청', desc: '등록·수업별 인원', color: 'bg-green-50 dark:bg-green-900/20', iconColor: 'text-green-600 dark:text-green-400' },
                { icon: Ticket, label: '수강권 관리', desc: '상품 관리', color: 'bg-orange-50 dark:bg-orange-900/20', iconColor: 'text-orange-600 dark:text-orange-400' },
              ].map((btn, i) => {
                const Icon = btn.icon;
                return (
                  <div key={i} className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-100 dark:border-neutral-800">
                    <div className={`p-2.5 rounded-lg ${btn.color} w-fit mb-3`}>
                      <Icon className={`w-5 h-5 ${btn.iconColor}`} />
                    </div>
                    <h4 className="text-sm font-bold text-neutral-900 dark:text-white">{btn.label}</h4>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{btn.desc}</p>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: '오늘 매출', value: '₩1,250,000', change: '+12%' },
                    { label: '신규 등록', value: '8명', change: '+3명' },
                    { label: '출석률', value: '94%', change: '+2.5%' },
                  ].map((stat, i) => (
                    <div key={i} className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50">
                      <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mb-0.5">{stat.label}</p>
                      <p className="text-base font-bold text-neutral-900 dark:text-white">{stat.value}</p>
                      <p className="text-[10px] text-green-500 font-medium">{stat.change}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold mb-3 text-neutral-900 dark:text-white">오늘의 수업 · 신청 인원</h4>
                <div className="space-y-2">
                  {[
                    { time: '18:00', title: 'K-POP 입문', teacher: 'J-HO', status: '수업중', students: '18/20' },
                    { time: '19:30', title: '걸스힙합', teacher: 'MINA', status: '대기', students: '12/15' },
                    { time: '21:00', title: '코레오그래피', teacher: 'WOO', status: '대기', students: '8/20' },
                  ].map((cls, i) => (
                    <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-neutral-100 dark:border-neutral-800">
                      <div className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 w-9">{cls.time}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate text-neutral-900 dark:text-white">{cls.title}</p>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400">{cls.teacher} · {cls.students}</p>
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                        cls.status === '수업중' ? 'bg-[#CCFF00]/20 text-[#aacc00] dark:text-[#CCFF00]' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                      }`}>{cls.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ 직접 클릭해보세요! (Interactive) ═══════ */}
      <section id="admin" className="py-10 md:py-14 bg-white dark:bg-transparent">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex justify-center mb-10 md:mb-12 px-2">
            <div className="inline-flex items-center justify-center gap-2 px-5 py-3.5 sm:px-6 sm:py-4 rounded-2xl bg-[#CCFF00]/15 dark:bg-[#CCFF00]/20 border-2 border-[#CCFF00]/50 dark:border-[#CCFF00]/60 shadow-lg shadow-[#CCFF00]/10 animate-[intro-cta-pulse_2.5s_ease-in-out_infinite] text-center">
              <span className="text-base sm:text-lg md:text-2xl font-black text-neutral-900 dark:text-[#CCFF00] tracking-tight">
                직접 클릭해보세요!
              </span>
            </div>
          </div>

          {/* Feature 1: 캘린더 */}
          <div id="features" className="grid md:grid-cols-2 gap-6 md:gap-10 items-center mb-14 md:mb-16">
            <div className="text-center">
              <span className="inline-block px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-bold mb-3">수업 캘린더</span>
              <h3 className="text-lg md:text-xl font-bold text-neutral-900 dark:text-white">날짜 클릭 → 그날 수업 한눈에</h3>
            </div>
            <div className="relative">
              <div className="absolute -inset-3 bg-gradient-to-tr from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-3xl blur-2xl opacity-50" />
              <div className="relative"><FeatureCalendar /></div>
            </div>
          </div>

          {/* Feature 2: 출석 — 모바일에서는 글 먼저, md에서만 좌우 스왑 */}
          <div className="grid md:grid-cols-2 gap-6 md:gap-10 items-center mb-14 md:mb-16">
            <div className="text-center md:order-last">
              <span className="inline-block px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold mb-3">3초 출석체크</span>
              <h3 className="text-lg md:text-xl font-bold text-neutral-900 dark:text-white">명단 자동 · 터치 한 번 출석</h3>
            </div>
            <div className="relative md:order-first">
              <div className="absolute -inset-3 bg-gradient-to-tr from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-3xl blur-2xl opacity-50" />
              <div className="relative"><FeatureAttendance /></div>
            </div>
          </div>

          {/* Feature 3: QR — 가운데 정렬 */}
          <div className="grid md:grid-cols-2 gap-6 md:gap-10 items-center mb-14 md:mb-16">
            <div className="text-center">
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold mb-3">QR 출석</span>
              <h3 className="text-lg md:text-xl font-bold text-neutral-900 dark:text-white">스캔 한 번 → 출석 자동 처리</h3>
            </div>
            <div className="relative flex justify-center">
              <div className="absolute -inset-3 bg-gradient-to-tr from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-3xl blur-2xl opacity-50" />
              <div className="relative w-full max-w-[280px]"><FeatureQr /></div>
            </div>
          </div>

          {/* Feature 4: 수강권 — 모바일에서는 글 먼저, md에서만 좌우 스왑 */}
          <div className="grid md:grid-cols-2 gap-6 md:gap-10 items-center mb-14 md:mb-16">
            <div className="text-center md:order-last">
              <span className="inline-block px-3 py-1 rounded-full bg-[#CCFF00]/20 text-[#aacc00] dark:text-[#CCFF00] text-xs font-bold mb-3">수강권</span>
              <h3 className="text-lg md:text-xl font-bold text-neutral-900 dark:text-white">예약 시 자동 차감 · 실수 없음</h3>
            </div>
            <div className="relative md:order-first">
              <div className="absolute -inset-3 bg-gradient-to-tr from-[#CCFF00]/20 to-green-50 dark:from-[#CCFF00]/10 dark:to-green-900/20 rounded-3xl blur-2xl opacity-50" />
              <div className="relative"><FeatureTicket /></div>
            </div>
          </div>

          {/* Feature 5: 푸시 알림 */}
          <div className="grid md:grid-cols-2 gap-6 md:gap-10 items-center">
            <div className="text-center">
              <span className="inline-block px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-bold mb-3">스마트 알림</span>
              <h3 className="text-lg md:text-xl font-bold mb-2 text-neutral-900 dark:text-white leading-snug">
                수강권 만료 알림, 출석 알림,
                <br />
                수업영상 등록 알림 발송
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-3 leading-relaxed max-w-md mx-auto">
                만료 임박·출석 확인·영상 업로드 시
                <br />
                수강생에게 푸시로 바로 알림 보낼 수 있습니다.
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {['수강권 만료 알림', '출석 알림', '수업영상 등록 알림'].map((tag) => (
                  <span key={tag} className="text-[10px] px-2 py-1 rounded-full bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 font-medium">{tag}</span>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-3 bg-gradient-to-tr from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-3xl blur-2xl opacity-50" />
              <div className="relative"><FeaturePush /></div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ 도입 시 초기 지원 ═══════ */}
      <section className="py-10 md:py-14 max-w-5xl mx-auto px-4 bg-white dark:bg-transparent">
        <div className="text-center mb-8">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 text-neutral-900 dark:text-white">도입부터 운영까지, 함께합니다</h2>
          <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-300">처음 도입하실 때 필요한 세팅은 모두 직접 도와드립니다.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: Database, title: '데이터 이전', desc: '기존 회원·수강권 데이터 직접 이전' },
            { icon: CalendarDays, title: '수업 세팅', desc: '클래스·스케줄·강사 배정 구성' },
            { icon: Ticket, title: '쿠폰·할인 세팅', desc: '수강권·할인 정책 설정' },
            { icon: Settings, title: '디테일 세팅', desc: '알림, 결제 연동, 학원 소개 등' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50 text-center">
              <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-[#CCFF00]/15 flex items-center justify-center mx-auto mb-3">
                <Icon className="w-6 h-6 text-neutral-800 dark:text-[#CCFF00]" />
              </div>
              <h3 className="font-bold text-sm mb-1">{title}</h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ 학원 규모에 맞는 합리적인 요금제 ═══════ */}
      <section id="pricing" className="py-10 md:py-14 bg-slate-50 dark:bg-neutral-900/40 overflow-y-visible pt-14 md:pt-16">
        <PricingCards />
      </section>

      {/* ═══════ 문의 폼 ═══════ */}
      <section id="contact" className="py-10 md:py-14 bg-neutral-50 dark:bg-transparent">
        <div className="max-w-xl mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 text-neutral-900 dark:text-white">도입 문의</h2>
            <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-300">무료 상담으로 우리 학원에 맞는 세팅을 알아보세요.</p>
          </div>
          <div className="p-5 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 space-y-3 shadow-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">담당자</label>
                <input type="text" placeholder="홍길동" className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-sm outline-none focus:border-neutral-500 dark:focus:border-[#CCFF00]/50" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">연락처</label>
                <input type="tel" placeholder="010-1234-5678" className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-sm outline-none focus:border-neutral-500 dark:focus:border-[#CCFF00]/50" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">학원명</label>
              <input type="text" placeholder="학원명" className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-sm outline-none focus:border-neutral-500 dark:focus:border-[#CCFF00]/50" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">운영 형태</label>
              <select className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-sm outline-none focus:border-neutral-500 dark:focus:border-[#CCFF00]/50">
                <option value="">선택</option>
                <option value="term">기간제</option>
                <option value="coupon">쿠폰제</option>
                <option value="workshop">워크샵</option>
                <option value="mixed">복합</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">문의 내용</label>
              <textarea rows={3} placeholder="궁금한 점을 적어주세요." className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-sm resize-none outline-none focus:border-neutral-500 dark:focus:border-[#CCFF00]/50" />
            </div>
            <button type="submit" className="w-full py-2.5 rounded-xl font-bold bg-neutral-900 dark:bg-[#CCFF00] dark:text-black text-white text-sm">상담 신청하기</button>
          </div>
        </div>
      </section>

      {/* ═══════ Footer ═══════ */}
      <footer className="py-6 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-transparent">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-900 dark:text-white">MoveIt</span>
            <span className="text-xs text-neutral-600 dark:text-neutral-300">댄스학원 운영의 새로운 기준</span>
          </div>
          <div className="flex gap-4 text-xs">
            <a href="#" className="hover:text-neutral-900 dark:hover:text-white">이용약관</a>
            <a href="#" className="hover:text-neutral-900 dark:hover:text-white">개인정보처리방침</a>
          </div>
        </div>
        {year && <p className="text-center text-[11px] text-neutral-400 dark:text-neutral-500 mt-3">&copy; {year} MoveIt</p>}
      </footer>
    </div>
  );
}
