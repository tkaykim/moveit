"use client";

import { useState, useEffect, useMemo } from 'react';
import { X, Loader2, Phone, Users } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  duration_minutes: number;
}

interface TimeSlot {
  start: string;
  end: string;
}

interface Availability {
  phone: { [key: string]: TimeSlot[] };
  visit: { [key: string]: TimeSlot[] };
}

interface ConsultationRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  academyId: string;
  academyName?: string;
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function ConsultationRequestModal({
  isOpen,
  onClose,
  academyId,
  academyName,
}: ConsultationRequestModalProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [availability, setAvailability] = useState<Availability>({ phone: {}, visit: {} });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    category_id: '',
    detail: '',
    consultation_type: 'visit' as 'phone' | 'visit',
    visit_date: '',
    visit_time: '',
  });

  useEffect(() => {
    if (!isOpen || !academyId) return;
    setLoading(true);
    fetch(`/api/academies/${academyId}/consultation-form-data`)
      .then((r) => r.json())
      .then((res) => {
        if (res.data?.categories) setCategories(res.data.categories);
        if (res.data?.availability) setAvailability(res.data.availability);
      })
      .finally(() => setLoading(false));
  }, [isOpen, academyId]);

  // 선택한 날짜의 요일에 맞는 상담 가능 시간 계산
  const availableTimeSlots = useMemo(() => {
    if (!form.visit_date) return [];
    
    const selectedDate = new Date(form.visit_date);
    const dayIndex = selectedDate.getDay(); // 0 = Sunday
    const dayKey = DAY_KEYS[dayIndex];
    
    const typeAvailability = form.consultation_type === 'phone' 
      ? availability.phone 
      : availability.visit;
    
    const slots = typeAvailability[dayKey];
    if (!slots || slots.length === 0) return [];
    
    // 시간 슬롯 생성 (30분 단위)
    const timeOptions: string[] = [];
    slots.forEach(slot => {
      const [startH, startM] = slot.start.split(':').map(Number);
      const [endH, endM] = slot.end.split(':').map(Number);
      
      let currentH = startH;
      let currentM = startM;
      
      while (currentH < endH || (currentH === endH && currentM < endM)) {
        timeOptions.push(`${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}`);
        currentM += 30;
        if (currentM >= 60) {
          currentH += 1;
          currentM = 0;
        }
      }
    });
    
    return timeOptions;
  }, [form.visit_date, form.consultation_type, availability]);

  // 기본 시간 옵션 (상담 가능 시간이 설정되지 않은 경우)
  const defaultTimeOptions = useMemo(() => {
    const options = [];
    for (let h = 9; h <= 18; h++) {
      for (const m of [0, 30]) {
        if (h === 18 && m === 30) break;
        options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return options;
  }, []);

  // 사용할 시간 옵션 결정
  const timeOptions = availableTimeSlots.length > 0 ? availableTimeSlots : defaultTimeOptions;

  // 상담 가능한 날짜인지 확인
  const isDateAvailable = (dateStr: string) => {
    if (!dateStr) return true;
    const selectedDate = new Date(dateStr);
    const dayIndex = selectedDate.getDay();
    const dayKey = DAY_KEYS[dayIndex];
    
    const typeAvailability = form.consultation_type === 'phone' 
      ? availability.phone 
      : availability.visit;
    
    const slots = typeAvailability[dayKey];
    return slots && slots.length > 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const visit_datetime =
        form.visit_date && form.visit_time
          ? new Date(`${form.visit_date}T${form.visit_time}:00`).toISOString()
          : null;
      const res = await fetch('/api/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academy_id: academyId,
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          category_id: form.category_id || null,
          detail: form.detail.trim() || null,
          visit_datetime,
          topic: form.category_id 
            ? `[${form.consultation_type === 'phone' ? '전화' : '방문'}] ${categories.find((c) => c.id === form.category_id)?.name || '상담 신청'}` 
            : `[${form.consultation_type === 'phone' ? '전화' : '방문'}] 상담 신청`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '신청에 실패했습니다.');
      alert('상담 신청이 접수되었습니다.');
      setForm({ name: '', phone: '', category_id: '', detail: '', consultation_type: 'visit', visit_date: '', visit_time: '' });
      onClose();
    } catch (e: any) {
      alert(e.message || '신청에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const hasPhoneAvailability = Object.keys(availability.phone).length > 0;
  const hasVisitAvailability = Object.keys(availability.visit).length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b dark:border-neutral-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            상담 신청 {academyName ? `· ${academyName}` : ''}
          </h3>
          <button type="button" onClick={onClose} className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">이름 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">연락처</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
              </div>

              {/* 상담 유형 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">상담 유형</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, consultation_type: 'phone', visit_time: '' }))}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                      form.consultation_type === 'phone'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                        : 'border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    <Phone size={18} />
                    <span className="font-medium">전화 상담</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, consultation_type: 'visit', visit_time: '' }))}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                      form.consultation_type === 'visit'
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                        : 'border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    <Users size={18} />
                    <span className="font-medium">방문 상담</span>
                  </button>
                </div>
              </div>

              {categories.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">상담 카테고리</label>
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm((p) => ({ ...p, category_id: e.target.value }))}
                    className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  >
                    <option value="">선택</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.duration_minutes}분)
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">상세 내용</label>
                <textarea
                  value={form.detail}
                  onChange={(e) => setForm((p) => ({ ...p, detail: e.target.value }))}
                  rows={3}
                  placeholder="상담받고 싶은 내용을 자유롭게 작성해주세요"
                  className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    희망 날짜
                  </label>
                  <input
                    type="date"
                    value={form.visit_date}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setForm((p) => ({ ...p, visit_date: e.target.value, visit_time: '' }))}
                    className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                  {form.visit_date && !isDateAvailable(form.visit_date) && (
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                      해당 요일은 {form.consultation_type === 'phone' ? '전화' : '방문'} 상담이 불가합니다
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    희망 시간
                  </label>
                  <select
                    value={form.visit_time}
                    onChange={(e) => setForm((p) => ({ ...p, visit_time: e.target.value }))}
                    disabled={!form.visit_date || !isDateAvailable(form.visit_date)}
                    className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white disabled:opacity-50"
                  >
                    <option value="">선택</option>
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 상담 가능 시간 안내 */}
              {(hasPhoneAvailability || hasVisitAvailability) && (
                <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-neutral-800 rounded-lg p-3">
                  <p className="font-medium mb-1">상담 가능 시간 안내</p>
                  {form.consultation_type === 'phone' && hasPhoneAvailability && (
                    <p>전화 상담: {Object.entries(availability.phone).map(([day, slots]) => {
                      const dayNames: {[key: string]: string} = { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' };
                      return `${dayNames[day]} ${slots[0]?.start}~${slots[0]?.end}`;
                    }).join(', ')}</p>
                  )}
                  {form.consultation_type === 'visit' && hasVisitAvailability && (
                    <p>방문 상담: {Object.entries(availability.visit).map(([day, slots]) => {
                      const dayNames: {[key: string]: string} = { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' };
                      return `${dayNames[day]} ${slots[0]?.start}~${slots[0]?.end}`;
                    }).join(', ')}</p>
                  )}
                </div>
              )}
            </>
          )}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border dark:border-neutral-700 rounded-xl text-gray-700 dark:text-gray-300 font-medium">
              취소
            </button>
            <button
              type="submit"
              disabled={submitting || loading}
              className="flex-1 py-2.5 bg-primary dark:bg-[#CCFF00] text-black font-bold rounded-xl disabled:opacity-50"
            >
              {submitting ? '접수 중...' : '신청하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
