import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  CreditCard, 
  MessageSquare, 
  Settings, 
  LogOut, 
  Plus, 
  Search, 
  Bell,
  MoreHorizontal,
  TrendingUp,
  UserCheck,
  Ticket,
  ChevronRight,
  Filter,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  FileText,
  DollarSign,
  ClipboardList, // 아이콘 추가
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

/**
 * MOCK DATA - MOVE IT SERVICE
 */
const SUMMARY_STATS = [
  { label: '이번 달 총 매출', value: '₩ 42,500,000', change: '+12.5%', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: '활성 수강생', value: '142명', change: '+4명', icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
  { label: '오늘 예정 수업', value: '8건', change: '정상 진행', icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50' },
  { label: '미처리 상담', value: '3건', change: '확인 필요', icon: MessageSquare, color: 'text-red-600', bg: 'bg-red-50' },
];

const STUDENTS_DATA = [
  { id: 1, name: '이민지', phone: '010-1234-5678', type: '입시반', status: '수강중', remaining: 12, lastVisit: '2025-05-26', note: '고3 입시, K-POP 전공 희망' },
  { id: 2, name: '박서준', phone: '010-9876-5432', type: '취미반', status: '수강중', remaining: 3, lastVisit: '2025-05-25', note: '직장인, 저녁반 선호' },
  { id: 3, name: '김지수', phone: '010-5555-4444', type: '전문반', status: '휴면', remaining: 0, lastVisit: '2025-04-10', note: '다리 부상으로 휴식 중' },
  { id: 4, name: '최현우', phone: '010-1111-2222', type: '입시반', status: '수강중', remaining: 8, lastVisit: '2025-05-27', note: '팝핀 전공, 재등록 요망' },
  { id: 5, name: '정하늘', phone: '010-3333-7777', type: '키즈반', status: '만료예정', remaining: 1, lastVisit: '2025-05-20', note: '부모님 상담 필요' },
];

const INSTRUCTORS_DATA = [
  { id: 1, name: '권혁준', role: '메인 강사', genre: 'K-POP / 기획', classes: 12, salary: 3600000, status: 'Active' },
  { id: 2, name: '황여경', role: '전임 강사', genre: 'Choreo', classes: 8, salary: 2400000, status: 'Active' },
  { id: 3, name: '김민수', role: '파트 강사', genre: 'Hiphop', classes: 4, salary: 800000, status: 'Active' },
  { id: 4, name: '이지은', role: '파트 강사', genre: 'Waacking', classes: 0, salary: 0, status: 'On Leave' },
];

const SCHEDULE_DATA = [
  { id: 1, day: 'Mon', time: '18:00', title: 'K-POP 기초', instructor: '권혁준', room: 'A홀', students: 8 },
  { id: 2, day: 'Mon', time: '20:00', title: 'Hiphop 중급', instructor: '김민수', room: 'B홀', students: 5 },
  { id: 3, day: 'Tue', time: '19:00', title: 'Choreo 정규', instructor: '황여경', room: 'A홀', students: 12 },
  { id: 4, day: 'Wed', time: '18:00', title: 'K-POP 입시', instructor: '권혁준', room: 'A홀', students: 6 },
  { id: 5, day: 'Fri', time: '20:00', title: '팝핀 기초', instructor: '최현우', room: 'B홀', students: 4 },
];

const REVENUE_DATA = [
  { id: 1, date: '2025-05-27', user: '이민지', item: '입시반 3개월', amount: 950000, method: '카드' },
  { id: 2, date: '2025-05-27', user: '박서준', item: '원데이 클래스', amount: 35000, method: '간편결제' },
  { id: 3, date: '2025-05-26', user: '최현우', item: '개인 레슨 10회', amount: 800000, method: '이체' },
  { id: 4, date: '2025-05-26', user: '김철수', item: '취미반 1개월', amount: 180000, method: '카드' },
];

const PRODUCTS_DATA = [
  { id: 1, name: '주 2회 정규반 (1개월)', price: 180000, category: '정규 클래스', active: true },
  { id: 2, name: '주 3회 입시반 (1개월)', price: 350000, category: '입시/전문', active: true },
  { id: 3, name: '원데이 클래스 (1회권)', price: 35000, category: '일반', active: true },
  { id: 4, name: '10회 쿠폰 (3개월 유효)', price: 300000, category: '쿠폰제', active: true },
];

const DISCOUNTS_DATA = [
  { id: 1, name: '신규 회원 할인', rate: 10, type: 'percent', active: true },
  { id: 2, name: '지인 추천 이벤트', rate: 20000, type: 'fixed', active: true },
  { id: 3, name: '장기 수강(3개월+)', rate: 15, type: 'percent', active: true },
];

const CONSULTATIONS_DATA = {
  new: [
    { id: 101, name: '정하늘', topic: '입시반 문의', date: '2025-05-27', assignee: '홍철화' },
    { id: 102, name: '김태영', topic: '대관 문의', date: '2025-05-27', assignee: '김동현' },
  ],
  scheduled: [
    { id: 201, name: '박지민', topic: '취미반 상담', date: '2025-05-28 14:00', assignee: '오동현' },
  ],
  registered: [
    { id: 301, name: '이민지', topic: '등록 완료', date: '2025-05-26', assignee: '오동현' },
  ]
};

// --- NEW DATA FOR LOGS ---
const DAILY_LOGS_DATA = [
  { 
    id: 1, 
    time: '18:00', 
    title: 'K-POP 기초', 
    instructor: '권혁준', 
    totalStudents: 8, 
    presentStudents: 7, 
    status: 'completed', // written
    content: 'NewJeans - How Sweet 진도 1절 완료. 전반적으로 습득 빠름.',
    note: '김철수 학생 발목 불편 호소하여 참관만 함.'
  },
  { 
    id: 2, 
    time: '20:00', 
    title: 'Hiphop 중급', 
    instructor: '김민수', 
    totalStudents: 5, 
    presentStudents: 5, 
    status: 'pending', // not written yet
    content: '',
    note: ''
  }
];

// --- COMMON COMPONENTS ---

const StatusBadge = ({ status }) => {
  const styles = {
    '수강중': 'bg-green-100 text-green-700',
    '휴면': 'bg-gray-100 text-gray-600',
    '만료예정': 'bg-red-100 text-red-700',
    '상담대기': 'bg-yellow-100 text-yellow-700',
    'Active': 'bg-blue-100 text-blue-700',
    'On Leave': 'bg-gray-200 text-gray-500',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${styles[status] || 'bg-gray-100'}`}>
      {status}
    </span>
  );
};

const SectionHeader = ({ title, buttonText, onButtonClick }) => (
  <div className="flex justify-between items-center mb-6">
    <h2 className="text-xl font-bold text-gray-800">{title}</h2>
    {buttonText && (
      <button 
        onClick={onButtonClick}
        className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"
      >
        <Plus size={16} /> {buttonText}
      </button>
    )}
  </div>
);

// --- VIEWS ---

const DashboardView = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {SUMMARY_STATS.map((stat, idx) => (
        <div key={idx} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-lg ${stat.bg}`}>
              <stat.icon className={stat.color} size={24} />
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${stat.color === 'text-red-600' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
              {stat.change}
            </span>
          </div>
          <h3 className="text-gray-500 text-sm font-medium">{stat.label}</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
        </div>
      ))}
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 최근 상담 내역 */}
      <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-lg text-gray-800">최근 상담/등록 현황</h3>
          <button className="text-sm text-blue-600 hover:underline">전체보기</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 border-b pb-2">
                <th className="pb-3 pl-2">이름</th>
                <th className="pb-3">관심 분야</th>
                <th className="pb-3">담당자</th>
                <th className="pb-3">날짜</th>
                <th className="pb-3">상태</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              <tr className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-3 pl-2 font-medium">정하늘</td>
                <td>입시반 문의</td>
                <td>홍철화</td>
                <td>2025.05.27</td>
                <td><StatusBadge status="상담대기" /></td>
              </tr>
              <tr className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-3 pl-2 font-medium">이민지</td>
                <td>K-POP 정규</td>
                <td>오동현</td>
                <td>2025.05.26</td>
                <td><StatusBadge status="수강중" /></td>
              </tr>
              <tr className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-3 pl-2 font-medium">김태영</td>
                <td>대관 문의</td>
                <td>김동현</td>
                <td>2025.05.27</td>
                <td><StatusBadge status="상담대기" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 빠른 작업 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold text-lg text-gray-800 mb-4">빠른 작업</h3>
        <div className="space-y-3">
          <button className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-colors group">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-2 rounded-full group-hover:bg-blue-200">
                <Plus size={20} className="text-blue-700" />
              </div>
              <div className="text-left">
                <span className="block font-bold text-gray-800">신규 회원 등록</span>
                <span className="text-xs text-gray-500">상담 후 바로 등록하기</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-600" />
          </button>
          
          <button className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-purple-50 hover:border-purple-200 transition-colors group">
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 p-2 rounded-full group-hover:bg-purple-200">
                <MessageSquare size={20} className="text-purple-700" />
              </div>
              <div className="text-left">
                <span className="block font-bold text-gray-800">상담 일지 작성</span>
                <span className="text-xs text-gray-500">문의 내용 및 스케줄 기록</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400 group-hover:text-purple-600" />
          </button>

           <button className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-green-50 hover:border-green-200 transition-colors group">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-2 rounded-full group-hover:bg-green-200">
                <CreditCard size={20} className="text-green-700" />
              </div>
              <div className="text-left">
                <span className="block font-bold text-gray-800">수강권 간편 결제</span>
                <span className="text-xs text-gray-500">카드/이체 정산 처리</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400 group-hover:text-green-600" />
          </button>
        </div>
      </div>
    </div>
  </div>
);

const StudentView = () => (
  <div className="space-y-6">
    <SectionHeader title="학생(회원) 관리" buttonText="학생 등록" />

    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 border-b flex gap-3 bg-gray-50">
        <div className="relative flex-1 max-w-sm">
          <input type="text" placeholder="이름, 전화번호 검색..." className="pl-9 pr-4 py-2 border rounded-lg text-sm w-full focus:ring-2 focus:ring-blue-500 outline-none" />
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
        </div>
        <button className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-white text-sm text-gray-600 hover:bg-gray-50">
          <Filter size={16} /> 필터
        </button>
        <button className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-white text-sm text-gray-600 hover:bg-gray-50">
          <Download size={16} /> 엑셀 다운로드
        </button>
      </div>

      <table className="w-full text-sm text-left">
        <thead className="bg-gray-50 text-gray-500 font-medium">
          <tr>
            <th className="px-6 py-3">이름</th>
            <th className="px-6 py-3">연락처</th>
            <th className="px-6 py-3">수강 클래스</th>
            <th className="px-6 py-3">잔여 횟수</th>
            <th className="px-6 py-3">최근 방문일</th>
            <th className="px-6 py-3">상태</th>
            <th className="px-6 py-3 text-right">관리</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {STUDENTS_DATA.map((student) => (
            <tr key={student.id} className="hover:bg-blue-50 transition-colors cursor-pointer group">
              <td className="px-6 py-4 font-bold text-gray-800">{student.name}</td>
              <td className="px-6 py-4 text-gray-600">{student.phone}</td>
              <td className="px-6 py-4">{student.type}</td>
              <td className="px-6 py-4">
                <span className={`font-bold ${student.remaining <= 3 ? 'text-red-500' : 'text-blue-600'}`}>
                  {student.remaining}회
                </span>
              </td>
              <td className="px-6 py-4 text-gray-500">{student.lastVisit}</td>
              <td className="px-6 py-4"><StatusBadge status={student.status} /></td>
              <td className="px-6 py-4 text-right">
                <button className="text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal size={20} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-4 border-t bg-gray-50 text-center text-xs text-gray-500 hover:bg-gray-100 cursor-pointer transition-colors">
        더 보기 (5 / 142)
      </div>
    </div>
  </div>
);

const ClassesView = () => (
  <div className="space-y-6">
    <SectionHeader title="클래스 / 시간표 관리" buttonText="수업 추가" />

    {/* 주간 캘린더 형태 Mock */}
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 overflow-x-auto">
      <div className="grid grid-cols-7 gap-4 min-w-[800px]">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day} className="text-center">
            <div className="font-bold text-gray-800 mb-4 py-2 bg-gray-100 rounded-lg">{day}</div>
            <div className="space-y-3 min-h-[300px]">
              {SCHEDULE_DATA.filter(s => s.day === day).map(schedule => (
                <div key={schedule.id} className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-left hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                  <p className="text-xs font-bold text-blue-700 mb-1">{schedule.time}</p>
                  <p className="font-bold text-gray-800 text-sm truncate">{schedule.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{schedule.instructor} | {schedule.room}</p>
                  <div className="mt-2 flex items-center gap-1 text-xs text-gray-600 bg-white px-2 py-1 rounded w-fit">
                    <Users size={12} /> {schedule.students}명
                  </div>
                </div>
              ))}
              {SCHEDULE_DATA.filter(s => s.day === day).length === 0 && (
                <div className="h-full flex items-center justify-center text-gray-300 text-xs border-dashed border-2 rounded-lg">
                  수업 없음
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const InstructorView = () => (
  <div className="space-y-6">
    <SectionHeader title="강사 관리 및 정산" buttonText="강사 등록" />

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {INSTRUCTORS_DATA.map(instructor => (
        <div key={instructor.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600 text-lg">
                {instructor.name[0]}
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900">{instructor.name}</h3>
                <p className="text-sm text-blue-600">{instructor.role}</p>
              </div>
            </div>
            <StatusBadge status={instructor.status} />
          </div>
          
          <div className="space-y-3 border-t pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">주력 장르</span>
              <span className="font-medium">{instructor.genre}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">이번 달 수업</span>
              <span className="font-medium">{instructor.classes} 강</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">예상 정산금</span>
              <span className="font-bold text-gray-900">₩ {instructor.salary.toLocaleString()}</span>
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            <button className="flex-1 py-2 border rounded-lg text-sm hover:bg-gray-50">상세 프로필</button>
            <button className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">정산 명세서</button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const RevenueView = () => (
  <div className="space-y-6">
    <SectionHeader title="매출 및 정산 관리" />
    
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-2">
      <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-600">
        <p className="text-gray-500 text-sm">이번 달 총 매출</p>
        <p className="text-2xl font-bold mt-2">₩ 42,500,000</p>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500">
        <p className="text-gray-500 text-sm">미정산 금액 (강사료)</p>
        <p className="text-2xl font-bold mt-2">₩ 12,800,000</p>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-purple-500">
        <p className="text-gray-500 text-sm">순수익 (예상)</p>
        <p className="text-2xl font-bold mt-2">₩ 29,700,000</p>
      </div>
    </div>

    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="font-bold text-lg text-gray-800 mb-4">최근 결제 내역</h3>
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="px-4 py-3">날짜</th>
            <th className="px-4 py-3">회원명</th>
            <th className="px-4 py-3">구매 항목</th>
            <th className="px-4 py-3">결제 금액</th>
            <th className="px-4 py-3">결제 수단</th>
            <th className="px-4 py-3 text-right">영수증</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {REVENUE_DATA.map((rev) => (
            <tr key={rev.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-500">{rev.date}</td>
              <td className="px-4 py-3 font-medium">{rev.user}</td>
              <td className="px-4 py-3">{rev.item}</td>
              <td className="px-4 py-3 font-bold">₩ {rev.amount.toLocaleString()}</td>
              <td className="px-4 py-3 text-gray-600">{rev.method}</td>
              <td className="px-4 py-3 text-right">
                <button className="text-xs border px-2 py-1 rounded hover:bg-gray-100">보기</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const ProductView = () => (
  <div className="space-y-6">
    <SectionHeader title="수강권 및 상품 관리" buttonText="새 상품 추가" />

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 상품 목록 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold text-md text-gray-800 mb-4 flex items-center gap-2">
          <Ticket size={18} className="text-gray-500" /> 판매 중인 상품
        </h3>
        <div className="space-y-4">
          {PRODUCTS_DATA.map((product) => (
            <div key={product.id} className="flex justify-between items-center p-4 border rounded-lg hover:border-blue-300 transition-colors bg-white">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{product.category}</span>
                  <h4 className="font-bold text-gray-800">{product.name}</h4>
                </div>
                <p className="text-sm text-gray-500 mt-1">기본가: ₩{product.price.toLocaleString()}</p>
              </div>
              <button className="text-gray-400 hover:text-gray-600"><Settings size={18} /></button>
            </div>
          ))}
        </div>
      </div>

      {/* 할인율 관리 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold text-md text-gray-800 mb-4 flex items-center gap-2">
          <TrendingUp size={18} className="text-gray-500" /> 할인 정책 (프로모션)
        </h3>
        <div className="space-y-4">
          {DISCOUNTS_DATA.map((discount) => (
            <div key={discount.id} className="flex justify-between items-center p-4 border border-dashed rounded-lg bg-gray-50">
              <div>
                <h4 className="font-bold text-gray-800">{discount.name}</h4>
                <p className="text-sm text-gray-500 mt-1">
                  감면액: {discount.type === 'percent' ? `${discount.rate}%` : `₩${discount.rate.toLocaleString()}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${discount.active ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                <span className="text-xs text-gray-500">{discount.active ? '적용중' : '비활성'}</span>
              </div>
            </div>
          ))}
           <button className="w-full py-3 border border-gray-300 border-dashed rounded-lg text-gray-500 text-sm hover:bg-gray-100 flex items-center justify-center gap-2">
            <Plus size={16} /> 새 할인 정책 만들기
          </button>
        </div>
      </div>
    </div>
  </div>
);

const ConsultationView = () => (
  <div className="h-full flex flex-col">
    <SectionHeader title="상담 및 리드 관리 (Kanban)" buttonText="상담 추가" />
    
    <div className="flex-1 grid grid-cols-3 gap-6 overflow-hidden pb-6">
      {/* 1. 신규 문의 */}
      <div className="bg-gray-100 rounded-xl p-4 flex flex-col h-full border border-gray-200">
        <div className="flex justify-between items-center mb-4 px-1">
          <h3 className="font-bold text-gray-700 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-400"></div> 신규 문의</h3>
          <span className="bg-white text-gray-600 text-xs px-2 py-1 rounded-full border">{CONSULTATIONS_DATA.new.length}</span>
        </div>
        <div className="space-y-3 overflow-y-auto pr-2">
          {CONSULTATIONS_DATA.new.map((item) => (
            <div key={item.id} className="bg-white p-4 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow border-l-4 border-yellow-400 group">
              <div className="flex justify-between items-start">
                <h4 className="font-bold text-gray-800">{item.name}</h4>
                <button className="text-gray-300 hover:text-gray-500"><MoreHorizontal size={16} /></button>
              </div>
              <p className="text-sm text-gray-600 mt-1">{item.topic}</p>
              <div className="flex justify-between items-center mt-3 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Clock size={12}/> {item.date}</span>
                <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">{item.assignee}</span>
              </div>
            </div>
          ))}
          <button className="w-full py-2 text-sm text-gray-500 hover:bg-gray-200 rounded-lg border border-dashed border-gray-300">
            + 카드 추가
          </button>
        </div>
      </div>

      {/* 2. 상담 예정 */}
      <div className="bg-blue-50 rounded-xl p-4 flex flex-col h-full border border-blue-100">
        <div className="flex justify-between items-center mb-4 px-1">
          <h3 className="font-bold text-blue-800 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div> 상담 예정</h3>
          <span className="bg-white text-blue-700 text-xs px-2 py-1 rounded-full border border-blue-100">{CONSULTATIONS_DATA.scheduled.length}</span>
        </div>
        <div className="space-y-3 overflow-y-auto pr-2">
          {CONSULTATIONS_DATA.scheduled.map((item) => (
            <div key={item.id} className="bg-white p-4 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow border-l-4 border-blue-500">
              <div className="flex justify-between items-start">
                <h4 className="font-bold text-gray-800">{item.name}</h4>
                <button className="text-gray-300 hover:text-gray-500"><MoreHorizontal size={16} /></button>
              </div>
              <p className="text-sm text-gray-600 mt-1">{item.topic}</p>
              <div className="flex justify-between items-center mt-3 text-xs text-gray-400">
                <span className="text-blue-600 font-bold flex items-center gap-1"><Calendar size={12}/> {item.date}</span>
                <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">{item.assignee}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. 등록 완료 */}
      <div className="bg-green-50 rounded-xl p-4 flex flex-col h-full border border-green-100">
        <div className="flex justify-between items-center mb-4 px-1">
          <h3 className="font-bold text-green-800 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div> 등록/결제 완료</h3>
          <span className="bg-white text-green-700 text-xs px-2 py-1 rounded-full border border-green-100">{CONSULTATIONS_DATA.registered.length}</span>
        </div>
        <div className="space-y-3 overflow-y-auto pr-2">
          {CONSULTATIONS_DATA.registered.map((item) => (
            <div key={item.id} className="bg-white p-4 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow border-l-4 border-green-500 opacity-80 hover:opacity-100">
              <div className="flex justify-between">
                <h4 className="font-bold text-gray-800">{item.name}</h4>
                <CheckCircle size={16} className="text-green-600" />
              </div>
              <p className="text-sm text-gray-600 mt-1">{item.topic}</p>
              <div className="flex justify-between items-center mt-3 text-xs text-gray-400">
                <span>{item.date}</span>
                <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">{item.assignee}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// --- NEW VIEW: Daily Logs ---
const DailyLogView = () => {
  const [expandedLogId, setExpandedLogId] = useState(1);

  return (
    <div className="space-y-6">
      <SectionHeader title="업무 및 수업 일지" />

      {/* 날짜 선택 및 요약 */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-gray-100 rounded-full"><ChevronRight size={20} className="rotate-180" /></button>
          <div className="text-center">
            <h3 className="text-xl font-bold text-gray-900">2025년 5월 27일</h3>
            <p className="text-sm text-gray-500">화요일 (오늘)</p>
          </div>
          <button className="p-2 hover:bg-gray-100 rounded-full"><ChevronRight size={20} /></button>
        </div>
        <div className="flex gap-4">
           <div className="text-right">
             <p className="text-xs text-gray-500">작성 완료</p>
             <p className="font-bold text-blue-600">1 / 2 건</p>
           </div>
           <div className="h-10 w-px bg-gray-200"></div>
           <div className="text-right">
             <p className="text-xs text-gray-500">특이사항</p>
             <p className="font-bold text-red-500">1 건</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 수업 리스트 */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <ClipboardList size={18}/> 수업 별 기록
          </h3>
          
          {DAILY_LOGS_DATA.map((log) => (
            <div key={log.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${expandedLogId === log.id ? 'ring-2 ring-blue-500 border-transparent' : 'border-gray-100'}`}>
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`px-3 py-1 rounded text-sm font-bold ${log.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                    {log.time}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800">{log.title}</h4>
                    <p className="text-xs text-gray-500">{log.instructor} 강사</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {log.status === 'pending' && <span className="text-xs text-red-500 font-bold flex items-center gap-1"><AlertCircle size={12}/> 미작성</span>}
                  {expandedLogId === log.id ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                </div>
              </div>

              {/* 확장 영역 (일지 상세) */}
              {expandedLogId === log.id && (
                <div className="p-4 border-t border-gray-100 bg-slate-50">
                  {/* 출석 체크 */}
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">출석 현황</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500" style={{ width: `${(log.presentStudents / log.totalStudents) * 100}%` }}></div>
                      </div>
                      <span className="text-sm font-bold text-gray-700">{log.presentStudents} / {log.totalStudents} 명</span>
                    </div>
                  </div>

                  {/* 진도 및 내용 */}
                  <div className="mb-4">
                     <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">수업 진도 및 내용</label>
                     {log.status === 'completed' ? (
                       <p className="text-sm text-gray-800 bg-white p-3 rounded border border-gray-200">{log.content}</p>
                     ) : (
                       <textarea className="w-full text-sm p-3 rounded border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="오늘 진행한 수업 내용을 입력하세요..." rows={3}></textarea>
                     )}
                  </div>

                  {/* 특이사항 */}
                  <div className="mb-4">
                     <label className="block text-xs font-bold text-gray-500 mb-1 uppercase text-red-500">특이사항 (학생/시설)</label>
                     {log.status === 'completed' ? (
                       <p className="text-sm text-gray-800 bg-white p-3 rounded border border-gray-200">{log.note || '특이사항 없음'}</p>
                     ) : (
                       <input type="text" className="w-full text-sm p-3 rounded border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="부상자, 상담 필요 학생 등..." />
                     )}
                  </div>

                  {log.status === 'pending' && (
                    <div className="flex justify-end">
                      <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700">일지 저장</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 오른쪽: 운영 메모 */}
        <div className="space-y-4">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <FileText size={18}/> 운영 메모
          </h3>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 h-fit">
            <textarea 
              className="w-full h-40 p-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none mb-3"
              placeholder="오늘 센터 운영 관련 특이사항을 자유롭게 기록하세요. (예: A홀 에어컨 점검 필요, 비품 화장지 구매 완료 등)"
            ></textarea>
            <button className="w-full bg-gray-900 text-white py-2 rounded-lg text-sm font-bold hover:bg-gray-800">
              메모 저장
            </button>
          </div>

          <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
             <h4 className="font-bold text-yellow-800 text-sm mb-2 flex items-center gap-2"><AlertCircle size={14}/> 알림</h4>
             <p className="text-xs text-yellow-700">
               미작성된 수업 일지가 1건 있습니다.<br/>퇴근 전 반드시 작성 부탁드립니다.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsView = () => (
  <div className="space-y-6">
    <SectionHeader title="시스템 설정" />
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-lg mb-4">학원 기본 정보</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">학원명</label>
            <input type="text" value="MOVE IT ACADEMY" className="w-full border rounded-lg px-3 py-2 bg-gray-50" readOnly />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">대표 전화번호</label>
            <input type="text" value="02-1234-5678" className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
            <input type="text" value="서울시 마포구 합정동" className="w-full border rounded-lg px-3 py-2" />
          </div>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">정보 수정 저장</button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h3 className="font-bold text-lg mb-4">알림 및 자동화 설정</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-800">수강료 납부 알림</p>
              <p className="text-xs text-gray-500">만료 3일 전 자동 문자 발송</p>
            </div>
            <div className="w-10 h-5 bg-blue-600 rounded-full relative cursor-pointer"><div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div></div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-800">상담 예약 리마인더</p>
              <p className="text-xs text-gray-500">상담 당일 오전 10시 알림톡</p>
            </div>
            <div className="w-10 h-5 bg-blue-600 rounded-full relative cursor-pointer"><div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div></div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-800">강사 급여 정산 알림</p>
              <p className="text-xs text-gray-500">매월 1일 관리자에게 알림</p>
            </div>
            <div className="w-10 h-5 bg-gray-300 rounded-full relative cursor-pointer"><div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full"></div></div>
          </div>
        </div>
      </div>
    </div>
  </div>
);


// --- MAIN LAYOUT ---

const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
  <div 
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-200 rounded-lg mx-2 mb-1
    ${active ? 'bg-blue-50 text-blue-700 font-bold shadow-sm' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
  >
    <Icon size={20} className={active ? 'text-blue-600' : 'text-gray-400'} />
    <span className="text-sm">{label}</span>
  </div>
);

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardView />;
      case 'students': return <StudentView />;
      case 'classes': return <ClassesView />;
      case 'logs': return <DailyLogView />; // NEW VIEW ADDED
      case 'instructors': return <InstructorView />;
      case 'consultations': return <ConsultationView />;
      case 'products': return <ProductView />;
      case 'revenue': return <RevenueView />;
      case 'settings': return <SettingsView />;
      default: return <DashboardView />;
    }
  };

  const getTitle = () => {
    const titles = {
      dashboard: '대시보드',
      students: '학생(회원) 관리',
      classes: '클래스/시간표',
      logs: '업무/수업 일지', // TITLE ADDED
      instructors: '강사 관리',
      consultations: '상담 및 문의',
      products: '수강권 및 상품 설정',
      revenue: '매출 및 정산',
      settings: '환경설정'
    };
    return titles[activeTab] || 'MOVE IT Admin';
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-lg z-20">
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold italic">M</div>
            <h1 className="text-xl font-extrabold tracking-tight text-gray-900 italic">
              MOVE <span className="text-blue-600">IT</span>
            </h1>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 space-y-1">
          <SidebarItem icon={LayoutDashboard} label="대시보드" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          
          <div className="px-6 pt-6 pb-2 text-xs font-bold text-gray-400 uppercase tracking-wider">운영 관리</div>
          <SidebarItem icon={Users} label="학생 관리" active={activeTab === 'students'} onClick={() => setActiveTab('students')} />
          <SidebarItem icon={Calendar} label="클래스/시간표" active={activeTab === 'classes'} onClick={() => setActiveTab('classes')} />
          {/* NEW MENU ITEM ADDED */}
          <SidebarItem icon={ClipboardList} label="업무/수업 일지" active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} />
          <SidebarItem icon={UserCheck} label="강사 관리" active={activeTab === 'instructors'} onClick={() => setActiveTab('instructors')} />
          <SidebarItem icon={MessageSquare} label="상담 관리" active={activeTab === 'consultations'} onClick={() => setActiveTab('consultations')} />
          
          <div className="px-6 pt-6 pb-2 text-xs font-bold text-gray-400 uppercase tracking-wider">매출 및 설정</div>
          <SidebarItem icon={Ticket} label="수강권/상품" active={activeTab === 'products'} onClick={() => setActiveTab('products')} />
          <SidebarItem icon={CreditCard} label="매출/정산" active={activeTab === 'revenue'} onClick={() => setActiveTab('revenue')} />
          <SidebarItem icon={Settings} label="설정" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
            <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm">
              OD
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold truncate">오동현</p>
              <p className="text-xs text-gray-500 truncate">총괄 관리자</p>
            </div>
            <LogOut size={16} className="text-gray-400 hover:text-red-500" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50/50">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shadow-sm z-10 sticky top-0">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            {getTitle()}
          </h2>
          
          <div className="flex items-center gap-4">
            <div className="relative group">
              <input 
                type="text" 
                placeholder="학생, 강사 검색..." 
                className="pl-10 pr-4 py-2 bg-gray-100 border-none rounded-full text-sm focus:ring-2 focus:ring-blue-500 w-64 transition-all focus:w-80"
              />
              <Search size={18} className="absolute left-3.5 top-2.5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <button className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
            </button>
          </div>
        </header>

        {/* Dynamic View Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto pb-10">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;