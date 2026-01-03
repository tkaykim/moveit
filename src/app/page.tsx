"use client";

import React, { useState, useEffect } from 'react';
import { 
  Home, MapPin, User, Calendar, Search, Bell, 
  ChevronLeft, QrCode, Heart, Star, Clock, Music, CheckCircle, X
} from 'lucide-react';
import { Database } from '@/types/database';

// --- Types ---
type ViewState = 'HOME' | 'ACADEMY' | 'INSTRUCTOR' | 'SCHEDULE' | 'MY' | 'DETAIL_ACADEMY' | 'DETAIL_INSTRUCTOR' | 'BOOKING';
type Academy = Database['public']['Tables']['academies']['Row'] & { name_ko?: string; images?: string[]; phone?: string };
type Instructor = Database['public']['Tables']['instructors']['Row'];
type Class = Database['public']['Tables']['classes']['Row'];

export default function MoveItApp() {
  const [activeTab, setActiveTab] = useState<ViewState>('HOME');
  const [history, setHistory] = useState<ViewState[]>(['HOME']);
  
  // Data State
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  
  // Selection State
  const [selectedAcademy, setSelectedAcademy] = useState<Academy | null>(null);
  const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);

  // --- Handlers ---
  const navigateTo = (view: ViewState) => {
    setHistory(prev => [...prev, view]);
    setActiveTab(view);
  };

  const goBack = () => {
    if (history.length > 1) {
      const newHistory = [...history];
      newHistory.pop();
      const prevView = newHistory[newHistory.length - 1];
      setHistory(newHistory);
      setActiveTab(prevView);
    }
  };

  // Mock data loading (Replace with real Supabase calls)
  useEffect(() => {
    // In a real app, you would do:
    // const { data } = await supabase.from('academies').select('*');
    // setAcademies(data);
  }, []);

  // --- Views ---
  
  const HomeView = () => (
    <div className="space-y-6 pb-24 p-5 animate-in fade-in duration-300">
      <header className="pt-4 flex justify-between items-center">
        <h1 className="text-xl font-black italic tracking-tighter text-white">MOVE<span className="text-[#CCFF00]">.</span>IT</h1>
        <div className="flex gap-4">
          <button className="relative"><Bell className="text-neutral-400" size={20} /></button>
          <button className="relative"><Search className="text-neutral-400" size={20} /></button>
        </div>
      </header>
      
      {/* Banner */}
      <div className="w-full h-48 rounded-3xl bg-gradient-to-br from-purple-700 via-blue-600 to-indigo-800 p-8 flex flex-col justify-end relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
        <span className="absolute top-5 right-5 bg-black/30 text-white px-2 py-1 rounded-lg text-[10px] font-bold backdrop-blur-md border border-white/10">PROMO</span>
        <h2 className="text-2xl font-black text-white leading-tight tracking-tight">1MILLION<br/>SUMMER WORKSHOP</h2>
        <p className="text-white/70 text-xs mt-2 font-medium">Early bird tickets available now</p>
      </div>

      {/* Quick Menu */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { icon: "🗓️", label: "정규반" },
          { icon: "🔥", label: "팝업" },
          { icon: "💃", label: "강사" },
          { icon: "🎫", label: "수강권" }
        ].map((item, idx) => (
          <button key={idx} className="flex flex-col items-center gap-2 group">
            <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-2xl shadow-xl group-active:scale-95 group-active:border-[#CCFF00] transition-all">
              {item.icon}
            </div>
            <span className="text-[11px] font-bold text-neutral-500 group-active:text-[#CCFF00]">{item.label}</span>
          </button>
        ))}
      </div>
      
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">추천 <span className="text-[#CCFF00]">HOT</span> 장르 🔥</h2>
          <span className="text-[10px] text-neutral-500 font-bold">전체보기</span>
        </div>
        <div className="flex gap-4 overflow-x-auto scrollbar-hide -mx-5 px-5">
          {['HIPHOP', 'K-POP', 'CHOREO', 'GIRLISH'].map((genre, i) => (
            <div key={i} className="w-36 h-48 bg-neutral-900 rounded-2xl flex-shrink-0 relative overflow-hidden border border-neutral-800 shadow-lg">
               <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
               <div className="absolute bottom-4 left-4">
                  <span className="text-[9px] bg-[#CCFF00] text-black px-2 py-0.5 rounded-full font-black mb-1 inline-block">{genre}</span>
                  <div className="text-white font-bold text-sm">NewJeans - How Sweet</div>
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const AcademyView = () => (
    <div className="pb-24 pt-12 px-5 animate-in slide-in-from-right-10 duration-300">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black text-white italic">ACADEMIES</h2>
        <div className="flex gap-2">
            <button className="text-[10px] bg-neutral-800 text-neutral-300 px-3 py-1.5 rounded-full border border-neutral-700 font-bold">거리순</button>
            <button className="text-[10px] bg-neutral-800 text-neutral-300 px-3 py-1.5 rounded-full border border-neutral-700 font-bold">필터</button>
        </div>
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} onClick={() => { setSelectedAcademy({ id: i.toString(), owner_id: null, business_registration_number: null, name_kr: '원밀리언 댄스 스튜디오', name_en: '1MILLION', tags: null, address: '성수동', contact_number: null, logo_url: '', created_at: '', name_ko: '원밀리언 댄스 스튜디오', phone: '', images: [] }); navigateTo('DETAIL_ACADEMY'); }} className="bg-neutral-900 rounded-3xl overflow-hidden border border-neutral-800 active:scale-[0.98] transition-transform shadow-xl">
            <div className="h-36 bg-neutral-800 relative">
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] text-white font-bold border border-white/10">성수동</div>
            </div>
            <div className="p-5">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-white">1MILLION Dance</h3>
                  <p className="text-xs text-neutral-500 mt-1">서울특별시 성동구 성수이로 33</p>
                </div>
                <div className="flex items-center gap-1 text-[#CCFF00] text-sm font-black"><Star size={14} fill="#CCFF00" /> 4.9</div>
              </div>
              <div className="mt-4 flex gap-2">
                <span className="text-[9px] text-neutral-400 bg-neutral-800 px-2 py-1 rounded-lg border border-neutral-700 font-medium">주차가능</span>
                <span className="text-[9px] text-neutral-400 bg-neutral-800 px-2 py-1 rounded-lg border border-neutral-700 font-medium">샤워실</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const InstructorView = () => (
    <div className="pb-24 pt-12 px-5 animate-in slide-in-from-right-10 duration-300">
      <h2 className="text-2xl font-black text-white italic mb-6">INSTRUCTORS</h2>
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} onClick={() => navigateTo('DETAIL_INSTRUCTOR')} className="relative aspect-[3/4] rounded-3xl bg-neutral-900 overflow-hidden border border-neutral-800 group transition-all active:scale-95 shadow-xl">
            <div className="absolute inset-0 bg-neutral-800" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
            <div className="absolute bottom-5 left-5">
              <span className="text-[9px] text-[#CCFF00] font-black border border-[#CCFF00]/30 px-2 py-0.5 rounded-full mb-2 inline-block">TEAM BEBE</span>
              <h3 className="text-lg font-black text-white leading-none italic tracking-tighter">BADA LEE</h3>
              <p className="text-[10px] text-neutral-500 mt-1 font-bold uppercase tracking-widest">CHOREOGRAPHY</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const MyView = () => (
    <div className="pt-12 px-5 pb-24 animate-in fade-in h-full flex flex-col">
        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#CCFF00] to-green-500 p-[2px] shadow-lg shadow-[#CCFF00]/10">
                    <div className="w-full h-full rounded-3xl bg-black flex items-center justify-center"><User className="text-white" size={28} /></div>
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">DancingQueen</h2>
                    <div className="flex gap-2 mt-1">
                        <span className="text-[9px] text-[#A855F7] font-black border border-[#A855F7]/30 bg-[#A855F7]/10 px-2 py-0.5 rounded-full">VIP Member</span>
                        <span className="text-[9px] text-[#CCFF00] font-black border border-[#CCFF00]/30 bg-[#CCFF00]/10 px-2 py-0.5 rounded-full">LEVEL 42</span>
                    </div>
                </div>
            </div>
            <button className="bg-neutral-900 p-3 rounded-2xl border border-neutral-800 text-neutral-400 hover:text-white transition-colors"><Bell size={20} /></button>
        </div>

        <button className="w-full bg-white text-black rounded-[32px] p-7 flex items-center justify-between mb-8 shadow-2xl shadow-[#CCFF00]/10 active:scale-[0.98] transition-all">
            <div className="flex items-center gap-5">
                <div className="bg-black text-white p-4 rounded-2xl shadow-xl shadow-black/20"><QrCode size={36} strokeWidth={2.5} /></div>
                <div className="text-left">
                    <div className="text-xl font-black italic tracking-tighter">QR CHECK-IN</div>
                    <div className="text-[10px] text-neutral-500 font-bold mt-0.5">입장 시 리더기에 태그해주세요</div>
                </div>
            </div>
            <ChevronLeft className="rotate-180 text-black opacity-30" size={24} />
        </button>

        <div className="grid grid-cols-2 gap-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-[32px] p-6 h-44 flex flex-col justify-between shadow-xl">
                <span className="text-[11px] font-black text-neutral-500 uppercase tracking-widest">수강권</span>
                <div className="text-center">
                    <span className="text-4xl font-black text-white italic">3</span>
                    <span className="text-sm text-neutral-600 font-bold ml-1">/ 10회</span>
                </div>
                <div className="text-[10px] text-neutral-500 text-center font-bold">유효기간 D-24</div>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-[32px] p-6 h-44 flex flex-col justify-between shadow-xl">
                <span className="text-[11px] font-black text-neutral-500 uppercase tracking-widest">출석</span>
                <div className="text-center">
                    <span className="text-4xl font-black text-[#CCFF00] italic">12</span>
                    <span className="text-sm text-neutral-600 font-bold ml-1">회</span>
                </div>
                <button className="bg-neutral-800 py-2 rounded-xl text-[9px] text-white font-black uppercase tracking-widest hover:bg-neutral-700 transition-colors">기록 보기</button>
            </div>
        </div>
    </div>
  );

  const AcademyDetailView = () => (
    <div className="bg-neutral-950 min-h-screen pb-24 animate-in slide-in-from-right duration-300 relative">
      <div className="relative h-72 bg-neutral-800">
        <button onClick={goBack} className="absolute top-12 left-5 z-30 p-2.5 bg-black/40 backdrop-blur-xl rounded-2xl text-white border border-white/10"><ChevronLeft size={20} /></button>
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent" />
        <div className="absolute bottom-8 left-8">
           <span className="text-[#CCFF00] text-[10px] font-black border border-[#CCFF00] px-3 py-1 rounded-full mb-3 inline-block shadow-lg shadow-[#CCFF00]/20">PREMIUM PARTNER</span>
           <h1 className="text-4xl font-black text-white italic tracking-tighter">{selectedAcademy?.name_en || selectedAcademy?.name_ko}</h1>
           <p className="text-neutral-400 text-xs mt-2 font-medium">{selectedAcademy?.address}</p>
        </div>
      </div>
      
      <div className="flex p-5 gap-2 sticky top-0 bg-neutral-950/80 backdrop-blur-xl z-20 border-b border-neutral-900">
          {['HOME', 'SCHEDULE', 'INFO', 'REVIEW'].map((tab) => (
              <button key={tab} className={`flex-1 py-2.5 text-[11px] font-black rounded-xl transition-all ${tab === 'SCHEDULE' ? 'bg-white text-black shadow-lg' : 'text-neutral-500 hover:text-white'}`}>{tab}</button>
          ))}
      </div>

      <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
              <h3 className="text-white font-black text-lg italic tracking-tighter uppercase">Weekly Schedule</h3>
              <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-800"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-800"></span>
              </div>
          </div>
          
          <div className="space-y-4">
              {[1, 2, 3].map(i => (
                  <div key={i} onClick={() => navigateTo('BOOKING')} className="bg-neutral-900 border border-neutral-800 p-6 rounded-[32px] flex justify-between items-center group active:scale-[0.98] transition-all shadow-xl">
                      <div className="flex items-center gap-6">
                          <div className="text-center w-14">
                              <div className="text-[10px] text-neutral-500 font-black mb-1">MON</div>
                              <div className="text-lg font-black text-white italic">19:30</div>
                          </div>
                          <div className="h-10 w-[1px] bg-neutral-800"></div>
                          <div>
                              <div className="text-white font-black text-base italic tracking-tighter group-active:text-[#CCFF00] transition-colors">BADA LEE CLASS</div>
                              <div className="text-[10px] text-neutral-500 font-bold mt-1 uppercase tracking-widest">CHOREOGRAPHY • BEGINNER</div>
                          </div>
                      </div>
                      <button className="bg-neutral-800 p-3 rounded-2xl text-[#CCFF00] group-hover:bg-[#CCFF00] group-hover:text-black transition-all">
                          <ChevronLeft className="rotate-180" size={20} strokeWidth={3} />
                      </button>
                  </div>
              ))}
          </div>
      </div>
    </div>
  );

  const BookingView = () => (
    <div className="bg-neutral-950 min-h-screen p-8 animate-in slide-in-from-bottom duration-500">
      <div className="flex items-center justify-between mb-10">
        <button onClick={goBack} className="p-3 bg-neutral-900 rounded-2xl text-white border border-neutral-800"><X size={20} /></button>
        <h2 className="text-xl font-black text-white italic tracking-tighter">CHECKOUT</h2>
        <div className="w-12"></div>
      </div>

      <div className="bg-neutral-900 rounded-[40px] p-8 border border-neutral-800 mb-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-[#CCFF00]/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
        <div className="flex justify-between items-start mb-8 relative z-10">
           <div>
              <div className="text-[10px] text-neutral-500 font-black mb-2 uppercase tracking-widest">1MILLION Dance</div>
              <h3 className="text-3xl font-black text-white italic tracking-tighter leading-tight">BADA LEE<br/>CLASS</h3>
           </div>
           <div className="bg-neutral-800 p-3 rounded-2xl border border-neutral-700">
              <Music className="text-[#CCFF00]" size={20} />
           </div>
        </div>
        
        <div className="space-y-4 relative z-10">
            <div className="flex justify-between items-center text-sm border-b border-neutral-800 pb-4">
                <span className="text-neutral-500 font-bold">일정</span>
                <span className="text-white font-black italic">MON 19:30</span>
            </div>
            <div className="flex justify-between items-center pt-2">
                <span className="text-neutral-500 font-bold">결제 금액</span>
                <span className="text-2xl font-black text-[#CCFF00] italic">35,000 KRW</span>
            </div>
        </div>
      </div>

      <div className="space-y-4 mb-10">
         <h3 className="text-white font-black text-sm italic tracking-widest uppercase">Payment Method</h3>
         <button className="w-full bg-neutral-900 border-2 border-[#CCFF00] rounded-3xl p-6 flex justify-between items-center shadow-2xl shadow-[#CCFF00]/5 active:scale-95 transition-all">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-2xl bg-[#CCFF00]/10 flex items-center justify-center border border-[#CCFF00]/20"><Star className="text-[#CCFF00]" size={24} fill="#CCFF00" /></div>
               <div className="text-left">
                  <div className="text-white font-black text-sm italic tracking-tighter">MY TICKET</div>
                  <div className="text-[10px] text-neutral-500 font-bold">REMAINING: 3 CLASSES</div>
               </div>
            </div>
            <div className="w-6 h-6 rounded-full bg-[#CCFF00] flex items-center justify-center shadow-lg shadow-[#CCFF00]/20"><CheckCircle size={14} className="text-black" strokeWidth={3} /></div>
         </button>
      </div>

      <button onClick={() => navigateTo('HOME')} className="w-full bg-[#CCFF00] text-black font-black py-6 rounded-[32px] text-xl italic tracking-tighter shadow-2xl shadow-[#CCFF00]/20 active:scale-95 transition-all uppercase">Confirm Booking</button>
    </div>
  );

  return (
    <main className="flex-1 overflow-y-auto scrollbar-hide relative bg-neutral-950">
      <div className="flex-1">
        {activeTab === 'HOME' && <HomeView />}
        {activeTab === 'ACADEMY' && <AcademyView />}
        {activeTab === 'INSTRUCTOR' && <InstructorView />}
        {activeTab === 'MY' && <MyView />}
        {activeTab === 'DETAIL_ACADEMY' && <AcademyDetailView />}
        {activeTab === 'BOOKING' && <BookingView />}
        {/* Placeholder for SCHEDULE, etc */}
        {activeTab === 'SCHEDULE' && <div className="p-10 text-white font-black italic text-2xl animate-pulse">COMING SOON...</div>}
      </div>

      {/* Fixed Bottom Navigation */}
      {!['BOOKING'].includes(activeTab) && (
        <nav className="fixed bottom-0 w-full max-w-[420px] bg-neutral-950/90 backdrop-blur-2xl border-t border-white/5 pb-safe pt-2 px-8 flex justify-between items-center z-40 h-[90px] shadow-2xl">
          {[
            { id: 'HOME', icon: Home, label: '홈' },
            { id: 'ACADEMY', icon: MapPin, label: '학원' },
            { id: 'INSTRUCTOR', icon: User, label: '강사' },
            { id: 'SCHEDULE', icon: Calendar, label: '일정' },
            { id: 'MY', icon: User, label: '마이' }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id || (tab.id === 'ACADEMY' && activeTab === 'DETAIL_ACADEMY');
            return (
              <button 
                key={tab.id} 
                onClick={() => { setHistory(['HOME']); setActiveTab(tab.id as ViewState); }} 
                className={`flex flex-col items-center gap-1.5 transition-all duration-500 w-12 ${isActive ? 'text-[#CCFF00] -translate-y-2' : 'text-neutral-600'}`}
              >
                <div className={`p-1 rounded-xl transition-all duration-500 ${isActive ? 'bg-[#CCFF00]/10 shadow-lg shadow-[#CCFF00]/5' : ''}`}>
                  <Icon size={22} strokeWidth={isActive ? 3 : 2} />
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest transition-all duration-500 ${isActive ? 'opacity-100' : 'opacity-40'}`}>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </main>
  );
}
