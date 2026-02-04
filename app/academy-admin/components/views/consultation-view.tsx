"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  MoreHorizontal, Clock, Calendar, CheckCircle, Plus, Tag, Trash2, 
  LayoutDashboard, Columns3, List, Settings, Search, Filter,
  CalendarDays, Users, TrendingUp, Phone, AlertCircle, ChevronRight
} from 'lucide-react';
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
  visit_datetime?: string | null;
  assigned_to?: string | null;
  category_id?: string | null;
  detail?: string | null;
  users?: {
    name?: string | null;
  } | null;
  consultation_categories?: {
    name?: string | null;
  } | null;
  created_at: string;
  notes?: string | null;
}

interface ConsultationAvailability {
  phone: {
    [key: string]: { start: string; end: string }[];
  };
  visit: {
    [key: string]: { start: string; end: string }[];
  };
}

interface ConsultationCategory {
  id: string;
  name: string;
  duration_minutes: number;
  display_order: number | null;
}

type TabType = 'dashboard' | 'kanban' | 'list' | 'settings';

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
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [availability, setAvailability] = useState<ConsultationAvailability>({
    phone: {},
    visit: {}
  });
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
  const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

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
    loadAvailability();
  }, [academyId]);

  const loadAvailability = async () => {
    try {
      const res = await fetch(`/api/academies/${academyId}/consultation-availability`);
      const data = await res.json();
      if (res.ok && data.data) {
        setAvailability(data.data);
      }
    } catch {
      // ignore
    }
  };

  const saveAvailability = async (newAvailability: ConsultationAvailability) => {
    setAvailabilityLoading(true);
    try {
      const res = await fetch(`/api/academies/${academyId}/consultation-availability`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAvailability),
      });
      if (!res.ok) throw new Error('저장 실패');
      setAvailability(newAvailability);
      alert('상담 가능 시간이 저장되었습니다.');
    } catch (e: any) {
      alert(e.message || '저장 실패');
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const toggleDayTime = (type: 'phone' | 'visit', dayKey: string) => {
    const current = availability[type][dayKey];
    const newAvailability = { ...availability };
    
    if (current && current.length > 0) {
      // 제거
      newAvailability[type] = { ...newAvailability[type] };
      delete newAvailability[type][dayKey];
    } else {
      // 기본값 추가
      newAvailability[type] = {
        ...newAvailability[type],
        [dayKey]: [{ start: '09:00', end: '18:00' }]
      };
    }
    setAvailability(newAvailability);
  };

  const updateDayTime = (type: 'phone' | 'visit', dayKey: string, field: 'start' | 'end', value: string) => {
    const newAvailability = { ...availability };
    if (!newAvailability[type][dayKey]) {
      newAvailability[type][dayKey] = [{ start: '09:00', end: '18:00' }];
    }
    newAvailability[type] = {
      ...newAvailability[type],
      [dayKey]: [{ ...newAvailability[type][dayKey][0], [field]: value }]
    };
    setAvailability(newAvailability);
  };

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
          ),
          consultation_categories (
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

  // 상담 필터링
  const newConsultations = consultations.filter((c) => c.status === 'NEW');
  const scheduledConsultations = consultations.filter((c) => c.status === 'SCHEDULED');
  const completedConsultations = consultations.filter((c) => c.status === 'COMPLETED');

  // 오늘/내일 예정 상담
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfterTomorrow = new Date(today);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

  const todayConsultations = useMemo(() => {
    return scheduledConsultations.filter((c) => {
      if (!c.scheduled_at) return false;
      const scheduledDate = new Date(c.scheduled_at);
      return scheduledDate >= today && scheduledDate < tomorrow;
    }).sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());
  }, [scheduledConsultations, today, tomorrow]);

  const tomorrowConsultations = useMemo(() => {
    return scheduledConsultations.filter((c) => {
      if (!c.scheduled_at) return false;
      const scheduledDate = new Date(c.scheduled_at);
      return scheduledDate >= tomorrow && scheduledDate < dayAfterTomorrow;
    }).sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());
  }, [scheduledConsultations, tomorrow, dayAfterTomorrow]);

  // 리스트용 필터링
  const filteredConsultations = useMemo(() => {
    return consultations.filter((c) => {
      const matchesSearch = searchQuery === '' || 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.phone && c.phone.includes(searchQuery));
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [consultations, searchQuery, statusFilter]);

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">신규 문의</span>;
      case 'SCHEDULED':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">상담 예정</span>;
      case 'COMPLETED':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">등록 완료</span>;
      case 'CANCELLED':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400">취소</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">로딩 중...</div>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard' as TabType, label: '대시보드', icon: LayoutDashboard },
    { id: 'kanban' as TabType, label: '칸반 보드', icon: Columns3 },
    { id: 'list' as TabType, label: '상담 목록', icon: List },
    { id: 'settings' as TabType, label: '설정', icon: Settings },
  ];

  return (
    <>
      <div className="h-full flex flex-col" data-onboarding="page-consultations-0">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">상담 및 리드 관리</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">상담 신청을 관리하고 고객을 추적하세요</p>
          </div>
          <button
            onClick={() => {
              setSelectedConsultation(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-600/25"
          >
            <Plus size={18} />
            상담 추가
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-neutral-800 rounded-xl mb-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        <div className="flex-1 overflow-hidden">
          {/* 대시보드 탭 */}
          {activeTab === 'dashboard' && (
            <div className="h-full overflow-y-auto space-y-6 pb-6">
              {/* 통계 카드 */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 border border-gray-200 dark:border-neutral-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{newConsultations.length}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">신규 문의</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 border border-gray-200 dark:border-neutral-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <CalendarDays className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{scheduledConsultations.length}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">상담 예정</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 border border-gray-200 dark:border-neutral-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{completedConsultations.length}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">등록 완료</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 border border-gray-200 dark:border-neutral-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{consultations.length}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">전체 상담</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 오늘/내일 예정 상담 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 오늘 예정 상담 */}
                <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">오늘 예정 상담</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{today.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      {todayConsultations.length}건
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-neutral-800 max-h-[300px] overflow-y-auto">
                    {todayConsultations.length === 0 ? (
                      <div className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                        <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">오늘 예정된 상담이 없습니다</p>
                      </div>
                    ) : (
                      todayConsultations.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedConsultation(c);
                            setShowModal(true);
                          }}
                          className="px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer transition-colors flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                              <span className="text-blue-700 dark:text-blue-400 font-semibold text-sm">{c.name.charAt(0)}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white truncate">{c.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{c.topic}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                              {new Date(c.scheduled_at!).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <ChevronRight size={16} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 내일 예정 상담 */}
                <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">내일 예정 상담</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{tomorrow.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                      {tomorrowConsultations.length}건
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-neutral-800 max-h-[300px] overflow-y-auto">
                    {tomorrowConsultations.length === 0 ? (
                      <div className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                        <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">내일 예정된 상담이 없습니다</p>
                      </div>
                    ) : (
                      tomorrowConsultations.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedConsultation(c);
                            setShowModal(true);
                          }}
                          className="px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer transition-colors flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                              <span className="text-indigo-700 dark:text-indigo-400 font-semibold text-sm">{c.name.charAt(0)}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white truncate">{c.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{c.topic}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                              {new Date(c.scheduled_at!).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <ChevronRight size={16} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* 신규 문의 (빠른 액션) */}
              {newConsultations.length > 0 && (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl border border-yellow-200 dark:border-yellow-900/30 overflow-hidden">
                  <div className="px-5 py-4 border-b border-yellow-200 dark:border-yellow-900/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-yellow-500 flex items-center justify-center">
                        <AlertCircle className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">처리 필요: 신규 문의</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">빠른 응대가 필요한 신규 상담 신청</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('kanban')}
                      className="text-sm text-yellow-700 dark:text-yellow-400 hover:underline font-medium"
                    >
                      모두 보기 →
                    </button>
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {newConsultations.slice(0, 6).map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedConsultation(c);
                          setShowModal(true);
                        }}
                        className="bg-white dark:bg-neutral-900 p-4 rounded-lg border border-gray-200 dark:border-neutral-700 cursor-pointer hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 dark:text-white truncate">{c.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">{c.topic}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(c.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                          </span>
                          {c.phone && (
                            <span className="flex items-center gap-1">
                              <Phone size={12} />
                              {c.phone}
                            </span>
                          )}
                        </div>
                        {c.visit_datetime && (
                          <div className="mt-2 text-xs text-orange-600 dark:text-orange-400 font-medium flex items-center gap-1">
                            <Calendar size={12} />
                            희망: {new Date(c.visit_datetime).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 칸반 보드 탭 */}
          {activeTab === 'kanban' && (
            <div className="h-full grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 overflow-y-auto sm:overflow-hidden pb-6">
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
                      {item.visit_datetime && (
                        <div className="mt-2 text-xs text-orange-600 dark:text-orange-400 font-medium flex items-center gap-1">
                          <Calendar size={12} />
                          희망: {new Date(item.visit_datetime).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
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
          )}

          {/* 상담 목록 탭 */}
          {activeTab === 'list' && (
            <div className="h-full flex flex-col">
              {/* 검색 및 필터 */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="이름, 주제, 전화번호 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="pl-10 pr-8 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                  >
                    <option value="all">전체 상태</option>
                    <option value="NEW">신규 문의</option>
                    <option value="SCHEDULED">상담 예정</option>
                    <option value="COMPLETED">등록 완료</option>
                    <option value="CANCELLED">취소</option>
                  </select>
                </div>
              </div>

              {/* 테이블 */}
              <div className="flex-1 overflow-auto bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-gray-50 dark:bg-neutral-800 sticky top-0">
                    <tr>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">고객 정보</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">상담 주제</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">상태</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">희망 일시</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">확정 일시</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">담당자</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                    {filteredConsultations.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-gray-500 dark:text-gray-400">
                          <List className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>검색 결과가 없습니다</p>
                        </td>
                      </tr>
                    ) : (
                      filteredConsultations.map((c) => (
                        <tr
                          key={c.id}
                          onClick={() => {
                            setSelectedConsultation(c);
                            setShowModal(true);
                          }}
                          className="hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-neutral-700 flex items-center justify-center flex-shrink-0">
                                <span className="text-gray-700 dark:text-gray-300 font-semibold text-sm">{c.name.charAt(0)}</span>
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">{c.name}</p>
                                {c.phone && <p className="text-xs text-gray-500 dark:text-gray-400">{c.phone}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-1">{c.topic}</p>
                            {c.consultation_categories?.name && (
                              <span className="text-xs text-blue-600 dark:text-blue-400">{c.consultation_categories.name}</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            {getStatusBadge(c.status)}
                          </td>
                          <td className="px-5 py-4">
                            {c.visit_datetime ? (
                              <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                                {new Date(c.visit_datetime).toLocaleString('ko-KR', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            {c.scheduled_at ? (
                              <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                                {new Date(c.scheduled_at).toLocaleString('ko-KR', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-sm text-gray-700 dark:text-gray-300">{c.users?.name || '-'}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 설정 탭 */}
          {activeTab === 'settings' && (
            <div className="h-full overflow-y-auto pb-6">
              <div className="max-w-2xl">
                {/* 상담 카테고리 설정 */}
                <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-100 dark:border-neutral-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Tag className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">상담 카테고리</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">학원 상세 페이지에서 상담 신청 시 선택할 수 있는 카테고리입니다</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 space-y-5">
                    {/* 프리셋 적용 */}
                    {categories.length === 0 && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-900/30">
                        <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
                          아직 카테고리가 없습니다. 기본 프리셋을 적용해보세요.
                        </p>
                        <button
                          type="button"
                          onClick={applyPreset}
                          disabled={presetLoading}
                          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          {presetLoading ? '적용 중...' : '프리셋 적용 (입시반·오디션반·전문반·일반 상담)'}
                        </button>
                      </div>
                    )}

                    {/* 기존 카테고리 목록 */}
                    {categories.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          등록된 카테고리
                        </label>
                        <div className="space-y-2">
                          {categories.map((c) => (
                            <div
                              key={c.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-neutral-800 border border-gray-100 dark:border-neutral-700"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-600 flex items-center justify-center">
                                  <Tag size={14} className="text-gray-500 dark:text-gray-400" />
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-white">{c.name}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">소요시간: {c.duration_minutes}분</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => deleteCategory(c.id)}
                                className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 카테고리 추가 */}
                    <div className="pt-4 border-t border-gray-100 dark:border-neutral-800">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        새 카테고리 추가
                      </label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="text"
                          placeholder="카테고리 이름"
                          value={categoryName}
                          onChange={(e) => setCategoryName(e.target.value)}
                          className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={5}
                            max={120}
                            value={categoryMinutes}
                            onChange={(e) => setCategoryMinutes(Number(e.target.value) || 30)}
                            className="w-20 px-3 py-2.5 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
                          />
                          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">분</span>
                        </div>
                        <button
                          type="button"
                          onClick={addCategory}
                          disabled={categoryLoading || !categoryName.trim()}
                          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                          {categoryLoading ? '추가 중...' : '추가'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 상담 가능 시간 설정 */}
                <div className="mt-6 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-100 dark:border-neutral-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">상담 가능 시간</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">요일별로 전화/방문 상담 가능 시간을 설정하세요</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* 전화 상담 가능 시간 */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Phone size={16} className="text-blue-600 dark:text-blue-400" />
                        <label className="text-sm font-semibold text-gray-900 dark:text-white">전화 상담 가능 시간</label>
                      </div>
                      <div className="space-y-2">
                        {DAY_KEYS.map((dayKey, idx) => {
                          const isActive = availability.phone[dayKey] && availability.phone[dayKey].length > 0;
                          const times = availability.phone[dayKey]?.[0] || { start: '09:00', end: '18:00' };
                          return (
                            <div key={dayKey} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-neutral-800">
                              <button
                                type="button"
                                onClick={() => toggleDayTime('phone', dayKey)}
                                className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${
                                  isActive
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 dark:bg-neutral-700 text-gray-500 dark:text-gray-400'
                                }`}
                              >
                                {DAYS[idx]}
                              </button>
                              {isActive ? (
                                <div className="flex items-center gap-2 flex-1">
                                  <input
                                    type="time"
                                    value={times.start}
                                    onChange={(e) => updateDayTime('phone', dayKey, 'start', e.target.value)}
                                    className="px-3 py-2 border border-gray-200 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                                  />
                                  <span className="text-gray-400">~</span>
                                  <input
                                    type="time"
                                    value={times.end}
                                    onChange={(e) => updateDayTime('phone', dayKey, 'end', e.target.value)}
                                    className="px-3 py-2 border border-gray-200 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                                  />
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400">휴무</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 방문 상담 가능 시간 */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Users size={16} className="text-purple-600 dark:text-purple-400" />
                        <label className="text-sm font-semibold text-gray-900 dark:text-white">방문 상담 가능 시간</label>
                      </div>
                      <div className="space-y-2">
                        {DAY_KEYS.map((dayKey, idx) => {
                          const isActive = availability.visit[dayKey] && availability.visit[dayKey].length > 0;
                          const times = availability.visit[dayKey]?.[0] || { start: '09:00', end: '18:00' };
                          return (
                            <div key={dayKey} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-neutral-800">
                              <button
                                type="button"
                                onClick={() => toggleDayTime('visit', dayKey)}
                                className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${
                                  isActive
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-200 dark:bg-neutral-700 text-gray-500 dark:text-gray-400'
                                }`}
                              >
                                {DAYS[idx]}
                              </button>
                              {isActive ? (
                                <div className="flex items-center gap-2 flex-1">
                                  <input
                                    type="time"
                                    value={times.start}
                                    onChange={(e) => updateDayTime('visit', dayKey, 'start', e.target.value)}
                                    className="px-3 py-2 border border-gray-200 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                                  />
                                  <span className="text-gray-400">~</span>
                                  <input
                                    type="time"
                                    value={times.end}
                                    onChange={(e) => updateDayTime('visit', dayKey, 'end', e.target.value)}
                                    className="px-3 py-2 border border-gray-200 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                                  />
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400">휴무</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 저장 버튼 */}
                    <div className="pt-4 border-t border-gray-100 dark:border-neutral-800">
                      <button
                        type="button"
                        onClick={() => saveAvailability(availability)}
                        disabled={availabilityLoading}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {availabilityLoading ? '저장 중...' : '상담 가능 시간 저장'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 추가 설정 안내 */}
                <div className="mt-6 p-4 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-white">Tip:</span> 상담 카테고리와 상담 가능 시간은 학원 상세 페이지의 상담 신청 폼에서 사용됩니다. 
                    고객이 희망 시간을 선택할 때 설정된 시간 내에서만 선택할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          )}
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
