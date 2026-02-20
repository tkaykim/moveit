import React, { useState } from 'react';
import { 
  Check, 
  X, 
  Calendar, 
  CreditCard, 
  Bell, 
  Video, 
  QrCode, 
  ArrowRight, 
  Zap, 
  Shield, 
  Users,
  LayoutDashboard,
  Smartphone,
  ChevronDown,
  Menu
} from 'lucide-react';

const App = () => {
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' or 'yearly'
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 가격 정책 데이터
  const pricingPlans = [
    {
      id: 1,
      name: "Starter",
      description: "이제 막 성장하는 소규모 스튜디오를 위한 필수 기능",
      monthlyPrice: 59000,
      yearlyPrice: 47200, // 20% 할인
      features: [
        "수강생 관리 (최대 100명)",
        "기본 캘린더 및 예약 시스템",
        "QR 코드 출석 체크",
        "수강권 만료 D-Day 알림",
        "월간 매출 리포트 (Basic)"
      ],
      isPopular: false,
      buttonVariant: "outline"
    },
    {
      id: 2,
      name: "Pro Growth",
      description: "재수강율을 높이고 운영을 자동화하고 싶은 학원",
      monthlyPrice: 129000,
      yearlyPrice: 103200, // 20% 할인
      features: [
        "수강생 무제한 관리",
        "캘린더 연동 원클릭 결제 시스템",
        "수업 영상 자동 업로드 및 알림",
        "미출석/장기 결석 자동 케어 알림",
        "강사 급여 정산 자동화",
        "전용 모바일 앱 (브랜딩 지원)"
      ],
      isPopular: true,
      buttonVariant: "primary"
    },
    {
      id: 3,
      name: "Enterprise",
      description: "다중 지점 관리와 커스텀 기능이 필요한 프랜차이즈",
      monthlyPrice: 299000,
      yearlyPrice: 239200,
      features: [
        "전 지점 데이터 통합 대시보드",
        "전용 서버 및 API 연동 지원",
        "커스텀 기능 개발 (ERP 연동 등)",
        "전담 매니저 배정",
        "본사-지점간 공지 및 정산 시스템",
        "최고 수준의 보안 서버"
      ],
      isPopular: false,
      buttonVariant: "outline"
    }
  ];

  // 비교표 데이터
  const comparisonData = [
    { feature: "예약 방식", competitor: "단순 시간 선택 (헬스장형)", us: "캘린더형 클래스 선택 + 잔여석 실시간 확인" },
    { feature: "결제 흐름", competitor: "예약 후 별도 창에서 결제 (이탈 발생)", us: "예약과 동시에 인앱 원클릭 결제" },
    { feature: "콘텐츠 관리", competitor: "기능 없음 (카톡/유튜브 별도 공유)", us: "수업 직후 앱 내 영상 업로드 및 알림" },
    { feature: "출석 체크", competitor: "수기 또는 번호 입력", us: "QR 코드 1초 태깅 & 부모님 안심 알림" },
    { feature: "재등록 유도", competitor: "직접 전화/문자 돌리기", us: "수강권 만료 전 자동 푸시 & 할인 쿠폰 발송" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-500 selection:text-white">
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">D</div>
              <span className="font-bold text-xl tracking-tight text-slate-900">DanceFlow</span>
            </div>
            
            <nav className="hidden md:flex gap-8">
              <a href="#features" className="text-slate-600 hover:text-indigo-600 font-medium transition-colors">주요기능</a>
              <a href="#comparison" className="text-slate-600 hover:text-indigo-600 font-medium transition-colors">비교하기</a>
              <a href="#pricing" className="text-slate-600 hover:text-indigo-600 font-medium transition-colors">요금안내</a>
            </nav>

            <div className="hidden md:flex items-center gap-4">
              <button className="text-slate-600 hover:text-slate-900 font-medium">로그인</button>
              <button className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg font-semibold transition-all shadow-lg shadow-slate-900/20">
                무료로 시작하기
              </button>
            </div>

            <button className="md:hidden p-2 text-slate-600" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              <Menu size={24} />
            </button>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-200 p-4 space-y-4 shadow-lg">
            <a href="#features" className="block text-slate-600 font-medium">주요기능</a>
            <a href="#comparison" className="block text-slate-600 font-medium">비교하기</a>
            <a href="#pricing" className="block text-slate-600 font-medium">요금안내</a>
            <div className="pt-4 border-t border-slate-100 flex flex-col gap-3">
              <button className="w-full text-center py-2 font-medium">로그인</button>
              <button className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium">무료로 시작하기</button>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-200/30 rounded-full blur-3xl -z-10" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm font-semibold mb-6 animate-fade-in-up">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            댄스 학원 운영의 새로운 표준 v2.0 업데이트
          </div>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900 mb-6 leading-tight">
            춤추는 것 빼고는<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">모두 자동화하세요</span>
          </h1>
          
          <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            아직도 헬스장용 프로그램을 쓰시나요? <br className="hidden md:block"/>
            수강 신청부터 결제, 영상 공유, 재등록 알림까지. 
            <span className="font-bold text-slate-900"> 댄스 아카데미에 특화된 올인원 솔루션</span>을 만나보세요.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2">
              지금 무료로 체험하기 <ArrowRight size={20} />
            </button>
            <button className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-8 py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2">
              <Video size={20} /> 도입 사례 보기
            </button>
          </div>

          {/* Hero Image / UI Mockup placeholder */}
          <div className="relative mx-auto max-w-5xl">
            <div className="rounded-2xl bg-slate-900 p-2 shadow-2xl ring-1 ring-slate-900/10">
              <div className="rounded-xl bg-slate-800 overflow-hidden aspect-[16/9] flex items-center justify-center relative">
                 {/* Abstract UI representation */}
                 <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col md:flex-row">
                    {/* Left Panel: Calendar */}
                    <div className="w-full md:w-1/3 border-r border-slate-700 p-6 hidden md:block">
                        <div className="h-4 w-24 bg-slate-700 rounded mb-6"></div>
                        <div className="space-y-3">
                            {[1,2,3,4].map(i => (
                                <div key={i} className="flex gap-3 items-center">
                                    <div className="w-8 h-8 rounded bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">{i*13}</div>
                                    <div className="flex-1 h-2 bg-slate-700 rounded"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Right Panel: Class & Pay */}
                    <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/50">
                            <Zap className="text-white w-8 h-8" />
                        </div>
                        <h3 className="text-white text-xl font-bold mb-2">원스톱 결제 완료</h3>
                        <p className="text-slate-400 text-sm mb-6">수강생이 캘린더에서 수업을 선택하면<br/>즉시 결제창으로 이어집니다.</p>
                        <div className="flex gap-2">
                             <div className="h-8 w-24 bg-green-500 rounded-lg flex items-center justify-center text-xs font-bold text-white">결제 성공</div>
                             <div className="h-8 w-24 bg-slate-700 rounded-lg flex items-center justify-center text-xs text-slate-300">알림 발송</div>
                        </div>
                    </div>
                 </div>
              </div>
            </div>
            {/* Floating Badges */}
            <div className="absolute -left-4 top-1/2 bg-white p-4 rounded-xl shadow-xl border border-slate-100 flex items-center gap-3 animate-bounce-slow hidden lg:flex">
                <div className="bg-green-100 p-2 rounded-lg text-green-600"><CreditCard size={20}/></div>
                <div>
                    <div className="text-xs text-slate-500">실시간 매출</div>
                    <div className="font-bold text-slate-900">+ 1,250,000원</div>
                </div>
            </div>
            <div className="absolute -right-4 bottom-10 bg-white p-4 rounded-xl shadow-xl border border-slate-100 flex items-center gap-3 animate-bounce-slow delay-150 hidden lg:flex">
                <div className="bg-pink-100 p-2 rounded-lg text-pink-600"><Video size={20}/></div>
                <div>
                    <div className="text-xs text-slate-500">수업 영상 업로드</div>
                    <div className="font-bold text-slate-900">K-Pop 초급반.mp4</div>
                </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section id="comparison" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">왜 댄스 학원은 <br className="md:hidden"/>전용 플랫폼을 써야 할까요?</h2>
            <p className="text-slate-600">헬스장, 필라테스용 프로그램으로는 해결할 수 없는 댄스 학원만의 니즈를 담았습니다.</p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
            <div className="grid grid-cols-3 bg-slate-50 border-b border-slate-200">
              <div className="p-6 text-center font-bold text-slate-500">구분</div>
              <div className="p-6 text-center font-bold text-slate-500 border-l border-slate-200">기존 피트니스 플랫폼</div>
              <div className="p-6 text-center font-bold text-indigo-600 bg-indigo-50/50 border-l border-indigo-100">DanceFlow</div>
            </div>
            
            {comparisonData.map((row, idx) => (
              <div key={idx} className="grid grid-cols-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                <div className="p-6 flex items-center justify-center font-semibold text-slate-700 bg-slate-50/50">
                  {row.feature}
                </div>
                <div className="p-6 flex items-center justify-center text-slate-500 border-l border-slate-200 text-center text-sm md:text-base">
                    {row.competitor}
                </div>
                <div className="p-6 flex items-center justify-center text-indigo-700 font-medium bg-indigo-50/10 border-l border-indigo-100 text-center text-sm md:text-base">
                   {idx === 1 ? <span className="flex items-center gap-2"><Zap size={16} className="fill-indigo-600"/> {row.us}</span> : row.us}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Features Grid */}
      <section id="features" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">학원 운영의 A to Z를 <br className="md:hidden"/>자동화했습니다</h2>
            <p className="text-slate-600">반복되는 업무는 시스템에 맡기고, 원장님은 수업 퀄리티에만 집중하세요.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 mb-6">
                <Calendar size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">예약과 결제를 한번에</h3>
              <p className="text-slate-600 leading-relaxed">
                캘린더에서 수업을 누르면 바로 결제창이 뜹니다. 복잡한 단계 없이 수강생의 구매 전환율을 극대화합니다.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center text-pink-600 mb-6">
                <Video size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">수업 영상 자동 공유</h3>
              <p className="text-slate-600 leading-relaxed">
                촬영한 영상을 업로드하면 해당 수업 수강생에게만 자동으로 알림이 갑니다. 카톡방 관리가 필요 없습니다.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-6">
                <QrCode size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">QR 스마트 체크인</h3>
              <p className="text-slate-600 leading-relaxed">
                앱 내 QR코드로 1초 만에 출석. 학부모님께 등/하원 알림이 자동 전송되어 신뢰도를 높입니다.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 mb-6">
                <Bell size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">재구매 유도 알림</h3>
              <p className="text-slate-600 leading-relaxed">
                수강권 만료 7일 전, 3일 전, 당일에 맞춰 재등록 할인 쿠폰과 알림을 자동으로 발송합니다.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600 mb-6">
                <LayoutDashboard size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">한눈에 보는 매출</h3>
              <p className="text-slate-600 leading-relaxed">
                일별, 월별 매출은 물론 강사별 정산 금액까지 자동으로 계산되어 대시보드에 시각화됩니다.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 mb-6">
                <Smartphone size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">전용 브랜드 앱</h3>
              <p className="text-slate-600 leading-relaxed">
                DanceFlow 이름이 아닌, '우리 학원' 이름과 로고가 박힌 전용 앱을 수강생에게 제공하세요. (Pro 이상)
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">학원 규모에 맞는 합리적인 요금제</h2>
            <p className="text-slate-600 mb-8">숨겨진 비용 없이, 필요한 기능만큼만 결제하세요.</p>
            
            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4">
              <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-slate-900' : 'text-slate-500'}`}>월간 결제</span>
              <button 
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                className="relative w-16 h-8 bg-slate-200 rounded-full p-1 transition-colors duration-300 focus:outline-none"
              >
                <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${billingCycle === 'yearly' ? 'translate-x-8' : ''}`} />
              </button>
              <span className={`text-sm font-medium ${billingCycle === 'yearly' ? 'text-slate-900' : 'text-slate-500'}`}>
                연간 결제 <span className="text-indigo-600 text-xs font-bold bg-indigo-50 px-2 py-0.5 rounded-full ml-1">20% 할인</span>
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 items-start">
            {pricingPlans.map((plan) => (
              <div 
                key={plan.id} 
                className={`relative rounded-2xl p-8 transition-all duration-300 ${
                  plan.isPopular 
                    ? 'bg-slate-900 text-white shadow-2xl scale-105 border-0 z-10' 
                    : 'bg-white text-slate-900 border border-slate-200 hover:border-indigo-200 hover:shadow-xl'
                }`}
              >
                {plan.isPopular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-bold px-4 py-1 rounded-full shadow-lg">
                    MOST POPULAR
                  </div>
                )}
                
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <p className={`text-sm mb-6 min-h-[40px] ${plan.isPopular ? 'text-slate-300' : 'text-slate-500'}`}>
                  {plan.description}
                </p>
                
                <div className="mb-8">
                  <span className="text-4xl font-bold">
                    {(billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice).toLocaleString()}
                  </span>
                  <span className={`text-sm ${plan.isPopular ? 'text-slate-400' : 'text-slate-500'}`}>원 / 월</span>
                  {billingCycle === 'yearly' && (
                    <div className="text-sm text-indigo-400 mt-1 font-medium">
                      연간 {(plan.yearlyPrice * 12).toLocaleString()}원 청구
                    </div>
                  )}
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm">
                      <Check size={18} className={`shrink-0 ${plan.isPopular ? 'text-indigo-400' : 'text-indigo-600'}`} />
                      <span className={plan.isPopular ? 'text-slate-300' : 'text-slate-600'}>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button className={`w-full py-4 rounded-xl font-bold transition-all ${
                  plan.buttonVariant === 'primary'
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/50'
                    : plan.isPopular 
                        ? 'bg-white text-slate-900 hover:bg-slate-100'
                        : 'bg-slate-50 text-slate-900 hover:bg-slate-100 border border-slate-200'
                }`}>
                  {plan.name} 시작하기
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-slate-900 relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-indigo-900/20 to-transparent" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl" />

        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            지금 바로 학원 운영을 <br/>
            <span className="text-indigo-400">자동화</span> 해보세요
          </h2>
          <p className="text-lg text-slate-300 mb-10">
            가입비 0원, 설치비 0원. <br/>
            14일 무료 체험으로 우리 학원에 딱 맞는 기능을 확인하실 수 있습니다.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button className="bg-white text-slate-900 px-8 py-4 rounded-xl font-bold text-lg hover:bg-slate-100 transition-colors shadow-lg">
              무료로 시작하기
            </button>
            <button className="border border-slate-700 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-colors">
              도입 문의하기
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-12 border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 bg-slate-800 rounded flex items-center justify-center text-white font-bold text-xs">D</div>
                <span className="font-bold text-lg text-white">DanceFlow</span>
              </div>
              <p className="text-sm leading-relaxed max-w-xs">
                DanceFlow는 댄스 아카데미 운영자를 위한 올인원 SaaS 솔루션입니다. 
                복잡한 운영은 저희에게 맡기고 교육에만 집중하세요.
              </p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">주요 기능</a></li>
                <li><a href="#" className="hover:text-white transition-colors">요금 안내</a></li>
                <li><a href="#" className="hover:text-white transition-colors">업데이트 노트</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API 문서</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">회사 소개</a></li>
                <li><a href="#" className="hover:text-white transition-colors">채용 정보</a></li>
                <li><a href="#" className="hover:text-white transition-colors">이용 약관</a></li>
                <li><a href="#" className="hover:text-white transition-colors">개인정보처리방침</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-900 text-sm flex flex-col md:flex-row justify-between items-center gap-4">
            <p>© 2024 DanceFlow. All rights reserved.</p>
            <div className="flex gap-4">
               {/* SNS Icons Placeholder */}
               <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center hover:bg-slate-800 cursor-pointer">IG</div>
               <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center hover:bg-slate-800 cursor-pointer">YT</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;