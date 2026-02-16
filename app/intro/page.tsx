'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  PlayCircle, 
  Calendar, 
  Users, 
  CreditCard, 
  Clock, 
  TrendingUp, 
  PauseCircle,
  Bell,
  RefreshCw,
  Check,
  Menu,
  X,
  ChevronRight,
  Smartphone,
  ExternalLink,
  MapPin
} from 'lucide-react';

export default function IntroPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [year, setYear] = useState('');

  useEffect(() => {
    setYear(String(new Date().getFullYear()));
  }, []);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isMobileMenuOpen]);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-sans">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/95 dark:bg-neutral-950/95 backdrop-blur border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-5xl mx-auto px-4 h-14 flex justify-between items-center">
          <div className="flex items-center cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <span className="text-xl font-bold text-neutral-900 dark:text-[#CCFF00]">MoveIt</span>
            <span className="ml-2 text-xs text-neutral-500 hidden sm:inline">댄스학원 운영 관리</span>
          </div>
          <div className="hidden sm:flex items-center gap-6">
            <a href="#preview" className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-[#CCFF00]">제품 미리보기</a>
            <a href="#features" className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-[#CCFF00]">주요기능</a>
            <a href="#pricing" className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-[#CCFF00]">요금제</a>
            <Link href="/intro/demo" className="text-sm font-semibold text-neutral-900 dark:text-[#CCFF00] bg-neutral-100 dark:bg-[#CCFF00]/20 px-3 py-1.5 rounded-lg hover:opacity-90">데모 체험</Link>
            <a href="#contact" className="text-sm font-semibold text-white bg-neutral-900 dark:bg-[#CCFF00] dark:text-black px-3 py-1.5 rounded-lg">도입 문의</a>
          </div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="sm:hidden p-2 rounded-lg text-neutral-600 dark:text-neutral-400" aria-expanded={isMobileMenuOpen}>
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        {isMobileMenuOpen && (
          <div className="sm:hidden fixed inset-0 top-14 z-40 bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 px-4 py-4 space-y-2">
            <a href="#preview" onClick={closeMobileMenu} className="block py-2.5 font-medium">제품 미리보기</a>
            <a href="#features" onClick={closeMobileMenu} className="block py-2.5 font-medium">주요기능</a>
            <a href="#pricing" onClick={closeMobileMenu} className="block py-2.5 font-medium">요금제</a>
            <Link href="/intro/demo" onClick={closeMobileMenu} className="block py-2.5 font-semibold text-neutral-900 dark:text-[#CCFF00]">데모 체험</Link>
            <a href="#contact" onClick={closeMobileMenu} className="block py-3 mt-4 text-center font-bold bg-neutral-900 dark:bg-[#CCFF00] dark:text-black text-white rounded-lg">도입 문의</a>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="py-8 md:py-14 max-w-5xl mx-auto px-4">
        <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-[#CCFF00]/15 text-neutral-700 dark:text-[#CCFF00] text-xs font-medium mb-3">
          현직 댄스학원 운영진이 직접 개발
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-tight mb-3">
          댄스학원 운영, 이제 무빗(MoveIt)으로 확실하게 관리하세요
        </h1>
        <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 mb-5 max-w-xl leading-relaxed">
          헬스장·필라테스 프로그램으로 댄스학원 관리는 어려우셨죠? 정규반, 쿠폰제, 워크샵까지 댄스학원에 필요한 기능만 담았습니다.
        </p>
        <div className="flex gap-3">
          <a href="#contact" className="inline-flex items-center px-5 py-2.5 rounded-lg font-semibold text-sm text-white bg-neutral-900 dark:bg-[#CCFF00] dark:text-black hover:opacity-90">무료 상담 신청</a>
          <Link href="/intro/demo" className="inline-flex items-center px-5 py-2.5 rounded-lg font-semibold text-sm border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-800">
            데모 체험 <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
          </Link>
        </div>
      </section>

      {/* 제품 미리보기 */}
      <section id="preview" className="py-6 md:py-8 bg-neutral-50 dark:bg-neutral-900/50">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-base font-bold mb-3">실제 화면 체험</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/home" className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-[#CCFF00]/50 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-[#CCFF00]/15 flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-5 h-5 text-neutral-700 dark:text-[#CCFF00]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">수강생 앱</p>
                <p className="text-[11px] text-neutral-500 truncate">홈·학원·스케줄</p>
              </div>
            </Link>
            <Link href="/academy" className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-[#CCFF00]/50 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-[#CCFF00]/15 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-neutral-700 dark:text-[#CCFF00]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">학원 목록</p>
                <p className="text-[11px] text-neutral-500 truncate">등록 학원 둘러보기</p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* 운영 형태 - 모바일 가로 스크롤 */}
      <section className="py-6 md:py-8 max-w-5xl mx-auto px-4">
        <h2 className="text-base font-bold mb-1">어떤 형태의 학원이든 지원</h2>
        <p className="text-xs text-neutral-500 mb-3">복잡한 운영 방식도 무빗 하나로 처리합니다.</p>
        <div className="flex md:grid md:grid-cols-3 gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 pb-1">
          {[
            { icon: Calendar, title: '기간제 (정규반)', desc: '월 단위·기수제 운영. 출석 체크, 기간 만료 알림.', color: 'text-neutral-900 dark:text-[#CCFF00]' },
            { icon: CreditCard, title: '쿠폰제 (오픈클래스)', desc: '잔여 횟수 차감, QR 출석, 유효기간 자동 관리.', color: 'text-pink-600 dark:text-pink-400' },
            { icon: Users, title: '워크샵 & 팝업', desc: '원데이 클래스, 입금 확인·확정 문자까지 한 번에.', color: 'text-purple-600 dark:text-purple-400' },
          ].map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="min-w-[200px] flex-shrink-0 md:flex-shrink md:min-w-0 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50">
              <Icon className={`w-7 h-7 mb-2 ${color}`} />
              <h3 className="font-bold text-sm mb-1">{title}</h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 주요 기능 - 모바일 2열 */}
      <section id="features" className="py-6 md:py-8 bg-neutral-50 dark:bg-neutral-900/50">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-base font-bold mb-1">댄스학원에 필요한 디테일</h2>
          <p className="text-xs text-neutral-500 mb-3">운영 부담은 줄이고, 수강생 만족은 올립니다.</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { icon: PauseCircle, title: '일시정지·연장', desc: '클릭 한 번으로 기간 정지·연장' },
              { icon: PlayCircle, title: '영상 공유', desc: '링크 복붙으로 수강생 전원 알림' },
              { icon: RefreshCw, title: '재구매 유도', desc: '만료 전 자동 안내 메시지' },
              { icon: Clock, title: '스케줄 관리', desc: '강사·강의실 배정 시각화' },
              { icon: Bell, title: '스마트 알림', desc: '앱 푸시·카카오 알림톡' },
              { icon: TrendingUp, title: '매출 분석', desc: '인기 수업·매출 추이 확인' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-3 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                <Icon className="w-6 h-6 text-neutral-800 dark:text-[#CCFF00] mb-1.5" />
                <h3 className="font-bold text-[13px] mb-0.5">{title}</h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 비교 - 모바일: 카드형 / 데스크탑: 테이블 */}
      <section id="comparison" className="py-6 md:py-8 bg-neutral-900 dark:bg-neutral-950 text-white">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-base font-bold mb-1">왜 무빗이어야 할까요?</h2>
          <p className="text-xs text-neutral-400 mb-3">헬스/필라테스용 vs 댄스학원 전용 무빗</p>

          {/* 모바일: 항목별 카드 */}
          <div className="md:hidden space-y-2.5">
            {[
              { label: '운영 형태', other: '단순 횟수 차감', moveit: '정규반/쿠폰/워크샵' },
              { label: '영상 공유', other: '지원 안 됨', moveit: '링크 복붙 → 알림' },
              { label: '일시정지', other: '수동 계산', moveit: '자동 계산·적용' },
              { label: '사용성', other: '복잡한 기능 다수', moveit: '필수 기능만 직관적' },
            ].map(({ label, other, moveit }) => (
              <div key={label} className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-2.5">
                <p className="text-[11px] font-semibold text-neutral-400 mb-1.5">{label}</p>
                <div className="flex gap-2">
                  <div className="flex-1 rounded-md bg-neutral-800 p-2">
                    <p className="text-[10px] text-neutral-500 mb-0.5">타사</p>
                    <p className="text-xs text-neutral-300">{other}</p>
                  </div>
                  <div className="flex-1 rounded-md bg-[#CCFF00]/10 border border-[#CCFF00]/30 p-2">
                    <p className="text-[10px] text-[#CCFF00]/70 mb-0.5">무빗</p>
                    <p className="text-xs font-semibold text-[#CCFF00]">{moveit}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 데스크탑: 테이블 */}
          <div className="hidden md:block rounded-xl border border-neutral-700 overflow-hidden">
            <div className="grid grid-cols-3 bg-neutral-800 text-sm font-semibold">
              <div className="p-3">구분</div>
              <div className="p-3">타사 (헬스/필라테스용)</div>
              <div className="p-3 text-[#CCFF00]">무빗</div>
            </div>
            {[
              ['운영 형태', '단순 횟수 차감 위주', '정규반/쿠폰/워크샵 지원'],
              ['수업 영상 공유', '지원 안 됨', '링크 복붙 → 전원 알림'],
              ['일시정지/연장', '수동 계산', '자동 계산·적용'],
              ['사용성', '복잡한 기능 다수', '필수 기능만 직관적'],
            ].map(([label, other, moveit], i) => (
              <div key={i} className="grid grid-cols-3 border-t border-neutral-700 text-sm">
                <div className="p-3 text-neutral-300">{label}</div>
                <div className="p-3 text-neutral-400">{other}</div>
                <div className="p-3 font-medium">{moveit}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 요금제 */}
      <section id="pricing" className="py-6 md:py-8 max-w-5xl mx-auto px-4">
        <h2 className="text-base font-bold mb-1">합리적인 요금제</h2>
        <p className="text-xs text-neutral-500 mb-3">인건비 절감을 생각하면 커피 몇 잔 값입니다.</p>
        
        {/* Best Choice */}
        <div className="p-4 rounded-xl border-2 border-neutral-900 dark:border-[#CCFF00] bg-white dark:bg-neutral-900/50 relative mb-3">
          <span className="absolute -top-2 right-3 text-[10px] font-bold bg-neutral-900 dark:bg-[#CCFF00] text-white dark:text-black px-2 py-0.5 rounded">Best</span>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-sm text-neutral-900 dark:text-[#CCFF00]">프로페셔널</h3>
              <p className="text-xs text-neutral-500 mt-0.5">일반 댄스 학원</p>
            </div>
            <p className="text-xl font-bold">₩79,000<span className="text-xs font-normal text-neutral-500">/월</span></p>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-neutral-900 dark:text-[#CCFF00] flex-shrink-0" />수강생 200명</li>
            <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-neutral-900 dark:text-[#CCFF00] flex-shrink-0" />영상 공유·알림</li>
            <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-neutral-900 dark:text-[#CCFF00] flex-shrink-0" />일시정지·양도</li>
            <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-neutral-900 dark:text-[#CCFF00] flex-shrink-0" />매출 대시보드</li>
          </ul>
          <a href="#contact" className="mt-3 block w-full py-2 text-center text-sm font-semibold rounded-lg bg-neutral-900 dark:bg-[#CCFF00] text-white dark:text-black">시작하기</a>
        </div>

        {/* 스타터 + 엔터프라이즈 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900/50">
            <h3 className="font-bold text-sm">스타터</h3>
            <p className="text-lg font-bold mt-1">₩39,000<span className="text-[10px] font-normal text-neutral-500">/월</span></p>
            <p className="text-[11px] text-neutral-500 mt-0.5">소규모 스튜디오</p>
            <ul className="mt-2 space-y-1 text-[11px]">
              <li className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />50명 이하</li>
              <li className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />일정·출석</li>
            </ul>
            <a href="#contact" className="mt-3 block w-full py-1.5 text-center text-xs font-semibold rounded-lg bg-neutral-100 dark:bg-neutral-800">문의</a>
          </div>
          <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900/50">
            <h3 className="font-bold text-sm">엔터프라이즈</h3>
            <p className="text-lg font-bold mt-1">별도문의</p>
            <p className="text-[11px] text-neutral-500 mt-0.5">다지점·대형</p>
            <ul className="mt-2 space-y-1 text-[11px]">
              <li className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />무제한</li>
              <li className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />전담 매니저</li>
            </ul>
            <a href="#contact" className="mt-3 block w-full py-1.5 text-center text-xs font-semibold rounded-lg bg-neutral-100 dark:bg-neutral-800">상담</a>
          </div>
        </div>
      </section>

      {/* 문의 폼 */}
      <section id="contact" className="py-6 md:py-8 bg-neutral-50 dark:bg-neutral-900/50">
        <div className="max-w-xl mx-auto px-4">
          <h2 className="text-base font-bold mb-3">도입 문의</h2>
          <div className="p-4 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">담당자</label>
                <input type="text" placeholder="홍길동" className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-sm outline-none focus:border-neutral-500 dark:focus:border-[#CCFF00]/50" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">연락처</label>
                <input type="tel" placeholder="010-1234-5678" className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-sm outline-none focus:border-neutral-500 dark:focus:border-[#CCFF00]/50" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">학원명</label>
              <input type="text" placeholder="학원명" className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-sm outline-none focus:border-neutral-500 dark:focus:border-[#CCFF00]/50" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">운영 형태</label>
              <select className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-sm outline-none focus:border-neutral-500 dark:focus:border-[#CCFF00]/50">
                <option value="">선택</option>
                <option value="term">기간제</option>
                <option value="coupon">쿠폰제</option>
                <option value="workshop">워크샵</option>
                <option value="mixed">복합</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">문의 내용</label>
              <textarea rows={3} placeholder="궁금한 점을 적어주세요." className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-sm resize-none outline-none focus:border-neutral-500 dark:focus:border-[#CCFF00]/50" />
            </div>
            <button type="submit" className="w-full py-2.5 rounded-lg font-bold bg-neutral-900 dark:bg-[#CCFF00] dark:text-black text-white text-sm">상담 신청하기</button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 border-t border-neutral-200 dark:border-neutral-800">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-3 text-sm text-neutral-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-900 dark:text-white">MoveIt</span>
            <span className="text-xs">댄스학원 운영의 새로운 기준</span>
          </div>
          <div className="flex gap-4 text-xs">
            <a href="#" className="hover:text-neutral-900 dark:hover:text-white">이용약관</a>
            <a href="#" className="hover:text-neutral-900 dark:hover:text-white">개인정보처리방침</a>
          </div>
        </div>
        {year && <p className="text-center text-[11px] text-neutral-400 mt-3">&copy; {year} MoveIt</p>}
      </footer>
    </div>
  );
}
