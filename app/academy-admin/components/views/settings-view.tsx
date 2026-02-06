"use client";

import { useState, useEffect } from 'react';
import { SectionHeader } from '../common/section-header';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface SettingsViewProps {
  academyId: string;
}

export function SettingsView({ academyId }: SettingsViewProps) {
  const [formData, setFormData] = useState({
    name_kr: '',
    name_en: '',
    address: '',
    contact_number: '',
    description: '',
    instagram_handle: '',
    youtube_url: '',
    naver_map_url: '',
    kakao_channel_url: '',
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

      setFormData({
        name_kr: data.name_kr || '',
        name_en: data.name_en || '',
        address: data.address || '',
        contact_number: data.contact_number || '',
        description: data.description || '',
        instagram_handle: data.instagram_handle || '',
        youtube_url: data.youtube_url || '',
        naver_map_url: data.naver_map_url || '',
        kakao_channel_url: data.kakao_channel_url || '',
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
      const payload = {
        name_kr: formData.name_kr,
        name_en: formData.name_en,
        address: formData.address,
        contact_number: formData.contact_number,
        description: formData.description,
        instagram_handle: formData.instagram_handle.trim() ? formData.instagram_handle.trim() : null,
        youtube_url: formData.youtube_url.trim() ? formData.youtube_url.trim() : null,
        naver_map_url: formData.naver_map_url.trim() ? formData.naver_map_url.trim() : null,
        kakao_channel_url: formData.kakao_channel_url.trim() ? formData.kakao_channel_url.trim() : null,
      };
      const { error } = await supabase
        .from('academies')
        .update(payload)
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
    <div className="space-y-6" data-onboarding="page-settings-0">
      <SectionHeader title="시스템 설정" />

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800">
          <h3 className="font-bold text-lg mb-4 text-gray-800 dark:text-white">학원 기본 정보</h3>
          <div className="space-y-4">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                학원 설명
              </label>
              <textarea
                rows={6}
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white resize-none"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="학원에 대한 상세 설명을 입력하세요..."
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                학원 소개, 특징, 운영 방식 등을 자유롭게 작성하세요.
              </p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {saving ? '저장 중...' : '정보 수정 저장'}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-neutral-800">
          <h3 className="font-bold text-lg mb-4 text-gray-800 dark:text-white">
            링크 및 채널 설정
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                유튜브 링크
              </label>
              <input
                type="url"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.youtube_url}
                onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
                placeholder="https://www.youtube.com/@채널명 또는 영상 URL"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                인스타그램 링크
              </label>
              <input
                type="url"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.instagram_handle}
                onChange={(e) => setFormData({ ...formData, instagram_handle: e.target.value })}
                placeholder="https://www.instagram.com/계정명"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                네이버지도 링크
              </label>
              <input
                type="url"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.naver_map_url}
                onChange={(e) => setFormData({ ...formData, naver_map_url: e.target.value })}
                placeholder="네이버지도 장소 공유 링크"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                카카오톡 채널 링크
              </label>
              <input
                type="url"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.kakao_channel_url}
                onChange={(e) => setFormData({ ...formData, kakao_channel_url: e.target.value })}
                placeholder="https://pf.kakao.com/..."
              />
            </div>

            <div className="pt-4 border-t border-gray-100 dark:border-neutral-800">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                링크는 저장 버튼을 누르면 함께 반영됩니다.
              </p>
            </div>

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
      </form>
    </div>
  );
}
