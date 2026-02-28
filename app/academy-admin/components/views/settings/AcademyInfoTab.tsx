"use client";

import { Building2, Link2, Landmark } from 'lucide-react';

export interface AcademyFormData {
  name_kr: string;
  name_en: string;
  address: string;
  contact_number: string;
  description: string;
  instagram_handle: string;
  youtube_url: string;
  naver_map_url: string;
  kakao_channel_url: string;
  bank_name: string;
  bank_account_number: string;
  bank_depositor_name: string;
}

interface AcademyInfoTabProps {
  formData: AcademyFormData;
  setFormData: React.Dispatch<React.SetStateAction<AcademyFormData>>;
  saving: boolean;
  onSaveBasic: (e: React.FormEvent) => void;
  onSaveLinks: (e: React.FormEvent) => void;
  onSaveBankAccount: (e: React.FormEvent) => void;
}

export function AcademyInfoTab({
  formData,
  setFormData,
  saving,
  onSaveBasic,
  onSaveLinks,
  onSaveBankAccount,
}: AcademyInfoTabProps) {
  return (
    <div className="space-y-6">
      {/* 기본 정보 */}
      <section className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-blue-500 dark:text-blue-400 flex-shrink-0" />
            <h3 className="font-bold text-gray-800 dark:text-white">기본 정보</h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">학원명, 주소, 소개 등</p>
        </div>
        <form onSubmit={onSaveBasic} className="px-5 py-5">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">학원명 (한글)</label>
              <input
                type="text"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.name_kr}
                onChange={(e) => setFormData((p) => ({ ...p, name_kr: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">학원명 (영문)</label>
              <input
                type="text"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.name_en}
                onChange={(e) => setFormData((p) => ({ ...p, name_en: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">대표 전화번호</label>
              <input
                type="text"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.contact_number}
                onChange={(e) => setFormData((p) => ({ ...p, contact_number: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">주소</label>
              <input
                type="text"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.address}
                onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">학원 설명</label>
              <textarea
                rows={4}
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white resize-none"
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                placeholder="학원에 대한 상세 설명을 입력하세요..."
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {saving ? '저장 중...' : '기본 정보 저장'}
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* SNS 및 채널 */}
      <section className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Link2 size={18} className="text-green-500 dark:text-green-400 flex-shrink-0" />
            <h3 className="font-bold text-gray-800 dark:text-white">SNS 및 채널</h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">유튜브, 인스타, 지도, 카카오채널 링크</p>
        </div>
        <form onSubmit={onSaveLinks} className="px-5 py-5">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">유튜브 링크</label>
              <input
                type="url"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.youtube_url}
                onChange={(e) => setFormData((p) => ({ ...p, youtube_url: e.target.value }))}
                placeholder="https://www.youtube.com/@채널명"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">인스타그램 링크</label>
              <input
                type="url"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.instagram_handle}
                onChange={(e) => setFormData((p) => ({ ...p, instagram_handle: e.target.value }))}
                placeholder="https://www.instagram.com/계정명"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">네이버지도 링크</label>
              <input
                type="url"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.naver_map_url}
                onChange={(e) => setFormData((p) => ({ ...p, naver_map_url: e.target.value }))}
                placeholder="네이버지도 장소 공유 링크"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">카카오톡 채널 링크</label>
              <input
                type="url"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.kakao_channel_url}
                onChange={(e) => setFormData((p) => ({ ...p, kakao_channel_url: e.target.value }))}
                placeholder="https://pf.kakao.com/..."
              />
            </div>
            <div className="pt-3 border-t border-gray-100 dark:border-neutral-800 space-y-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">알림 설정</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">수강료 납부 알림</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">만료 3일 전 자동 문자 발송</p>
                </div>
                <div className="w-10 h-5 bg-blue-600 dark:bg-blue-500 rounded-full relative cursor-pointer">
                  <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">상담 예약 리마인더</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">상담 당일 오전 10시 알림톡</p>
                </div>
                <div className="w-10 h-5 bg-blue-600 dark:bg-blue-500 rounded-full relative cursor-pointer">
                  <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">강사 급여 정산 알림</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">매월 1일 관리자에게 알림</p>
                </div>
                <div className="w-10 h-5 bg-gray-300 dark:bg-gray-600 rounded-full relative cursor-pointer">
                  <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full" />
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {saving ? '저장 중...' : '링크 설정 저장'}
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* 입금 계좌 정보 */}
      <section className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Landmark size={18} className="text-amber-500 dark:text-amber-400 flex-shrink-0" />
            <h3 className="font-bold text-gray-800 dark:text-white">입금 계좌 정보</h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
            수강권·수업 결제 시 계좌이체로 입금받을 계좌입니다.
          </p>
        </div>
        <form onSubmit={onSaveBankAccount} className="px-5 py-5">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">은행명</label>
              <input
                type="text"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.bank_name}
                onChange={(e) => setFormData((p) => ({ ...p, bank_name: e.target.value }))}
                placeholder="예: 국민은행"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">계좌번호</label>
              <input
                type="text"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.bank_account_number}
                onChange={(e) => setFormData((p) => ({ ...p, bank_account_number: e.target.value }))}
                placeholder="예: 123-45-6789012"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">입금자명(예금주)</label>
              <input
                type="text"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.bank_depositor_name}
                onChange={(e) => setFormData((p) => ({ ...p, bank_depositor_name: e.target.value }))}
                placeholder="예: 홍길동"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-amber-600 dark:bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 dark:hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {saving ? '저장 중...' : '계좌 정보 저장'}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
