'use client';

import { useState } from 'react';

export interface AcademySetupFormData {
  name_kr: string;
  name_en: string;
  address: string;
  contact_number: string;
  hall_name: string;
  hall_capacity: number;
  bank_name: string;
  bank_account_number: string;
  bank_depositor_name: string;
}

const defaultForm: AcademySetupFormData = {
  name_kr: '',
  name_en: '',
  address: '',
  contact_number: '',
  hall_name: '',
  hall_capacity: 1,
  bank_name: '',
  bank_account_number: '',
  bank_depositor_name: '',
};

interface AcademySetupFormProps {
  onSubmit: (data: AcademySetupFormData) => Promise<void>;
  isSubmitting: boolean;
}

export function AcademySetupForm({ onSubmit, isSubmitting }: AcademySetupFormProps) {
  const [form, setForm] = useState<AcademySetupFormData>(defaultForm);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name_kr.trim()) {
      setError('학원 이름(한글)을 입력해 주세요.');
      return;
    }
    if (!form.bank_name.trim() || !form.bank_account_number.trim() || !form.bank_depositor_name.trim()) {
      setError('입금 받을 계좌 정보(은행명, 계좌번호, 입금자명)를 모두 입력해 주세요.');
      return;
    }
    try {
      await onSubmit(form);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '학원 개설에 실패했습니다.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
          학원 이름 (한글) <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.name_kr}
          onChange={(e) => setForm((p) => ({ ...p, name_kr: e.target.value }))}
          className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white px-3 py-2.5"
          placeholder="예: MOVEIT 댄스학원"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
          학원 이름 (영문)
        </label>
        <input
          type="text"
          value={form.name_en}
          onChange={(e) => setForm((p) => ({ ...p, name_en: e.target.value }))}
          className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white px-3 py-2.5"
          placeholder="예: MOVEIT Dance Academy"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
          연락처
        </label>
        <input
          type="text"
          value={form.contact_number}
          onChange={(e) => setForm((p) => ({ ...p, contact_number: e.target.value }))}
          className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white px-3 py-2.5"
          placeholder="02-1234-5678"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
          주소
        </label>
        <input
          type="text"
          value={form.address}
          onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
          className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white px-3 py-2.5"
          placeholder="서울시 강남구 ..."
        />
      </div>
      <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          입금 받을 계좌 정보 <span className="text-red-500">*</span>
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
          수강권·수업 결제 시 계좌이체로 입금받을 계좌입니다. 모두 입력해 주세요.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">은행명</label>
            <input
              type="text"
              value={form.bank_name}
              onChange={(e) => setForm((p) => ({ ...p, bank_name: e.target.value }))}
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white px-3 py-2.5"
              placeholder="예: 국민은행"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">계좌번호</label>
            <input
              type="text"
              value={form.bank_account_number}
              onChange={(e) => setForm((p) => ({ ...p, bank_account_number: e.target.value }))}
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white px-3 py-2.5"
              placeholder="예: 123-45-6789012"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">입금자명(예금주)</label>
            <input
              type="text"
              value={form.bank_depositor_name}
              onChange={(e) => setForm((p) => ({ ...p, bank_depositor_name: e.target.value }))}
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white px-3 py-2.5"
              placeholder="예: 홍길동"
              required
            />
          </div>
        </div>
      </div>
      <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">첫 번째 연습실 (선택)</p>
        <div className="flex gap-3">
          <input
            type="text"
            value={form.hall_name}
            onChange={(e) => setForm((p) => ({ ...p, hall_name: e.target.value }))}
            className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white px-3 py-2.5"
            placeholder="연습실 이름"
          />
          <input
            type="number"
            min={1}
            value={form.hall_capacity}
            onChange={(e) => setForm((p) => ({ ...p, hall_capacity: parseInt(e.target.value, 10) || 1 }))}
            className="w-20 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white px-3 py-2.5"
          />
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">수용 인원</p>
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 rounded-xl font-bold bg-neutral-900 dark:bg-[#CCFF00] text-white dark:text-black hover:opacity-90 disabled:opacity-50"
      >
        {isSubmitting ? '생성 중…' : '학원 생성하기'}
      </button>
    </form>
  );
}
