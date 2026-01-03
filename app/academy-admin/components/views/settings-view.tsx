"use client";

import { useState, useEffect } from 'react';
import { SectionHeader } from '../common/section-header';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface SettingsViewProps {
  academyId: string;
}

export function SettingsView({ academyId }: SettingsViewProps) {
  const [academy, setAcademy] = useState<any>(null);
  const [formData, setFormData] = useState({
    name_kr: '',
    name_en: '',
    address: '',
    contact_number: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAcademy();
  }, [academyId]);

  const loadAcademy = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('academies')
        .select('*')
        .eq('id', academyId)
        .single();

      if (error) throw error;

      setAcademy(data);
      setFormData({
        name_kr: data.name_kr || '',
        name_en: data.name_en || '',
        address: data.address || '',
        contact_number: data.contact_number || '',
      });
    } catch (error) {
      console.error('Error loading academy:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const supabase = getSupabaseClient();
    if (!supabase) {
      alert('데이터베이스 연결에 실패했습니다.');
      setSaving(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('academies')
        .update(formData)
        .eq('id', academyId);

      if (error) throw error;
      alert('학원 정보가 수정되었습니다.');
      loadAcademy();
    } catch (error: any) {
      console.error('Error updating academy:', error);
      alert(`정보 수정에 실패했습니다: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="시스템 설정" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800">
          <h3 className="font-bold text-lg mb-4 text-gray-800 dark:text-white">학원 기본 정보</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                학원명 (한글)
              </label>
              <input
                type="text"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.name_kr}
                onChange={(e) => setFormData({ ...formData, name_kr: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                학원명 (영문)
              </label>
              <input
                type="text"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.name_en}
                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                대표 전화번호
              </label>
              <input
                type="text"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.contact_number}
                onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                주소
              </label>
              <input
                type="text"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {saving ? '저장 중...' : '정보 수정 저장'}
            </button>
          </form>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-neutral-800">
          <h3 className="font-bold text-lg mb-4 text-gray-800 dark:text-white">
            알림 및 자동화 설정
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800 dark:text-white">수강료 납부 알림</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  만료 3일 전 자동 문자 발송
                </p>
              </div>
              <div className="w-10 h-5 bg-blue-600 dark:bg-blue-500 rounded-full relative cursor-pointer">
                <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800 dark:text-white">상담 예약 리마인더</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  상담 당일 오전 10시 알림톡
                </p>
              </div>
              <div className="w-10 h-5 bg-blue-600 dark:bg-blue-500 rounded-full relative cursor-pointer">
                <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800 dark:text-white">강사 급여 정산 알림</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">매월 1일 관리자에게 알림</p>
              </div>
              <div className="w-10 h-5 bg-gray-300 dark:bg-gray-600 rounded-full relative cursor-pointer">
                <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
