"use client";

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  duration_minutes: number;
}

interface ConsultationRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  academyId: string;
  academyName?: string;
}

export function ConsultationRequestModal({
  isOpen,
  onClose,
  academyId,
  academyName,
}: ConsultationRequestModalProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    category_id: '',
    detail: '',
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
      })
      .finally(() => setLoading(false));
  }, [isOpen, academyId]);

  const timeOptions = [];
  for (let h = 9; h <= 18; h++) {
    for (const m of [0, 30]) {
      if (h === 18 && m === 30) break;
      timeOptions.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }

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
          topic: form.category_id ? categories.find((c) => c.id === form.category_id)?.name || '상담 신청' : '상담 신청',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '신청에 실패했습니다.');
      alert('상담 신청이 접수되었습니다.');
      setForm({ name: '', phone: '', category_id: '', detail: '', visit_date: '', visit_time: '' });
      onClose();
    } catch (e: any) {
      alert(e.message || '신청에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

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
                  className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">방문 희망일</label>
                  <input
                    type="date"
                    value={form.visit_date}
                    onChange={(e) => setForm((p) => ({ ...p, visit_date: e.target.value }))}
                    className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">방문 희망 시각 (30분 단위)</label>
                  <select
                    value={form.visit_time}
                    onChange={(e) => setForm((p) => ({ ...p, visit_time: e.target.value }))}
                    className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  >
                    <option value="">선택</option>
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
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
