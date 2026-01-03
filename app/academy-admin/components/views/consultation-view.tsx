"use client";

import { useState, useEffect } from 'react';
import { MoreHorizontal, Clock, Calendar, CheckCircle, Plus } from 'lucide-react';
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

export function ConsultationView({ academyId }: ConsultationViewProps) {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);

  useEffect(() => {
    loadConsultations();
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

  return (
    <>
      <div className="h-full flex flex-col">
        <SectionHeader
          title="상담 및 리드 관리 (Kanban)"
          buttonText="상담 추가"
          onButtonClick={() => {
            setSelectedConsultation(null);
            setShowModal(true);
          }}
        />

        <div className="flex-1 grid grid-cols-3 gap-6 overflow-hidden pb-6">
          {/* 1. 신규 문의 */}
          <div className="bg-gray-100 dark:bg-neutral-800 rounded-xl p-4 flex flex-col h-full border border-gray-200 dark:border-neutral-700">
            <div className="flex justify-between items-center mb-4 px-1">
              <h3 className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-400 dark:bg-yellow-500"></div> 신규 문의
              </h3>
              <span className="bg-white dark:bg-neutral-900 text-gray-600 dark:text-gray-400 text-xs px-2 py-1 rounded-full border dark:border-neutral-700">
                {newConsultations.length}
              </span>
            </div>
            <div className="space-y-3 overflow-y-auto pr-2">
              {newConsultations.map((item) => (
                <div
                  key={item.id}
                  className="bg-white dark:bg-neutral-900 p-4 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow border-l-4 border-yellow-400 dark:border-yellow-500 group"
                  onClick={() => {
                    setSelectedConsultation(item);
                    setShowModal(true);
                  }}
                >
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-gray-800 dark:text-white">{item.name}</h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedConsultation(item);
                        setShowModal(true);
                      }}
                      className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{item.topic}</p>
                  <div className="flex justify-between items-center mt-3 text-xs text-gray-400 dark:text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {new Date(item.created_at).toLocaleDateString('ko-KR')}
                    </span>
                    <span className="bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400">
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
                className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-lg border border-dashed border-gray-300 dark:border-neutral-600 transition-colors"
              >
                + 카드 추가
              </button>
            </div>
          </div>

          {/* 2. 상담 예정 */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 flex flex-col h-full border border-blue-100 dark:border-blue-900/30">
            <div className="flex justify-between items-center mb-4 px-1">
              <h3 className="font-bold text-blue-800 dark:text-blue-400 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400"></div> 상담 예정
              </h3>
              <span className="bg-white dark:bg-neutral-900 text-blue-700 dark:text-blue-400 text-xs px-2 py-1 rounded-full border border-blue-100 dark:border-blue-900/30">
                {scheduledConsultations.length}
              </span>
            </div>
            <div className="space-y-3 overflow-y-auto pr-2">
              {scheduledConsultations.map((item) => (
                <div
                  key={item.id}
                  className="bg-white dark:bg-neutral-900 p-4 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow border-l-4 border-blue-500 dark:border-blue-400"
                  onClick={() => {
                    setSelectedConsultation(item);
                    setShowModal(true);
                  }}
                >
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-gray-800 dark:text-white">{item.name}</h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedConsultation(item);
                        setShowModal(true);
                      }}
                      className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{item.topic}</p>
                  <div className="flex justify-between items-center mt-3 text-xs text-gray-400 dark:text-gray-500">
                    <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                      <Calendar size={12} />{' '}
                      {item.scheduled_at
                        ? new Date(item.scheduled_at).toLocaleString('ko-KR')
                        : '-'}
                    </span>
                    <span className="bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400">
                      {item.users?.name || '-'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. 등록 완료 */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 flex flex-col h-full border border-green-100 dark:border-green-900/30">
            <div className="flex justify-between items-center mb-4 px-1">
              <h3 className="font-bold text-green-800 dark:text-green-400 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 dark:bg-green-400"></div> 등록/결제 완료
              </h3>
              <span className="bg-white dark:bg-neutral-900 text-green-700 dark:text-green-400 text-xs px-2 py-1 rounded-full border border-green-100 dark:border-green-900/30">
                {completedConsultations.length}
              </span>
            </div>
            <div className="space-y-3 overflow-y-auto pr-2">
              {completedConsultations.map((item) => (
                <div
                  key={item.id}
                  className="bg-white dark:bg-neutral-900 p-4 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow border-l-4 border-green-500 dark:border-green-400 opacity-80 hover:opacity-100"
                  onClick={() => {
                    setSelectedConsultation(item);
                    setShowModal(true);
                  }}
                >
                  <div className="flex justify-between">
                    <h4 className="font-bold text-gray-800 dark:text-white">{item.name}</h4>
                    <CheckCircle size={16} className="text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{item.topic}</p>
                  <div className="flex justify-between items-center mt-3 text-xs text-gray-400 dark:text-gray-500">
                    <span>{new Date(item.created_at).toLocaleDateString('ko-KR')}</span>
                    <span className="bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400">
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
