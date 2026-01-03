import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  CreditCard, 
  History, 
  Search, 
  Check, 
  X, 
  Calendar, 
  Hash, 
  ChevronRight, 
  AlertCircle,
  Tag,
  Calculator
} from 'lucide-react';

// --- Mock Data ---

const INITIAL_STUDENTS = [
  { id: 1, name: '김민준', phone: '010-1234-5678', remainingCounts: 0, expiryDate: null },
  { id: 2, name: '이서연', phone: '010-2222-3333', remainingCounts: 5, expiryDate: '2024-12-31' },
  { id: 3, name: '박지훈', phone: '010-4444-5555', remainingCounts: 12, expiryDate: null },
  { id: 4, name: '최수아', phone: '010-7777-8888', remainingCounts: 0, expiryDate: '2024-06-30' },
  { id: 5, name: '정우성', phone: '010-9999-0000', remainingCounts: 0, expiryDate: null },
];

const PRODUCTS = [
  { id: 'p1', type: 'count', name: '10회 수강권', amount: 10, days: null, price: 300000 },
  { id: 'p2', type: 'count', name: '30회 수강권', amount: 30, days: null, price: 800000 },
  { id: 'p3', type: 'period', name: '1개월 무제한 패스', amount: null, days: 30, price: 250000 },
  { id: 'p4', type: 'period', name: '3개월 무제한 패스', amount: null, days: 90, price: 700000 },
];

const DISCOUNT_POLICIES = [
  { id: 'd1', name: '신규 회원 할인', type: 'percent', value: 10 },
  { id: 'd2', name: '재등록 할인', type: 'amount', value: 30000 },
  { id: 'd3', name: '지인 추천 이벤트', type: 'percent', value: 5 },
  { id: 'd4', name: '가족 할인', type: 'percent', value: 20 },
];

// --- Utilities ---
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);
};

const formatDate = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

// --- Main Component ---

export default function App() {
  const [activeTab, setActiveTab] = useState('sales'); // 'sales' | 'logs'
  const [logs, setLogs] = useState([]);
  
  // Sales State
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Discount State
  const [discountMode, setDiscountMode] = useState('policy'); // 'policy' | 'manual'
  const [selectedPolicyId, setSelectedPolicyId] = useState(null);
  const [manualDiscountType, setManualDiscountType] = useState('amount'); // 'amount' | 'percent'
  const [manualDiscountValue, setManualDiscountValue] = useState(0);

  // Modal State
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  // --- Logic ---

  const filteredStudents = useMemo(() => {
    if (!searchTerm) return INITIAL_STUDENTS;
    return INITIAL_STUDENTS.filter(s => 
      s.name.includes(searchTerm) || s.phone.includes(searchTerm)
    );
  }, [searchTerm]);

  const pricing = useMemo(() => {
    if (!selectedProduct) return { original: 0, discount: 0, final: 0 };

    let original = selectedProduct.price;
    let discount = 0;

    if (discountMode === 'policy' && selectedPolicyId) {
      const policy = DISCOUNT_POLICIES.find(p => p.id === selectedPolicyId);
      if (policy) {
        if (policy.type === 'percent') {
          discount = original * (policy.value / 100);
        } else {
          discount = policy.value;
        }
      }
    } else if (discountMode === 'manual') {
      if (manualDiscountType === 'percent') {
        discount = original * (manualDiscountValue / 100);
      } else {
        discount = Number(manualDiscountValue);
      }
    }

    // 할인 금액이 원금보다 크지 않게
    if (discount > original) discount = original;
    if (discount < 0) discount = 0;

    return {
      original,
      discount,
      final: original - discount
    };
  }, [selectedProduct, discountMode, selectedPolicyId, manualDiscountType, manualDiscountValue]);

  const handlePayment = () => {
    setIsConfirmModalOpen(true);
  };

  const confirmPayment = () => {
    // 1. 로그 생성
    const newLog = {
      id: Date.now(),
      date: new Date().toISOString(),
      studentName: selectedStudent.name,
      studentId: selectedStudent.id,
      productName: selectedProduct.name,
      productType: selectedProduct.type,
      originalPrice: pricing.original,
      discountAmount: pricing.discount,
      finalPrice: pricing.final,
      discountDetail: discountMode === 'policy' 
        ? DISCOUNT_POLICIES.find(d => d.id === selectedPolicyId)?.name || '선택 없음'
        : `직접 입력 (${manualDiscountType === 'percent' ? `${manualDiscountValue}%` : `${manualDiscountValue}원`})`
    };

    setLogs([newLog, ...logs]);
    
    // 2. 모달 전환
    setIsConfirmModalOpen(false);
    setIsSuccessModalOpen(true);
  };

  const resetForm = () => {
    setSelectedStudent(null);
    setSelectedProduct(null);
    setSearchTerm('');
    setSelectedPolicyId(null);
    setManualDiscountValue(0);
    setIsSuccessModalOpen(false);
  };

  // --- Render Components ---

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <CreditCard size={18} />
            </div>
            <h1 className="text-xl font-bold text-slate-800">수강권 판매 시스템</h1>
          </div>
          <nav className="flex gap-4">
            <button 
              onClick={() => setActiveTab('sales')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'sales' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              판매 및 등록
            </button>
            <button 
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'logs' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              결제 로그
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'sales' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Input Forms */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* 1. Student Selection */}
              <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">1</span>
                  학생 선택
                </h2>
                
                {!selectedStudent ? (
                  <div className="relative">
                    <Search className="absolute left-3 top-3 text-slate-400" size={20} />
                    <input 
                      type="text" 
                      placeholder="이름 또는 전화번호 뒷자리 검색" 
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    
                    {searchTerm && (
                      <div className="mt-2 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredStudents.length > 0 ? (
                          filteredStudents.map(student => (
                            <button
                              key={student.id}
                              onClick={() => setSelectedStudent(student)}
                              className="w-full text-left px-4 py-3 hover:bg-slate-50 flex justify-between items-center group"
                            >
                              <div>
                                <div className="font-medium text-slate-800">{student.name}</div>
                                <div className="text-xs text-slate-500">{student.phone}</div>
                              </div>
                              <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500" />
                            </button>
                          ))
                        ) : (
                          <div className="p-4 text-center text-slate-500 text-sm">검색 결과가 없습니다.</div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center text-blue-700 font-bold">
                        {selectedStudent.name[0]}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{selectedStudent.name}</div>
                        <div className="text-xs text-slate-500">{selectedStudent.phone}</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedStudent(null)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                )}
              </section>

              {/* 2. Product Selection */}
              <section className={`bg-white p-6 rounded-xl shadow-sm border border-slate-200 transition-opacity ${!selectedStudent ? 'opacity-50 pointer-events-none' : ''}`}>
                <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">2</span>
                  수강권 선택
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PRODUCTS.map(product => (
                    <button
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                        selectedProduct?.id === product.id 
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' 
                          : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-xs font-bold px-2 py-1 rounded ${product.type === 'count' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'}`}>
                          {product.type === 'count' ? '횟수제' : '기간제'}
                        </span>
                        {selectedProduct?.id === product.id && <div className="bg-blue-500 text-white rounded-full p-0.5"><Check size={12} /></div>}
                      </div>
                      <div className="font-bold text-slate-800 mb-1">{product.name}</div>
                      <div className="text-sm text-slate-600">{formatCurrency(product.price)}</div>
                      <div className="text-xs text-slate-400 mt-2">
                        {product.type === 'count' ? `${product.amount}회 제공` : `${product.days}일 무제한`}
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {/* 3. Discount Application */}
              <section className={`bg-white p-6 rounded-xl shadow-sm border border-slate-200 transition-opacity ${!selectedProduct ? 'opacity-50 pointer-events-none' : ''}`}>
                <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">3</span>
                  할인 적용
                </h2>

                <div className="flex gap-4 border-b border-slate-200 mb-4">
                  <button
                    onClick={() => setDiscountMode('policy')}
                    className={`pb-2 text-sm font-medium border-b-2 transition-colors ${discountMode === 'policy' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'}`}
                  >
                    할인 정책 선택
                  </button>
                  <button
                    onClick={() => setDiscountMode('manual')}
                    className={`pb-2 text-sm font-medium border-b-2 transition-colors ${discountMode === 'manual' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'}`}
                  >
                    직접 입력
                  </button>
                </div>

                {discountMode === 'policy' ? (
                  <div className="space-y-2">
                    {DISCOUNT_POLICIES.map(policy => (
                      <label 
                        key={policy.id} 
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${selectedPolicyId === policy.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
                      >
                        <div className="flex items-center gap-3">
                          <input 
                            type="radio" 
                            name="discount" 
                            className="text-blue-600 focus:ring-blue-500"
                            checked={selectedPolicyId === policy.id}
                            onChange={() => setSelectedPolicyId(policy.id)}
                            onClick={() => setSelectedPolicyId(selectedPolicyId === policy.id ? null : policy.id)} // Toggle off
                          />
                          <div>
                            <div className="text-sm font-medium text-slate-800">{policy.name}</div>
                            <div className="text-xs text-slate-500">
                              {policy.type === 'percent' ? `${policy.value}% 할인` : `${formatCurrency(policy.value)} 할인`}
                            </div>
                          </div>
                        </div>
                        {selectedPolicyId === policy.id && <Tag size={16} className="text-blue-500" />}
                      </label>
                    ))}
                    {selectedPolicyId === null && <div className="text-xs text-slate-400 pl-1">* 할인을 적용하지 않으려면 선택을 해제하세요.</div>}
                  </div>
                ) : (
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="flex gap-2 mb-3">
                      <button 
                        onClick={() => setManualDiscountType('amount')}
                        className={`flex-1 py-1.5 text-xs font-medium rounded shadow-sm border ${manualDiscountType === 'amount' ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-100 border-transparent text-slate-400'}`}
                      >
                        금액(₩) 할인
                      </button>
                      <button 
                        onClick={() => setManualDiscountType('percent')}
                        className={`flex-1 py-1.5 text-xs font-medium rounded shadow-sm border ${manualDiscountType === 'percent' ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-100 border-transparent text-slate-400'}`}
                      >
                        비율(%) 할인
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calculator size={20} className="text-slate-400" />
                      <input 
                        type="number" 
                        min="0"
                        className="flex-1 bg-white border border-slate-300 rounded px-3 py-2 text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder={manualDiscountType === 'percent' ? '10' : '10000'}
                        value={manualDiscountValue}
                        onChange={(e) => setManualDiscountValue(Number(e.target.value))}
                      />
                      <span className="text-sm font-bold text-slate-600 w-8">
                        {manualDiscountType === 'percent' ? '%' : '원'}
                      </span>
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Right Column: Summary & Actions */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-4">
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-800 mb-6 border-b border-slate-100 pb-4">결제 예상 정보</h3>
                  
                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>상품 금액</span>
                      <span>{formatCurrency(pricing.original)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-red-500">
                      <span className="flex items-center gap-1">
                         할인 금액
                         {pricing.discount > 0 && <span className="text-xs bg-red-100 px-1.5 py-0.5 rounded-full">적용됨</span>}
                      </span>
                      <span>- {formatCurrency(pricing.discount)}</span>
                    </div>
                    <div className="border-t border-dashed border-slate-300 my-2"></div>
                    <div className="flex justify-between items-end">
                      <span className="font-bold text-slate-800">최종 결제 금액</span>
                      <span className="text-2xl font-bold text-blue-600">{formatCurrency(pricing.final)}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded">
                      <p className="mb-1"><span className="font-bold">받는 분:</span> {selectedStudent ? selectedStudent.name : '-'}</p>
                      <p><span className="font-bold">상품:</span> {selectedProduct ? selectedProduct.name : '-'}</p>
                    </div>
                    
                    <button 
                      onClick={handlePayment}
                      disabled={!selectedStudent || !selectedProduct}
                      className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-blue-200 shadow-lg transition-all active:scale-[0.98]"
                    >
                      결제 및 수강권 충전
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Logs Tab
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <History size={20} className="text-slate-500" />
                  결제 내역 로그
                </h2>
                <div className="text-sm text-slate-500">
                  총 {logs.length}건
                </div>
             </div>
             
             {logs.length === 0 ? (
               <div className="p-12 text-center text-slate-400">
                 <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                      <AlertCircle size={32} />
                    </div>
                 </div>
                 <p>아직 결제 내역이 없습니다.</p>
               </div>
             ) : (
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm text-slate-600">
                   <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                     <tr>
                       <th className="px-6 py-4">일시</th>
                       <th className="px-6 py-4">학생명</th>
                       <th className="px-6 py-4">상품명</th>
                       <th className="px-6 py-4">할인 정보</th>
                       <th className="px-6 py-4 text-right">최종 금액</th>
                       <th className="px-6 py-4 text-center">상태</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {logs.map(log => (
                       <tr key={log.id} className="hover:bg-slate-50/50">
                         <td className="px-6 py-4 whitespace-nowrap">
                            {new Date(log.date).toLocaleString()}
                         </td>
                         <td className="px-6 py-4 font-medium text-slate-900">{log.studentName}</td>
                         <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mr-2 ${log.productType === 'count' ? 'bg-indigo-100 text-indigo-800' : 'bg-purple-100 text-purple-800'}`}>
                              {log.productType === 'count' ? '횟수' : '기간'}
                            </span>
                            {log.productName}
                         </td>
                         <td className="px-6 py-4 text-slate-500">
                            {log.discountDetail}
                            {log.discountAmount > 0 && <span className="text-xs text-red-500 ml-1">(-{formatCurrency(log.discountAmount)})</span>}
                         </td>
                         <td className="px-6 py-4 text-right font-bold text-slate-800">
                            {formatCurrency(log.finalPrice)}
                         </td>
                         <td className="px-6 py-4 text-center">
                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">완료</span>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             )}
          </div>
        )}
      </main>

      {/* Confirmation Modal */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800">결제 내용을 확인해주세요</h3>
              <p className="text-slate-500 text-sm mt-1">이 작업은 취소할 수 없습니다.</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-500">학생</span>
                <span className="font-bold text-slate-800">{selectedStudent?.name}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-500">상품</span>
                <span className="font-bold text-slate-800">{selectedProduct?.name}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-500">할인</span>
                <span className="text-red-500">-{formatCurrency(pricing.discount)}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-lg font-bold text-slate-800">결제 금액</span>
                <span className="text-2xl font-bold text-blue-600">{formatCurrency(pricing.final)}</span>
              </div>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3">
              <button 
                onClick={() => setIsConfirmModalOpen(false)}
                className="flex-1 px-4 py-3 bg-white border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button 
                onClick={confirmPayment}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
              >
                확인 및 결제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
              <Check size={32} strokeWidth={3} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">결제 완료!</h3>
            <p className="text-slate-500 mb-8">
              <span className="font-bold text-slate-800">{selectedStudent?.name}</span>님에게<br/>
              <span className="font-bold text-blue-600">{selectedProduct?.name}</span>이(가)<br/>
              성공적으로 지급되었습니다.
            </p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={resetForm}
                className="w-full px-4 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
              >
                추가 판매하기
              </button>
              <button 
                onClick={() => {
                  resetForm();
                  setActiveTab('logs');
                }}
                className="w-full px-4 py-3 text-slate-500 font-medium hover:text-slate-800 transition-colors"
              >
                로그 확인하러 가기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}