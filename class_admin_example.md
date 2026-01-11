import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, 
  query, where, onSnapshot, serverTimestamp, writeBatch
} from 'firebase/firestore';
import { 
  Calendar, Users, Clock, CheckCircle, ChevronLeft, ChevronRight, 
  Repeat, Zap, Trash2, User, Ticket, Lock, ShieldAlert, Star
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Types & Mock Data (실제 DB에서는 products 컬렉션에서 관리) ---
// 그룹 ID는 특정 수업군을 묶어주는 태그 역할을 합니다.
const TICKET_PRODUCTS = [
  { id: 'prod_coupon', name: '일반 1회용 쿠폰', type: 'count', group: 'general' },
  { id: 'prod_kpop_basic', name: 'KPOP 기초반 전용권', type: 'period', group: 'group_kpop_basic' },
  { id: 'prod_kpop_adv', name: 'KPOP 심화반 전용권', type: 'period', group: 'group_kpop_adv' },
  { id: 'prod_entrance', name: '입시반 멤버십', type: 'period', group: 'group_entrance' },
];

// --- Helper Functions ---
const generateSessionDates = (startDate, endDate, daysOfWeek, intervalWeeks = 1) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dates = [];
  const current = new Date(start);
  
  // Week calculation logic simplified for demo
  while (current <= end) {
    const diffTime = Math.abs(current - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    const weekNumber = Math.floor(diffDays / 7);

    if (weekNumber % intervalWeeks === 0) {
      if (daysOfWeek.includes(current.getDay())) {
        dates.push(new Date(current));
      }
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

const formatDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const getWeekDates = (baseDate) => {
  const current = new Date(baseDate);
  const day = current.getDay(); 
  const diff = current.getDate() - day + (day === 0 ? -6 : 1); 
  const monday = new Date(current.setDate(diff));
  
  const week = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    week.push(d);
  }
  return week;
};

// --- Components ---

// 1. Admin Panel
const AdminPanel = ({ user }) => {
  const [activeTab, setActiveTab] = useState('create');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [courseName, setCourseName] = useState('');
  const [instructor, setInstructor] = useState('');
  const [type, setType] = useState('regular'); 
  const [startTime, setStartTime] = useState('18:20');
  const [duration, setDuration] = useState(80);
  const [recurrenceDays, setRecurrenceDays] = useState([]); 
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  
  // 🔥 New Access Control State
  const [targetGroup, setTargetGroup] = useState(''); // 'group_kpop_basic' etc.
  const [allowCoupon, setAllowCoupon] = useState(true); // Can generic coupon be used?

  const [periodStart, setPeriodStart] = useState(formatDate(new Date()));
  const [periodEnd, setPeriodEnd] = useState(formatDate(new Date(new Date().setMonth(new Date().getMonth() + 1))));
  const [popupDate, setPopupDate] = useState(formatDate(new Date()));

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'sessions'));
    const unsub = onSnapshot(q, (snapshot) => {
      setSessions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  const toggleDay = (dayIndex) => {
    setRecurrenceDays(prev => prev.includes(dayIndex) ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex]);
  };

  const handleCreateCourse = async () => {
    if (!courseName || !instructor) return alert('필수 정보를 입력해주세요.');
    if (type === 'regular' && recurrenceDays.length === 0) return alert('요일을 선택해주세요.');

    setLoading(true);

    try {
      // Create Master (Skipped for brevity, focusing on Sessions)
      const batch = writeBatch(db);
      let targetDates = [];

      if (type === 'regular') {
        targetDates = generateSessionDates(periodStart, periodEnd, recurrenceDays, recurrenceInterval);
      } else {
        targetDates = [new Date(popupDate)];
      }

      targetDates.forEach(date => {
        const sessionRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'sessions'));
        batch.set(sessionRef, {
          name: courseName,
          instructor,
          date: formatDate(date),
          startTime,
          duration,
          type,
          capacity: 20,
          enrolled: 0,
          
          // 🔥 Access Config Saved in Session
          accessConfig: {
            requiredGroup: targetGroup || null, // If null, maybe open to all? Let's say null means no specific group required (only coupon)
            allowStandardCoupon: allowCoupon
          },
          
          createdAt: serverTimestamp()
        });
      });

      await batch.commit();
      alert(`스케줄 생성 완료! (${targetDates.length}건)`);
      setCourseName('');
      setRecurrenceDays([]);
    } catch (e) {
      console.error(e);
      alert('오류 발생');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if(!confirm('삭제하시겠습니까?')) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', sessionId));
  }

  const days = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <div className="flex space-x-4 mb-6 border-b">
        <button onClick={() => setActiveTab('create')} className={`pb-2 px-1 ${activeTab === 'create' ? 'border-b-2 border-slate-900 font-bold' : 'text-slate-500'}`}>수업 등록</button>
        <button onClick={() => setActiveTab('manage')} className={`pb-2 px-1 ${activeTab === 'manage' ? 'border-b-2 border-slate-900 font-bold' : 'text-slate-500'}`}>스케줄 관리</button>
      </div>

      {activeTab === 'create' && (
        <div className="space-y-6 max-w-xl">
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setType('regular')} className={`p-4 rounded-lg border flex flex-col items-center gap-2 ${type === 'regular' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-slate-50 border-slate-200'}`}>
              <Repeat className="w-6 h-6" /> <span className="font-semibold">정규 반복 수업</span>
            </button>
            <button onClick={() => setType('popup')} className={`p-4 rounded-lg border flex flex-col items-center gap-2 ${type === 'popup' ? 'bg-amber-50 border-amber-500 text-amber-700' : 'bg-slate-50 border-slate-200'}`}>
              <Zap className="w-6 h-6" /> <span className="font-semibold">팝업/특강</span>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">클래스 이름</label>
              <input value={courseName} onChange={(e) => setCourseName(e.target.value)} className="w-full border rounded-lg p-2" placeholder="예: KPOP 기초반" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">담당 강사</label>
              <input value={instructor} onChange={(e) => setInstructor(e.target.value)} className="w-full border rounded-lg p-2" placeholder="예: WOOTAE" />
            </div>
            
            {/* 🔥 Access Control Settings */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
                <h4 className="text-sm font-bold flex items-center gap-2"><Lock className="w-4 h-4"/> 수강 권한 설정 (Access Control)</h4>
                
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">1. 전용 수강권 그룹 지정 (우선 적용)</label>
                    <select 
                        value={targetGroup} 
                        onChange={(e) => setTargetGroup(e.target.value)}
                        className="w-full border rounded p-2 text-sm"
                    >
                        <option value="">(지정 안 함)</option>
                        {TICKET_PRODUCTS.filter(p => p.group !== 'general').map(p => (
                            <option key={p.group} value={p.group}>{p.name} 그룹 ({p.group})</option>
                        ))}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">이 그룹의 수강권이 있는 회원은 쿠폰 차감 없이 수강 가능합니다.</p>
                </div>

                <div className="flex items-center gap-2">
                    <input 
                        type="checkbox" 
                        id="allowCoupon"
                        checked={allowCoupon}
                        onChange={(e) => setAllowCoupon(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="allowCoupon" className="text-sm font-medium text-slate-700 cursor-pointer">
                        2. 일반 1회용 쿠폰 사용 허용
                    </label>
                </div>
                {!allowCoupon && <p className="text-[10px] text-red-500 font-bold">※ 입시반 등 특수 수업은 반드시 체크 해제하세요.</p>}
            </div>

            {type === 'regular' ? (
              <div className="bg-indigo-50/50 p-4 rounded-lg border border-indigo-100">
                <label className="block text-sm font-medium text-slate-700 mb-2">반복 설정</label>
                <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm">매</span>
                    <select value={recurrenceInterval} onChange={(e) => setRecurrenceInterval(Number(e.target.value))} className="border rounded p-1 text-sm bg-white">
                        {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <span className="text-sm">주 간격 반복</span>
                </div>
                <div className="flex gap-2 mb-2">
                    {days.map((d, i) => (
                    <button key={i} onClick={() => toggleDay(i)} className={`w-8 h-8 rounded-full text-xs font-bold ${recurrenceDays.includes(i) ? 'bg-indigo-600 text-white' : 'bg-white border text-slate-400'}`}>{d}</button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="w-1/2 border rounded p-1 text-xs" />
                    <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="w-1/2 border rounded p-1 text-xs" />
                </div>
              </div>
            ) : (
                <input type="date" value={popupDate} onChange={(e) => setPopupDate(e.target.value)} className="w-full border rounded-lg p-2" />
            )}
          </div>

          <button onClick={handleCreateCourse} disabled={loading} className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800 disabled:opacity-50">
            {loading ? '생성 중...' : '스케줄 생성하기'}
          </button>
        </div>
      )}

      {activeTab === 'manage' && (
        <div className="space-y-2">
            {sessions.slice(0, 5).map(s => (
                <div key={s.id} className="flex justify-between border p-2 rounded text-sm">
                    <div>
                        <div className="font-bold">{s.name}</div>
                        <div className="text-xs text-slate-500">
                            {s.accessConfig?.requiredGroup ? `🔒 ${s.accessConfig.requiredGroup} 전용` : '🔓 그룹제한 없음'} 
                            {s.accessConfig?.allowStandardCoupon ? ' | 🎫 쿠폰가능' : ' | ❌ 쿠폰불가'}
                        </div>
                    </div>
                    <button onClick={() => handleDeleteSession(s.id)}><Trash2 className="w-4 h-4 text-red-500"/></button>
                </div>
            ))}
        </div>
      )}
    </div>
  );
};

// 2. User Components
const UserWallet = ({ userTickets, onToggleTicket }) => {
    // Group tickets by ID for count display
    const couponCount = userTickets.filter(t => t.id === 'prod_coupon').length;
    
    return (
        <div className="bg-white border rounded-xl p-4 mb-6 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Ticket className="w-4 h-4 text-indigo-600" /> 내 지갑 (보유 수강권 시뮬레이션)
            </h3>
            <div className="flex flex-wrap gap-2">
                {/* 1. General Coupon (Count based) */}
                <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-lg border border-slate-200">
                    <span className="text-sm font-bold text-slate-700">🎟 일반 쿠폰</span>
                    <div className="flex items-center gap-1 bg-white px-2 rounded border">
                        <button onClick={() => onToggleTicket('prod_coupon', 'remove')} className="text-slate-400 hover:text-red-500">-</button>
                        <span className="text-sm font-mono w-4 text-center">{couponCount}</span>
                        <button onClick={() => onToggleTicket('prod_coupon', 'add')} className="text-slate-400 hover:text-green-500">+</button>
                    </div>
                </div>

                {/* 2. Memberships (Period based - Toggle) */}
                {TICKET_PRODUCTS.filter(p => p.group !== 'general').map(p => {
                    const hasIt = userTickets.some(t => t.id === p.id);
                    return (
                        <button 
                            key={p.id}
                            onClick={() => onToggleTicket(p.id, hasIt ? 'remove' : 'add')}
                            className={`p-2 rounded-lg text-sm font-bold border transition-all ${
                                hasIt ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : 'bg-white text-slate-400 border-slate-200 dashed'
                            }`}
                        >
                            {hasIt ? '✅' : '⬜'} {p.name}
                        </button>
                    )
                })}
            </div>
            <p className="text-[10px] text-slate-400 mt-2 text-right">* 버튼을 눌러 내 수강권 상태를 변경해보세요.</p>
        </div>
    );
};

const Timetable = ({ user }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [bookings, setBookings] = useState([]);
  
  // Wallet State: Array of objects { id: 'prod_xxx', type: 'count'|'period' }
  const [userTickets, setUserTickets] = useState([
      { id: 'prod_coupon', uniqueId: 'c1', type: 'count' }, 
      { id: 'prod_coupon', uniqueId: 'c2', type: 'count' },
      { id: 'prod_coupon', uniqueId: 'c3', type: 'count' }
  ]); 
  
  const [isBooking, setIsBooking] = useState(false);

  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);
  const weekStartStr = formatDate(weekDates[0]);
  const weekEndStr = formatDate(weekDates[6]);

  useEffect(() => {
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'sessions'), where('date', '>=', weekStartStr), where('date', '<=', weekEndStr));
    const unsub = onSnapshot(q, (s) => setSessions(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [weekStartStr, weekEndStr]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'bookings'));
    const unsub = onSnapshot(q, (s) => setBookings(s.docs.map(d => d.data().sessionId)));
    return () => unsub();
  }, [user]);

  // Wallet Simulator Logic
  const handleToggleTicket = (prodId, action) => {
      if (action === 'add') {
          const prod = TICKET_PRODUCTS.find(p => p.id === prodId);
          setUserTickets(prev => [...prev, { id: prodId, uniqueId: Date.now(), type: prod.type }]);
      } else {
          setUserTickets(prev => {
              const idx = prev.findIndex(t => t.id === prodId);
              if (idx === -1) return prev;
              const newArr = [...prev];
              newArr.splice(idx, 1); // remove one instance
              return newArr;
          });
      }
  };

  // 🔥 CORE LOGIC: Check Access & Determine Payment Method
  const checkAccessStatus = (session) => {
      const config = session.accessConfig || { requiredGroup: null, allowStandardCoupon: true };
      
      // 1. Check for Specific Membership (Priority 1)
      if (config.requiredGroup) {
          const hasSpecificMembership = userTickets.some(t => {
              const product = TICKET_PRODUCTS.find(p => p.id === t.id);
              return product && product.group === config.requiredGroup;
          });
          if (hasSpecificMembership) return { status: 'allowed', method: 'membership', detail: `${config.requiredGroup} 전용권 사용` };
      } else {
          // If no specific group is required, but user HAS a relevant group ticket anyway? 
          // (Scenario: Class allows coupon, but I have a monthly pass for this genre)
          // For simplicity, we assume classes are tagged with groups.
      }

      // 2. Check for Standard Coupon (Priority 2)
      if (config.allowStandardCoupon) {
          const couponCount = userTickets.filter(t => t.id === 'prod_coupon').length;
          if (couponCount > 0) return { status: 'allowed', method: 'coupon', detail: `일반 쿠폰 차감 (남은 수량: ${couponCount})` };
          if (couponCount === 0) return { status: 'denied', reason: 'no_coupon', detail: '보유한 쿠폰이 없습니다.' };
      }

      // 3. Denied
      return { status: 'denied', reason: 'restricted', detail: '이 수업을 들을 수 있는 수강권이 없습니다.' };
  };

  const handleApply = async () => {
    if (!user) return alert('로그인 필요');
    if (!selectedSession) return;

    const access = checkAccessStatus(selectedSession);

    if (access.status === 'denied') {
        alert(`❌ 신청 불가: ${access.detail}`);
        return;
    }

    if (!confirm(`수강신청 하시겠습니까?\n\n[결제 방식]\n${access.detail}`)) return;

    setIsBooking(true);
    try {
        // DB Updates
        const batch = writeBatch(db);
        
        // 1. Add Booking Record
        const bookingRef = doc(collection(db, 'artifacts', appId, 'users', user.uid, 'bookings'));
        batch.set(bookingRef, {
            sessionId: selectedSession.id,
            courseName: selectedSession.name,
            date: selectedSession.date,
            usedMethod: access.method, // 'membership' or 'coupon'
            timestamp: serverTimestamp()
        });

        // 2. Increment Enrollment
        const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', selectedSession.id);
        batch.update(sessionRef, { enrolled: (selectedSession.enrolled || 0) + 1 });

        // 3. Deduct Coupon (IF method is coupon) - Simulation only (Local State)
        if (access.method === 'coupon') {
            // In real app, you would define a firestore doc to decrement
            // Here update local state for visual feedback
            setUserTickets(prev => {
                const idx = prev.findIndex(t => t.id === 'prod_coupon');
                if (idx > -1) {
                    const next = [...prev];
                    next.splice(idx, 1);
                    return next;
                }
                return prev;
            });
        }

        await batch.commit();
        alert('✅ 신청 완료되었습니다!');
        setSelectedSession(null);
    } catch (e) {
        console.error(e);
        alert('오류 발생');
    } finally {
        setIsBooking(false);
    }
  };

  const getDaySessions = (dateStr) => sessions.filter(s => s.date === dateStr).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const days = ['월', '화', '수', '목', '금', '토', '일'];

  return (
    <div className="space-y-6">
      <UserWallet userTickets={userTickets} onToggleTicket={handleToggleTicket} />

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
            <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)))}><ChevronLeft/></button>
            <span className="font-bold">{currentDate.getMonth()+1}월 {Math.ceil(currentDate.getDate()/7)}주차</span>
            <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)))}><ChevronRight/></button>
        </div>
        <div className="grid grid-cols-7 divide-x min-w-[800px] overflow-x-auto">
          {weekDates.map((date, idx) => {
            const dateStr = formatDate(date);
            const daySessions = getDaySessions(dateStr);
            return (
              <div key={dateStr} className="min-h-[300px]">
                <div className="text-center py-2 border-b bg-slate-50 font-bold text-sm text-slate-600">{days[idx]} {date.getDate()}</div>
                <div className="p-1 space-y-1">
                  {daySessions.map(session => {
                    const isBooked = bookings.includes(session.id);
                    const access = checkAccessStatus(session);
                    const isDenied = access.status === 'denied';
                    
                    return (
                      <button
                        key={session.id}
                        onClick={() => setSelectedSession(session)}
                        className={`w-full text-left p-2 rounded border text-xs relative ${
                          session.type === 'popup' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'
                        } ${isBooked ? 'ring-2 ring-green-500' : ''} ${isDenied && !isBooked ? 'opacity-60 grayscale' : ''}`}
                      >
                        {isDenied && !isBooked && <Lock className="absolute top-1 right-1 w-3 h-3 text-slate-400"/>}
                        <div className="font-bold">{session.startTime}</div>
                        <div className="truncate">{session.name}</div>
                        <div className="text-[10px] text-slate-500">{session.instructor}</div>
                        {access.method === 'membership' && !isBooked && <div className="mt-1 text-[9px] text-indigo-600 font-bold">✨프리패스</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl relative animate-fade-in">
            <button onClick={() => setSelectedSession(null)} className="absolute top-4 right-4 text-slate-400">✕</button>
            <h2 className="text-xl font-bold mb-1">{selectedSession.name}</h2>
            <div className="text-sm text-slate-500 mb-4">{selectedSession.date} {selectedSession.startTime} | {selectedSession.instructor}</div>

            {(() => {
                if (bookings.includes(selectedSession.id)) {
                    return <div className="bg-green-100 text-green-800 p-3 rounded font-bold text-center">이미 신청한 수업입니다.</div>
                }
                const access = checkAccessStatus(selectedSession);
                if (access.status === 'denied') {
                    return (
                        <div className="bg-red-50 text-red-700 p-4 rounded text-sm space-y-2">
                            <div className="font-bold flex items-center gap-2"><ShieldAlert className="w-4 h-4"/> 수강 불가</div>
                            <p>{access.detail}</p>
                            <div className="text-xs text-slate-500 pt-2 border-t border-red-100">
                                💡 필요 조건: 
                                {selectedSession.accessConfig?.requiredGroup && <div>• {TICKET_PRODUCTS.find(p=>p.group===selectedSession.accessConfig.requiredGroup)?.name}</div>}
                                {selectedSession.accessConfig?.allowStandardCoupon && <div>• 일반 쿠폰 보유</div>}
                            </div>
                        </div>
                    )
                }
                return (
                    <div>
                        <div className="bg-indigo-50 p-4 rounded mb-4 border border-indigo-100">
                            <h4 className="font-bold text-sm text-indigo-900 mb-2">결제(차감) 예정 내역</h4>
                            <div className="flex items-center gap-2 text-sm text-indigo-700">
                                {access.method === 'membership' ? <Star className="w-4 h-4 fill-indigo-600"/> : <Ticket className="w-4 h-4"/>}
                                {access.detail}
                            </div>
                        </div>
                        <button onClick={handleApply} disabled={isBooking} className="w-full bg-slate-900 text-white py-3 rounded font-bold">
                            {isBooking ? '처리 중...' : '신청하기'}
                        </button>
                    </div>
                )
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default function DanceStudioApp() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('user'); 

  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  if (!user) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-white border-b sticky top-0 z-10 p-4 flex justify-between items-center max-w-5xl mx-auto w-full">
        <h1 className="font-bold text-xl">DFS Studio</h1>
        <button onClick={() => setView(view === 'user' ? 'admin' : 'user')} className="text-xs border px-3 py-1 rounded-full">{view === 'user' ? '관리자 모드' : '수강생 모드'}</button>
      </header>
      <main className="max-w-5xl mx-auto p-4">
        {view === 'admin' ? <AdminPanel user={user} /> : <Timetable user={user} />}
      </main>
    </div>
  );
}