"use client";

import { useState, useEffect } from 'react';
import { MoreHorizontal, Clock, Calendar, CheckCircle, Plus, Tag, Trash2, Loader2 } from 'lucide-react';
import { SectionHeader } from '../common/section-header';
import { ConsultationModal } from './consultations/consultation-modal';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface ConsultationViewProps {
  academyId: string;
}

interface Consultation {
  id: string;
  name: string;
  phone?: string | null;
  topic: string;
  status: 'NEW' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  scheduled_at?: string | null;
  assigned_to?: string | null;
  users?: {
    name?: string | null;
  } | null;
  created_at: string;
}

interface ConsultationCategory {
  id: string;
  name: string;
  duration_minutes: number;
  display_order: number | null;
}

export function ConsultationView({ academyId }: ConsultationViewProps) {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  const [categories, setCategories] = useState<ConsultationCategory[]>([]);
  const [categoryName, setCategoryName] = useState('');
  const [categoryMinutes, setCategoryMinutes] = useState(30);
  const [presetLoading, setPresetLoading] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(false);

  useEffect(() => {
    loadConsultations();
  }, [academyId]);

  const loadCategories = async () => {
    try {
      const res = await fetch(`/api/consultation-categories?academyId=${academyId}`);
      const data = await res.json();
      if (res.ok) setCategories(data.data || []);
    } catch {
      setCategories([]);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [academyId]);

  const loadConsultations = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('consultations')
        .select(`
          *,
          users!consultations_assigned_to_fkey (
            name
          )
        `)
        .eq('academy_id', academyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConsultations(data || []);
    } catch (error) {
      console.error('Error loading consultations:', error);
    } finally {
      setLoading(false);
    }
  };

  const newConsultations = consultations.filter((c) => c.status === 'NEW');
  const scheduledConsultations = consultations.filter((c) => c.status === 'SCHEDULED');
  const completedConsultations = consultations.filter((c) => c.status === 'COMPLETED');

  const handleStatusChange = async (id: string, newStatus: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('consultations')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      loadConsultations();
    } catch (error: any) {
      console.error('Error updating consultation:', error);
      alert(`상태 변경에 실패했습니다: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">로딩 중...</div>
      </div>
    );
  }

  const applyPreset = async () => {
    setPresetLoading(true);
    try {
      const res = await fetch(`/api/consultation-categories/preset?academyId=${academyId}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '적용 실패');
      alert('프리셋이 적용되었습니다. (입시반 30분, 오디션반 30분, 전문반 30분, 일반 상담 10분)');
      loadCategories();
    } catch (e: any) {
      alert(e.message || '적용 실패');
    } finally {
      setPresetLoading(false);
    }
  };

  const addCategory = async () => {
    if (!categoryName.trim()) return;
    setCategoryLoading(true);
    try {
      const res = await fetch('/api/consultation-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academy_id: academyId, name: categoryName.trim(), duration_minutes: categoryMinutes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '추가 실패');
      setCategoryName('');
      setCategoryMinutes(30);
      loadCategories();
    } catch (e: any) {
      alert(e.message || '추가 실패');
    } finally {
      setCategoryLoading(false);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('이 카테고리를 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/consultation-categories/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('삭제 실패');
      loadCategories();
    } catch (e: any) {
      alert(e.message || '삭제 실패');
    }
  };

  return (
    <>
      <div className="h-full flex flex-col" data-onboarding="page-consultations-0">
        <SectionHeader
          title="상담 및 리드 관리 (Kanban)"
          buttonText="상담 추가"
          onButtonClick={() => {
            setSelectedConsultation(null);
            setShowModal(true);
          }}
        />

        <div className="mb-4 p-4 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800">
          <h4 className="font-bold text-sm text-gray-800 dark:text-white mb-2 flex items-center gap-2">
            <Tag size={16} /> 상담 카테고리
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            학원 상세 페이지 상담 신청 시 선택할 수 있는 카테고리입니다. 프리셋: 입시반 30분, 오디션반 30분, 전문반 30분, 일반 상담 10분
          </p>
          {categories.length === 0 && (
            <button
              type="button"
              onClick={applyPreset}
              disabled={presetLoading}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
            >
              {presetLoading ? '적용 중...' : '프리셋 적용 (입시반·오디션반·전문반·일반 상담)'}
            </button>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {categories.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-neutral-800 text-sm"
              >
                {c.name} ({c.duration_minutes}분)
                <button type="button" onClick={() => deleteCategory(c.id)} className="text-red-500 hover:text-red-600 p-0.5">
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              placeholder="카테고리 이름"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="px-2 py-1.5 border dark:border-neutral-700 rounded text-sm w-32 bg-white dark:bg-neutral-800"
            />
            <input
              type="number"
              min={5}
              max={120}
              value={categoryMinutes}
              onChange={(e) => setCategoryMinutes(Number(e.target.value) || 30)}
              className="px-2 py-1.5 border dark:border-neutral-700 rounded text-sm w-20 bg-white dark:bg-neutral-800"
            />
            <span className="text-sm self-center text-gray-500">분</span>
            <button
              type="button"
              onClick={addCategory}
              disabled={categoryLoading || !categoryName.trim()}
              className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm disabled:opacity-50"
            >
              추가
            </button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 overflow-y-auto sm:overflow-hidden pb-6">
          {/* 1. 신규 문의 */}
          <div className="bg-gray-100 dark:bg-neutral-800 rounded-xl p-3 sm:p-4 flex flex-col sm:h-full min-h-[300px] sm:min-h-0 border border-gray-200 dark:border-neutral-700">
            <div className="flex justify-between items-center mb-3 sm:mb-4 px-1">
              <h3 className="font-bold text-sm sm:text-base text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-400 dark:bg-yellow-500"></div> 신규 문의
              </h3>
              <span className="bg-white dark:bg-neutral-900 text-gray-600 dark:text-gray-400 text-xs px-2 py-1 rounded-full border dark:border-neutral-700">
                {newConsultations.length}
              </span>
            </div>
            <div className="space-y-2 sm:space-y-3 overflow-y-auto pr-1 sm:pr-2 flex-1">
              {newConsultations.map((item) => (
                <div
                  key={item.id}
                  className="bg-white dark:bg-neutral-900 p-3 sm:p-4 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow border-l-4 border-yellow-400 dark:border-yellow-500 group"
                  onClick={() => {
                    setSelectedConsultation(item);
                    setShowModal(true);
                  }}
                >
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-sm sm:text-base text-gray-800 dark:text-white flex-1 pr-2">{item.name}</h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedConsultation(item);
                        setShowModal(true);
                      }}
                      className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 flex-shrink-0"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{item.topic}</p>
                  <div className="flex justify-between items-center mt-2 sm:mt-3 text-xs text-gray-400 dark:text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> <span className="hidden sm:inline">{new Date(item.created_at).toLocaleDateString('ko-KR')}</span>
                      <span className="sm:hidden">{new Date(item.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                    </span>
                    <span className="bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400 text-[10px] sm:text-xs">
                      {item.users?.name || '-'}
                    </span>
                  </div>
                </div>
              ))}
              <button
                onClick={() => {
                  setSelectedConsultation(null);
                  setShowModal(true);
                }}
                className="w-full py-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-lg border border-dashed border-gray-300 dark:border-neutral-600 transition-colors"
              >
                + 카드 추가
              </button>
            </div>
          </div>

          {/* 2. 상담 예정 */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 sm:p-4 flex flex-col sm:h-full min-h-[300px] sm:min-h-0 border border-blue-100 dark:border-blue-900/30">
            <div className="flex justify-between items-center mb-3 sm:mb-4 px-1">
              <h3 className="font-bold text-sm sm:text-base text-blue-800 dark:text-blue-400 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400"></div> 상담 예정
              </h3>
              <span className="bg-white dark:bg-neutral-900 text-blue-700 dark:text-blue-400 text-xs px-2 py-1 rounded-full border border-blue-100 dark:border-blue-900/30">
                {scheduledConsultations.length}
              </span>
            </div>
            <div className="space-y-2 sm:space-y-3 overflow-y-auto pr-1 sm:pr-2 flex-1">
              {scheduledConsultations.map((item) => (
                <div
                  key={item.id}
                  className="bg-white dark:bg-neutral-900 p-3 sm:p-4 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow border-l-4 border-blue-500 dark:border-blue-400"
                  onClick={() => {
                    setSelectedConsultation(item);
                    setShowModal(true);
                  }}
                >
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-sm sm:text-base text-gray-800 dark:text-white flex-1 pr-2">{item.name}</h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedConsultation(item);
                        setShowModal(true);
                      }}
                      className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 flex-shrink-0"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{item.topic}</p>
                  <div className="flex justify-between items-center mt-2 sm:mt-3 text-xs text-gray-400 dark:text-gray-500">
                    <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                      <Calendar size={12} />{' '}
                      {item.scheduled_at
                        ? (
                          <>
                            <span className="hidden sm:inline">{new Date(item.scheduled_at).toLocaleString('ko-KR')}</span>
                            <span className="sm:hidden">{new Date(item.scheduled_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                          </>
                        )
                        : '-'}
                    </span>
                    <span className="bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400 text-[10px] sm:text-xs">
                      {item.users?.name || '-'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. 등록 완료 */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 sm:p-4 flex flex-col sm:h-full min-h-[300px] sm:min-h-0 border border-green-100 dark:border-green-900/30">
            <div className="flex justify-between items-center mb-3 sm:mb-4 px-1">
              <h3 className="font-bold text-sm sm:text-base text-green-800 dark:text-green-400 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 dark:bg-green-400"></div> 등록/결제 완료
              </h3>
              <span className="bg-white dark:bg-neutral-900 text-green-700 dark:text-green-400 text-xs px-2 py-1 rounded-full border border-green-100 dark:border-green-900/30">
                {completedConsultations.length}
              </span>
            </div>
            <div className="space-y-2 sm:space-y-3 overflow-y-auto pr-1 sm:pr-2 flex-1">
              {completedConsultations.map((item) => (
                <div
                  key={item.id}
                  className="bg-white dark:bg-neutral-900 p-3 sm:p-4 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow border-l-4 border-green-500 dark:border-green-400 opacity-80 hover:opacity-100"
                  onClick={() => {
                    setSelectedConsultation(item);
                    setShowModal(true);
                  }}
                >
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-sm sm:text-base text-gray-800 dark:text-white flex-1 pr-2">{item.name}</h4>
                    <CheckCircle size={16} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{item.topic}</p>
                  <div className="flex justify-between items-center mt-2 sm:mt-3 text-xs text-gray-400 dark:text-gray-500">
                    <span>
                      <span className="hidden sm:inline">{new Date(item.created_at).toLocaleDateString('ko-KR')}</span>
                      <span className="sm:hidden">{new Date(item.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                    </span>
                    <span className="bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400 text-[10px] sm:text-xs">
                      {item.users?.name || '-'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <ConsultationModal
          academyId={academyId}
          consultation={selectedConsultation}
          onClose={() => {
            setShowModal(false);
            setSelectedConsultation(null);
            loadConsultations();
          }}
        />
      )}
    </>
  );
}
