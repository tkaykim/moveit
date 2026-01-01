"use client";

import React, { useState, useEffect } from 'react';
import { 
  Home, MapPin, User, Heart, QrCode, Search, Bell, Filter, 
  Map as MapIcon, List, Star, Play, ChevronLeft, Calendar, 
  Clock, CheckCircle, X, MoreHorizontal, ChevronRight, Music, CreditCard, Wallet, Info, Instagram, Youtube
} from 'lucide-react';

// --- [Global Types] ---
type ViewState = 'HOME' | 'ACADEMY' | 'DANCER' | 'SAVED' | 'MY' | 'DETAIL_ACADEMY' | 'DETAIL_CLASS' | 'PAYMENT' | 'PAYMENT_SUCCESS' | 'DETAIL_DANCER';

// --- [Mock Data Repository] ---
const USER = {
  name: "DancingQueen",
  level: "VIP Member",
  tickets: 3,
  savedAcademies: [1, 2],
  savedDancers: [101, 103]
};

const BANNERS = [
  { id: 1, title: "NEW CLASS OPEN", subtitle: "JustJerk Academy 15th Anniv.", color: "from-purple-600 to-blue-600" },
  { id: 2, title: "DANCER OF THE MONTH", subtitle: "Learn Hip-hop with Bada Lee", color: "from-pink-600 to-orange-600" },
  { id: 3, title: "ONLY FOR BEGINNERS", subtitle: "Start your first step with 1M", color: "from-green-600 to-teal-600" },
];

const ACADEMIES = [
  { 
    id: 1, name: "JustJerk Academy", branch: "Hapjeong", 
    tags: ["Hip-hop", "Choreography"], dist: "1.2km", rating: 4.9, 
    price: 35000, badges: ["주차가능", "촬영가능"],
    img: "bg-neutral-800" 
  },
  { 
    id: 2, name: "1MILLION Dance", branch: "Seongsu", 
    tags: ["K-POP", "Jazz"], dist: "3.5km", rating: 4.8, 
    price: 40000, badges: ["탈의실", "라운지"],
    img: "bg-neutral-800" 
  },
  { 
    id: 3, name: "YGX Academy", branch: "Hongdae", 
    tags: ["K-POP", "Street"], dist: "0.8km", rating: 4.7, 
    price: 30000, badges: ["촬영가능"],
    img: "bg-neutral-800" 
  },
];

const DANCERS = [
  { id: 101, name: "BADA LEE", crew: "BEBE", genre: "CHOREO", followers: "2.1M", img: "bg-pink-600" },
  { id: 102, name: "J HO", crew: "JustJerk", genre: "HIPHOP", followers: "890K", img: "bg-blue-600" },
  { id: 103, name: "LIA KIM", crew: "1MILLION", genre: "POPPING", followers: "1.5M", img: "bg-purple-600" },
  { id: 104, name: "REDY", crew: "HolyBang", genre: "GIRLISH", followers: "560K", img: "bg-red-500" },
  { id: 105, name: "VATA", crew: "WeDemBoyz", genre: "CHOREO", followers: "1.2M", img: "bg-green-600" },
  { id: 106, name: "MINJI", crew: "Team A", genre: "K-POP", followers: "120K", img: "bg-yellow-500" },
];

const HISTORY_LOGS = [
  { id: 1, date: "2025.12.28", class: "K-POP Beginner", instructor: "MINJI", studio: "JustJerk", status: "ATTENDED" },
  { id: 2, date: "2025.12.20", class: "Hip-hop Basic", instructor: "J HO", studio: "JustJerk", status: "ATTENDED" },
  { id: 3, date: "2025.12.15", class: "Choreography", instructor: "BADA LEE", studio: "JustJerk", status: "ABSENT" },
];

// Grid Data Structure for Timetable
const TIME_SLOTS = ["18:00", "19:30", "21:00"];
const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

// Dummy data generator for grid
const GRID_SCHEDULE = {
  "MON": [
    { id: 101, instructor: "MINJI", genre: "K-POP", level: "Beginner", status: "AVAILABLE", song: "NewJeans - ETA" },
    { id: 102, instructor: "J HO", genre: "HIPHOP", level: "Master", status: "ALMOST_FULL", song: "Kendrick - DNA" },
    { id: 103, instructor: "BADA", genre: "CHOREO", level: "Master", status: "FULL", song: "Original" }
  ],
  "TUE": [
    { id: 201, instructor: "REDY", genre: "GIRLISH", level: "All Level", status: "AVAILABLE", song: "Beyonce - Heated" },
    { id: 202, instructor: "HOWL", genre: "HIPHOP", level: "Beginner", status: "AVAILABLE", song: "Chris Brown - Iffy" },
    { id: 203, instructor: "ROOT", genre: "KRUMP", level: "Master", status: "AVAILABLE", song: "Heavy Bass" }
  ],
  "WED": [
    { id: 301, instructor: "LI A", genre: "POPPING", level: "Beginner", status: "AVAILABLE", song: "Bruno Mars - 24K" },
    { id: 302, instructor: "YOUNG J", genre: "CHOREO", level: "Master", status: "FULL", song: "JustJerk Anthem" },
    { id: 303, instructor: "-", genre: "-", level: "-", status: "NONE", song: "-" } // No class
  ],
  "THU": [
     { id: 401, instructor: "YELL", genre: "GAMBLER", level: "All Level", status: "AVAILABLE", song: "B-Boy Mix" },
     { id: 402, instructor: "MINJI", genre: "K-POP", level: "Beginner", status: "ALMOST_FULL", song: "IVE - Baddie" },
     { id: 403, instructor: "J HO", genre: "HIPHOP", level: "Master", status: "FULL", song: "Kendrick - Humble" }
  ],
  "FRI": [
     { id: 501, instructor: "BEBE", genre: "K-POP", level: "All Level", status: "AVAILABLE", song: "Smoke" },
     { id: 502, instructor: "BADA", genre: "CHOREO", level: "Master", status: "FULL", song: "Kai - Rover" },
     { id: 503, instructor: "PARTY", genre: "FREESTYLE", level: "All Level", status: "AVAILABLE", song: "DJ Set" }
  ],
  "SAT": [
     { id: 601, instructor: "WORKSHOP", genre: "SPECIAL", level: "Open", status: "AVAILABLE", song: "Special Guest" },
     { id: 602, instructor: "-", genre: "-", level: "-", status: "NONE", song: "-" },
     { id: 603, instructor: "-", genre: "-", level: "-", status: "NONE", song: "-" }
  ],
  "SUN": [
     { id: 701, instructor: "-", genre: "-", level: "-", status: "NONE", song: "-" },
     { id: 702, instructor: "-", genre: "-", level: "-", status: "NONE", song: "-" },
     { id: 703, instructor: "-", genre: "-", level: "-", status: "NONE", song: "-" }
  ]
};

// --- [Components] ---

const LevelBadge = ({ level, simple = false }: { level: string, simple?: boolean }) => {
  let colorClass = "bg-neutral-800 text-neutral-400";
  let dotColor = "bg-neutral-400";
  
  if (level === "Beginner") { colorClass = "bg-green-500/10 text-green-500 border border-green-500/20"; dotColor = "bg-green-500"; }
  if (level === "Master") { colorClass = "bg-red-500/10 text-red-500 border border-red-500/20"; dotColor = "bg-red-500"; }
  if (level === "All Level") { colorClass = "bg-blue-500/10 text-blue-500 border border-blue-500/20"; dotColor = "bg-blue-500"; }
  if (level === "Open") { colorClass = "bg-purple-500/10 text-purple-500 border border-purple-500/20"; dotColor = "bg-purple-500"; }

  if (simple) return <div className={`w-2 h-2 rounded-full ${dotColor}`} />;
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${colorClass}`}>{level}</span>;
};

// --- [Main App] ---

export default function MoveItAppDemo() {
  const [activeTab, setActiveTab] = useState<ViewState>('HOME');
  const [history, setHistory] = useState<ViewState[]>(['HOME']);
  const [selectedAcademy, setSelectedAcademy] = useState<any>(null);
  const [selectedDancer, setSelectedDancer] = useState<any>(null);
  
  // Timetable State
  const [selectedClass, setSelectedClass] = useState<any>(null); // For Payment
  const [previewClass, setPreviewClass] = useState<any>(null); // For Bottom Sheet
  
  const [myTickets, setMyTickets] = useState(USER.tickets);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [dancerFilter, setDancerFilter] = useState('ALL');

  // --- Handlers ---
  const navigateTo = (view: ViewState) => {
    setHistory([...history, view]);
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

  const handleAcademyClick = (academy: any) => {
    setSelectedAcademy(academy);
    navigateTo('DETAIL_ACADEMY');
  };

  const handleDancerClick = (dancer: any) => {
    setSelectedDancer(dancer);
    navigateTo('DETAIL_DANCER');
  };

  const handleClassBooking = (cls: any) => {
    if (cls.status === 'FULL') return alert("이미 마감된 클래스입니다.");
    // Add missing price for payment flow
    const classWithPrice = { ...cls, price: 35000, startTime: TIME_SLOTS[0] }; 
    setSelectedClass(classWithPrice);
    setPreviewClass(null); // Close modal
    navigateTo('PAYMENT');
  };

  const processPayment = () => {
    setTimeout(() => {
      setMyTickets(prev => prev - 1);
      navigateTo('PAYMENT_SUCCESS');
    }, 1500);
  };

  // --- Views ---
  const HomeView = () => (
    <div className="space-y-6 pb-24 animate-in fade-in duration-300">
      <header className="px-5 pt-8 pb-4 sticky top-0 bg-neutral-950/80 backdrop-blur-md z-30">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-black italic tracking-tighter">MOVE<span className="text-[#CCFF00]">.</span>IT</h1>
          <button className="relative"><Bell className="text-neutral-400" /><span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span></button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
          <input type="text" placeholder="장르, 강사, 학원 검색" className="w-full bg-neutral-900 border border-neutral-800 rounded-full py-3 pl-10 pr-4 text-sm text-white focus:border-[#CCFF00] outline-none" />
        </div>
      </header>
      <div className="px-5 overflow-x-auto scrollbar-hide snap-x flex gap-4">
        {BANNERS.map((banner) => (
          <div key={banner.id} className={`flex-shrink-0 w-[85%] h-48 rounded-2xl bg-gradient-to-r ${banner.color} p-6 flex flex-col justify-end snap-center relative`}>
             <span className="absolute top-4 right-4 bg-black/20 text-white px-2 py-1 rounded text-[10px] backdrop-blur">Ad</span>
             <h2 className="text-2xl font-black text-white leading-tight">{banner.title}</h2>
             <p className="text-white/80 text-xs mt-1">{banner.subtitle}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-4 px-5">
        {[{ icon: "🗓️", label: "정규반" }, { icon: "🔥", label: "원데이" }, { icon: "💃", label: "개인레슨" }, { icon: "🏢", label: "대관" }].map((item, idx) => (
          <button key={idx} onClick={() => navigateTo('ACADEMY')} className="flex flex-col items-center gap-2 group">
            <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-2xl group-active:border-[#CCFF00] transition-colors shadow-lg">{item.icon}</div>
            <span className="text-[11px] font-bold text-neutral-400">{item.label}</span>
          </button>
        ))}
      </div>
      <div className="px-5">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold text-white">이번 주 <span className="text-[#A855F7]">HOT</span>한 장르 🔥</h2>
          <span className="text-xs text-neutral-500">전체보기</span>
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide">
          {[1,2,3].map(i => (
             <div key={i} className="w-32 h-44 bg-neutral-800 rounded-xl flex-shrink-0 relative overflow-hidden group">
               <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
               <div className="absolute bottom-3 left-3">
                  <span className="text-[10px] bg-white text-black px-1.5 py-0.5 rounded font-bold">K-POP</span>
                  <div className="text-white font-bold mt-1">NewJeans</div>
               </div>
               <Play className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/80 opacity-50 group-hover:opacity-100" />
             </div>
          ))}
        </div>
      </div>
    </div>
  );

  const AcademyListView = () => (
    <div className="pb-24 pt-14 px-5 animate-in slide-in-from-right-10 duration-300">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white">학원 찾기</h2>
        <div className="flex gap-2">
            <button className="text-xs bg-neutral-800 text-white px-3 py-1.5 rounded-full border border-neutral-700">거리순</button>
            <button className="text-xs bg-neutral-800 text-white px-3 py-1.5 rounded-full border border-neutral-700">필터</button>
        </div>
      </div>
      <div className="space-y-4">
        {ACADEMIES.map(academy => (
             <div key={academy.id} onClick={() => handleAcademyClick(academy)} className="bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-800 active:scale-[0.98] transition-transform">
                <div className="h-32 bg-neutral-800 relative">
                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur px-2 py-1 rounded text-[10px] text-white font-bold">{academy.tags[0]}</div>
                </div>
                <div className="p-4">
                     <div className="flex justify-between items-start">
                        <div>
                           <h3 className="text-lg font-bold text-white">{academy.name}</h3>
                           <p className="text-xs text-neutral-400">{academy.branch} • {academy.dist}</p>
                        </div>
                        <div className="flex items-center gap-1 text-[#CCFF00] text-xs font-bold"><Star size={12} fill="#CCFF00" /> {academy.rating}</div>
                     </div>
                     <div className="mt-4 flex justify-between items-end">
                        <div className="flex gap-1">{academy.badges.map(b => <span key={b} className="text-[9px] text-neutral-500 border border-neutral-700 px-1 rounded">{b}</span>)}</div>
                        <span className="text-sm font-bold text-[#CCFF00]">35,000원~</span>
                     </div>
                </div>
             </div>
        ))}
      </div>
    </div>
  );

  const AcademyDetailView = () => (
    <div className="bg-neutral-950 min-h-screen pb-24 animate-in slide-in-from-right duration-300 relative">
      <div className="relative h-64 bg-neutral-800">
        <button onClick={goBack} className="absolute top-12 left-5 z-20 p-2 bg-black/30 backdrop-blur rounded-full text-white"><ChevronLeft /></button>
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-neutral-950 to-transparent" />
        <div className="absolute bottom-6 left-6">
           <span className="text-[#CCFF00] text-xs font-bold border border-[#CCFF00] px-2 py-0.5 rounded mb-2 inline-block">Premium Partner</span>
           <h1 className="text-3xl font-black text-white italic">{selectedAcademy?.name}</h1>
           <p className="text-neutral-400 text-sm mt-1">{selectedAcademy?.branch} Branch</p>
        </div>
      </div>
      <div className="sticky top-0 bg-neutral-950 z-20 border-b border-neutral-800 flex text-sm font-bold text-neutral-500">
          <button className="flex-1 py-4 border-b-2 border-transparent hover:text-white">홈</button>
          <button className="flex-1 py-4 border-b-2 border-[#CCFF00] text-white">시간표</button>
          <button className="flex-1 py-4 border-b-2 border-transparent hover:text-white">리뷰</button>
      </div>
      <div className="p-5 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
             <h3 className="text-white font-bold text-lg">Weekly Schedule</h3>
             <span className="text-[10px] text-neutral-500 bg-neutral-900 px-2 py-1 rounded">← 좌우로 스크롤하여 확인하세요 →</span>
        </div>
        <div className="overflow-x-auto pb-4 -mx-5 px-5 scrollbar-hide">
            <div className="min-w-[500px]">
                <div className="flex mb-2">
                    <div className="w-14 flex-shrink-0"></div>
                    {DAYS.map(day => (
                        <div key={day} className="flex-1 text-center text-xs font-bold text-neutral-500 py-2">
                            {day}
                        </div>
                    ))}
                </div>
                {TIME_SLOTS.map((time, timeIdx) => (
                    <div key={time} className="flex mb-2">
                        <div className="w-14 flex-shrink-0 flex flex-col items-center justify-center text-[10px] font-bold text-neutral-400 bg-neutral-900/50 rounded-l-lg border-y border-l border-neutral-800">
                            {time}
                        </div>
                        {DAYS.map(day => {
                            // @ts-ignore
                            const classInfo = GRID_SCHEDULE[day]?.[timeIdx];
                            const isEmpty = !classInfo || classInfo.status === 'NONE';
                            const isFull = classInfo?.status === 'FULL';

                            return (
                                <div key={`${day}-${time}`} className="flex-1 p-1">
                                    {isEmpty ? (
                                        <div className="h-full min-h-[80px] bg-neutral-900/30 rounded-lg border border-neutral-800/50"></div>
                                    ) : (
                                        <button 
                                            onClick={() => setPreviewClass({...classInfo, time})}
                                            className={`w-full h-full min-h-[80px] rounded-lg border p-1.5 flex flex-col justify-between text-left transition-all active:scale-95 ${
                                                isFull 
                                                ? 'bg-neutral-900 border-neutral-800 opacity-60' 
                                                : 'bg-neutral-800 border-neutral-700 hover:border-[#CCFF00] hover:bg-neutral-700'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start w-full">
                                                <span className={`text-[9px] font-bold truncate ${isFull ? 'text-neutral-500' : 'text-white'}`}>
                                                    {classInfo.instructor}
                                                </span>
                                                <LevelBadge level={classInfo.level} simple />
                                            </div>
                                            <div className="mt-1">
                                                <div className="text-[8px] text-neutral-500 truncate">{classInfo.genre}</div>
                                                {isFull && <div className="text-[8px] text-red-500 font-bold mt-0.5">FULL</div>}
                                            </div>
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
      </div>
      {previewClass && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setPreviewClass(null)} />
            <div className="relative w-full max-w-[420px] bg-neutral-900 rounded-t-3xl p-6 animate-in slide-in-from-bottom duration-300 border-t border-neutral-800 shadow-2xl">
                <div className="w-12 h-1 bg-neutral-700 rounded-full mx-auto mb-6" />
                <div className="flex gap-4 mb-6">
                    <div className="w-20 h-20 bg-neutral-800 rounded-2xl flex items-center justify-center text-2xl font-black text-neutral-600">
                        {previewClass.instructor[0]}
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-2xl font-black text-white italic">{previewClass.instructor}</h3>
                            <LevelBadge level={previewClass.level} />
                        </div>
                        <p className="text-neutral-400 text-sm font-medium">{previewClass.genre} Class</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-[#CCFF00]">
                            <Clock size={12} />
                            <span>{previewClass.time} ~ 80min</span>
                        </div>
                    </div>
                </div>
                <div className="bg-black/30 rounded-xl p-3 mb-6 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center">
                        <Music size={14} className="text-neutral-400" />
                    </div>
                    <div>
                        <div className="text-[10px] text-neutral-500">Song Info</div>
                        <div className="text-sm font-bold text-white">{previewClass.song}</div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setPreviewClass(null)} className="flex-1 bg-neutral-800 text-white font-bold py-4 rounded-xl">
                        닫기
                    </button>
                    <button 
                        onClick={() => handleClassBooking(previewClass)}
                        disabled={previewClass.status === 'FULL'}
                        className={`flex-[2] font-black py-4 rounded-xl text-lg ${
                            previewClass.status === 'FULL' 
                            ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' 
                            : 'bg-[#CCFF00] text-black shadow-[0_0_20px_rgba(204,255,0,0.3)]'
                        }`}
                    >
                        {previewClass.status === 'FULL' ? '예약 마감' : '예약하기'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );

  const DancerListView = () => {
    const filteredDancers = dancerFilter === 'ALL' ? DANCERS : DANCERS.filter(d => d.genre === dancerFilter);
    return (
      <div className="h-full flex flex-col pb-24 animate-in slide-in-from-right-10 duration-300">
          <div className="px-5 pt-12 pb-4 bg-neutral-950 sticky top-0 z-20">
              <h2 className="text-xl font-bold text-white mb-4">강사 찾기</h2>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                  {['ALL', 'CHOREO', 'HIPHOP', 'K-POP', 'POPPING', 'GIRLISH'].map((g, i) => (
                      <button 
                        key={g} 
                        onClick={() => setDancerFilter(g)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${dancerFilter === g ? 'bg-white text-black' : 'bg-neutral-900 text-neutral-500 border border-neutral-800'}`}
                      >
                          {g}
                      </button>
                  ))}
              </div>
          </div>
          <div className="grid grid-cols-2 gap-3 px-4 overflow-y-auto pb-24">
              {filteredDancers.map(dancer => (
                  <div key={dancer.id} onClick={() => handleDancerClick(dancer)} className="relative aspect-[3/4] rounded-2xl bg-neutral-800 overflow-hidden border border-neutral-800 group active:scale-[0.98] transition-all">
                      <div className={`absolute inset-0 ${dancer.img} opacity-80 group-hover:opacity-100 transition-opacity`} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                      <div className="absolute top-3 right-3 w-8 h-8 bg-black/30 backdrop-blur rounded-full flex items-center justify-center">
                          <Play size={14} fill="white" className="text-white ml-0.5" />
                      </div>
                      <div className="absolute bottom-4 left-4">
                          <span className="text-[10px] text-[#CCFF00] font-bold border border-[#CCFF00]/30 px-1.5 py-0.5 rounded mb-1 inline-block">{dancer.crew}</span>
                          <h3 className="text-lg font-black text-white leading-none">{dancer.name}</h3>
                          <p className="text-xs text-neutral-400 mt-1">{dancer.genre} • {dancer.followers}</p>
                      </div>
                  </div>
              ))}
          </div>
      </div>
    );
  };

  const DancerDetailView = () => (
      <div className="bg-neutral-950 min-h-screen pb-24 animate-in slide-in-from-right duration-300">
          <div className={`relative h-80 ${selectedDancer?.img}`}>
              <button onClick={goBack} className="absolute top-12 left-5 z-20 p-2 bg-black/30 backdrop-blur rounded-full text-white"><ChevronLeft /></button>
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 w-full p-6">
                  <div className="flex gap-2 mb-2">
                      <span className="bg-black/50 text-white backdrop-blur text-[10px] font-bold px-2 py-1 rounded border border-white/20">{selectedDancer?.crew}</span>
                      <span className="bg-[#CCFF00] text-black text-[10px] font-bold px-2 py-1 rounded">{selectedDancer?.genre}</span>
                  </div>
                  <h1 className="text-4xl font-black text-white italic tracking-tighter mb-1">{selectedDancer?.name}</h1>
                  <div className="flex items-center gap-4 text-sm text-neutral-300 font-medium">
                      <span className="flex items-center gap-1"><User size={14}/> {selectedDancer?.followers}</span>
                      <span className="flex items-center gap-1"><Instagram size={14}/> @{selectedDancer?.name.toLowerCase().replace(' ', '')}</span>
                  </div>
              </div>
          </div>
          
          <div className="p-5 space-y-6">
              <div className="flex gap-2">
                  <button className="flex-1 bg-white text-black py-3 rounded-xl font-bold text-sm">Follow</button>
                  <button className="flex-1 bg-neutral-800 text-white py-3 rounded-xl font-bold text-sm border border-neutral-700">Message</button>
              </div>

              <div>
                  <h3 className="text-white font-bold mb-3">개설된 클래스</h3>
                  <div className="space-y-3">
                      {[1, 2].map(i => (
                          <div key={i} className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl flex justify-between items-center">
                              <div className="flex items-center gap-4">
                                  <div className="text-center">
                                      <div className="text-[10px] text-neutral-500">MON</div>
                                      <div className="text-lg font-bold text-white">19:30</div>
                                  </div>
                                  <div>
                                      <div className="text-white font-bold">{selectedDancer?.genre} Master Class</div>
                                      <div className="text-xs text-neutral-500">JustJerk Academy</div>
                                  </div>
                              </div>
                              <button className="bg-[#CCFF00] text-black text-xs font-bold px-4 py-2 rounded-full">신청</button>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      </div>
  );

  const SavedView = () => {
    const [savedTab, setSavedTab] = useState<'ACADEMY' | 'DANCER'>('ACADEMY');
    return (
        <div className="h-full pt-12 px-5 pb-24 animate-in fade-in">
            <h2 className="text-xl font-bold text-white mb-6">찜한 목록</h2>
            <div className="flex bg-neutral-900 p-1 rounded-xl mb-6 border border-neutral-800">
                <button 
                    onClick={() => setSavedTab('ACADEMY')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${savedTab === 'ACADEMY' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500'}`}
                >
                    학원 ({USER.savedAcademies.length})
                </button>
                <button 
                    onClick={() => setSavedTab('DANCER')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${savedTab === 'DANCER' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500'}`}
                >
                    강사 ({USER.savedDancers.length})
                </button>
            </div>

            <div className="space-y-3">
                {savedTab === 'ACADEMY' && ACADEMIES.slice(0, 2).map(item => (
                    <div key={item.id} className="bg-neutral-900 p-3 rounded-2xl flex gap-3 items-center border border-neutral-800">
                        <div className="w-16 h-16 bg-neutral-800 rounded-xl flex-shrink-0" />
                        <div className="flex-1">
                            <h3 className="text-white font-bold text-sm">{item.name}</h3>
                            <p className="text-xs text-neutral-500">{item.branch}</p>
                        </div>
                        <button className="text-[#CCFF00] p-2"><Heart fill="#CCFF00" size={18} /></button>
                    </div>
                ))}
                {savedTab === 'DANCER' && DANCERS.slice(0, 2).map(item => (
                     <div key={item.id} className="bg-neutral-900 p-3 rounded-2xl flex gap-3 items-center border border-neutral-800">
                        <div className={`w-16 h-16 ${item.img} rounded-xl flex-shrink-0`} />
                        <div className="flex-1">
                            <h3 className="text-white font-bold text-sm">{item.name}</h3>
                            <p className="text-xs text-neutral-500">{item.genre} • {item.crew}</p>
                        </div>
                        <button className="text-[#CCFF00] p-2"><Heart fill="#CCFF00" size={18} /></button>
                    </div>
                ))}
            </div>
        </div>
    );
  };

  const PaymentView = () => (
    <div className="bg-neutral-950 min-h-screen pt-12 px-5 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={goBack} className="p-2 -ml-2 text-white"><ChevronLeft /></button>
        <h2 className="text-xl font-bold text-white">결제하기</h2>
      </div>
      <div className="bg-neutral-900 rounded-2xl p-5 border border-neutral-800 mb-6">
        <div className="flex justify-between mb-4 border-b border-neutral-800 pb-4">
           <div>
              <div className="text-xs text-neutral-400 mb-1">{selectedAcademy?.name || "JustJerk Academy"}</div>
              <h3 className="text-xl font-black text-white">{selectedClass?.instructor} <span className="text-sm font-normal text-neutral-400">Class</span></h3>
           </div>
           <div className="text-right">
              <div className="text-xs text-neutral-500">시간</div>
              <div className="text-white font-bold">{selectedClass?.time || "18:00"}</div>
           </div>
        </div>
        <div className="flex justify-between items-center text-sm">
           <span className="text-neutral-400">결제 금액</span>
           <span className="text-xl font-bold text-[#CCFF00]">{selectedClass?.price?.toLocaleString() || "35,000"}원</span>
        </div>
      </div>
      <div className="space-y-3 mb-8">
         <h3 className="text-white font-bold text-sm">결제 수단</h3>
         <button className="w-full bg-neutral-800 border-2 border-[#CCFF00] rounded-xl p-4 flex justify-between items-center relative">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-[#CCFF00]/20 flex items-center justify-center"><Wallet className="text-[#CCFF00]" size={20} /></div>
               <div className="text-left">
                  <div className="text-white font-bold">보유 수강권 사용</div>
                  <div className="text-xs text-neutral-400">잔여: {myTickets}회</div>
               </div>
            </div>
            <div className="w-5 h-5 rounded-full bg-[#CCFF00] flex items-center justify-center"><CheckCircle size={14} className="text-black" /></div>
         </button>
      </div>
      <button onClick={processPayment} className="w-full bg-[#CCFF00] text-black font-black py-4 rounded-xl text-lg shadow-[0_0_20px_rgba(204,255,0,0.3)] active:scale-95 transition-transform">1회권 차감하여 결제하기</button>
    </div>
  );

  const PaymentSuccessView = () => (
    <div className="bg-neutral-950 min-h-screen flex flex-col items-center justify-center p-6 animate-in zoom-in-95 duration-300 text-center">
       <div className="w-24 h-24 rounded-full bg-[#CCFF00] flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(204,255,0,0.4)]"><CheckCircle size={48} className="text-black" /></div>
       <h2 className="text-3xl font-black text-white mb-2">예약 완료!</h2>
       <p className="text-neutral-400 mb-8">수업 시작 10분 전까지 학원에 도착해주세요.</p>
       <div className="bg-neutral-900 w-full rounded-2xl p-6 mb-8 border border-neutral-800">
           <div className="flex justify-between mb-2"><span className="text-neutral-500 text-sm">잔여 수강권</span><span className="text-white font-bold">{myTickets}회</span></div>
           <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden"><div className="h-full bg-[#CCFF00] w-[75%]"></div></div>
       </div>
       <button onClick={() => { setHistory(['HOME']); setActiveTab('MY'); }} className="w-full bg-neutral-800 text-white font-bold py-4 rounded-xl mb-3">예약 내역 확인하기</button>
       <button onClick={() => { setHistory(['HOME']); setActiveTab('HOME'); }} className="text-neutral-500 text-sm underline">홈으로 돌아가기</button>
    </div>
  );

  const MyPageView = () => (
    <div className="pt-12 px-5 pb-24 animate-in fade-in">
        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#CCFF00] to-green-500 p-[2px]">
                    <div className="w-full h-full rounded-full bg-black flex items-center justify-center"><User className="text-white" /></div>
                </div>
                <div><h2 className="text-xl font-bold text-white">{USER.name}</h2><span className="text-xs text-[#A855F7] font-bold border border-[#A855F7] px-2 py-0.5 rounded-full">{USER.level}</span></div>
            </div>
            <Bell className="text-neutral-500" />
        </div>
        <button onClick={() => setIsQrOpen(true)} className="w-full bg-white text-black rounded-3xl p-6 flex items-center justify-between mb-6 shadow-lg active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-4">
                <div className="bg-black text-white p-3 rounded-xl"><QrCode size={32} /></div>
                <div className="text-left"><div className="text-lg font-black">QR CHECK-IN</div><div className="text-xs text-neutral-500 font-bold">입장 시 태그해주세요</div></div>
            </div>
            <ChevronLeft className="rotate-180" />
        </button>
        <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 h-40 flex flex-col justify-between">
                <span className="text-xs font-bold text-neutral-500">내 수강권</span>
                <div className="text-center"><span className="text-3xl font-black text-white">{myTickets}</span><span className="text-xs text-neutral-500"> / 5회</span></div>
                <div className="text-[10px] text-neutral-400 text-center">유효기간 D-24</div>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 h-40 flex flex-col justify-between">
                <span className="text-xs font-bold text-neutral-500">이번 달 출석</span>
                <div className="text-center"><span className="text-3xl font-black text-[#CCFF00]">12</span><span className="text-xs text-neutral-500">회</span></div>
                <button className="bg-neutral-800 py-1.5 rounded text-[10px] text-white">기록 보기</button>
            </div>
        </div>

        <div className="space-y-4">
            <h3 className="text-lg font-bold text-white">최근 수강 기록</h3>
            {HISTORY_LOGS.map((log) => (
                <div key={log.id} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex justify-between items-center">
                    <div>
                        <div className="text-xs text-neutral-500 mb-1">{log.date}</div>
                        <div className="text-white font-bold">{log.class}</div>
                        <div className="text-xs text-neutral-400">{log.studio} • {log.instructor}</div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded ${log.status === 'ATTENDED' ? 'bg-[#CCFF00]/10 text-[#CCFF00]' : 'bg-red-500/10 text-red-500'}`}>
                        {log.status === 'ATTENDED' ? '출석완료' : '결석'}
                    </span>
                </div>
            ))}
        </div>
    </div>
  );

  return (
    <div className="flex justify-center bg-black min-h-screen font-sans selection:bg-[#CCFF00] selection:text-black">
      <div className="w-full max-w-[420px] bg-neutral-950 min-h-screen relative shadow-2xl overflow-hidden flex flex-col border-x border-neutral-900">
        <main className="flex-1 overflow-y-auto scrollbar-hide">
          {activeTab === 'HOME' && <HomeView />}
          {activeTab === 'ACADEMY' && <AcademyListView />}
          {activeTab === 'DETAIL_ACADEMY' && <AcademyDetailView />}
          {activeTab === 'PAYMENT' && <PaymentView />}
          {activeTab === 'PAYMENT_SUCCESS' && <PaymentSuccessView />}
          {activeTab === 'MY' && <MyPageView />}
          {activeTab === 'DANCER' && <DancerListView />}
          {activeTab === 'DETAIL_DANCER' && <DancerDetailView />}
          {activeTab === 'SAVED' && <SavedView />}
        </main>
        {!['PAYMENT', 'PAYMENT_SUCCESS', 'DETAIL_DANCER'].includes(activeTab) && (
          <nav className="absolute bottom-0 w-full bg-neutral-950/90 backdrop-blur-xl border-t border-neutral-800 pb-safe pt-2 px-6 flex justify-between items-center z-40 h-[80px]">
            {[{ id: 'HOME', icon: Home, label: '홈' }, { id: 'ACADEMY', icon: MapPin, label: '학원' }, { id: 'DANCER', icon: User, label: '강사' }, { id: 'SAVED', icon: Heart, label: '찜' }, { id: 'MY', icon: User, label: '마이' }].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id || (tab.id === 'ACADEMY' && activeTab === 'DETAIL_ACADEMY') || (tab.id === 'DANCER' && activeTab === 'DETAIL_DANCER');
              return (
                <button key={tab.id} onClick={() => { setHistory(['HOME']); setActiveTab(tab.id as ViewState); }} className={`flex flex-col items-center gap-1 transition-all duration-300 w-12 ${isActive ? 'text-[#CCFF00] -translate-y-1' : 'text-neutral-500'}`}>
                  <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        )}
        {isQrOpen && (
           <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in" onClick={() => setIsQrOpen(false)}>
              <div className="bg-white rounded-3xl p-8 w-[80%] max-w-[320px] flex flex-col items-center relative" onClick={e => e.stopPropagation()}>
                 <button onClick={() => setIsQrOpen(false)} className="absolute top-4 right-4 text-neutral-400 hover:text-black"><X size={24} /></button>
                 <h3 className="text-xl font-bold text-black mb-1">QR CHECK-IN</h3>
                 <p className="text-xs text-neutral-500 mb-6">입장 시 리더기에 태그해주세요</p>
                 <div className="w-56 h-56 bg-neutral-100 p-4 rounded-2xl mb-4 border border-neutral-200">
                     <div className="w-full h-full border-4 border-black flex items-center justify-center rounded-lg"><QrCode size={140} className="text-black" /></div>
                 </div>
                 <div className="text-sm font-medium text-red-500 animate-pulse font-mono">02:59 남음</div>
              </div>
           </div>
        )}
      </div>
    </div>
  );
}