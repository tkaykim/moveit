"use client";

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  Users,
  Calendar,
  MessageSquare,
} from 'lucide-react';
import { StatusBadge } from '../common/status-badge';
import { SectionHeader } from '../common/section-header';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { TodayClassesSection } from './today-classes-section';

interface DashboardViewProps {
  academyId: string;
}

export function DashboardView({ academyId }: DashboardViewProps) {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    activeStudents: 0,
    todaySchedules: 0,
    pendingConsultations: 0,
  });
  const [recentConsultations, setRecentConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [academyId]);

  const loadDashboardData = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const today = now.toISOString().split('T')[0];
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // 이번 달 총 매출
      const { data: revenueData } = await supabase
        .from('revenue_transactions')
        .select('final_price')
        .eq('academy_id', academyId)
        .eq('payment_status', 'COMPLETED')
        .gte('transaction_date', startOfMonth);

      const totalRevenue = revenueData?.reduce((sum: number, t: any) => sum + (t.final_price || 0), 0) || 0;

      // 활성 수강생
      const { data: tickets } = await supabase
        .from('tickets')
        .select('id')
        .eq('academy_id', academyId);

      const ticketIds = tickets?.map((t: any) => t.id) || [];
      
      const { data: activeTickets } = await supabase
        .from('user_tickets')
        .select('user_id')
        .in('ticket_id', ticketIds.length > 0 ? ticketIds : ['00000000-0000-0000-0000-000000000000'])
        .eq('status', 'ACTIVE')
        .gt('remaining_count', 0);

      const uniqueUsers = new Set(activeTickets?.map((t: any) => t.user_id) || []);
      const activeStudents = uniqueUsers.size;

      // 오늘 예정 수업
      const { count: todaySchedules } = await supabase
        .from('classes')
        .select('id', { count: 'exact', head: true })
        .eq('academy_id', academyId)
        .eq('is_canceled', false)
        .gte('start_time', today)
        .lt('start_time', tomorrow);

      // 미처리 상담
      const { count: pendingConsultations } = await supabase
        .from('consultations')
        .select('id', { count: 'exact', head: true })
        .eq('academy_id', academyId)
        .eq('status', 'NEW');

      setStats({
        totalRevenue,
        activeStudents,
        todaySchedules,
        pendingConsultations: pendingConsultations || 0,
      });

      // 최근 상담 내역
      const { data: consultations } = await supabase
        .from('consultations')
        .select(`
          *,
          users!consultations_assigned_to_fkey (
            id,
            name
          )
        `)
        .eq('academy_id', academyId)
        .order('created_at', { ascending: false })
        .limit(3);

      setRecentConsultations(consultations || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const SUMMARY_STATS = [
    {
      label: '이번 달 총 매출',
      value: `₩ ${stats.totalRevenue.toLocaleString()}`,
      change: '+12.5%',
      icon: TrendingUp,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      label: '활성 수강생',
      value: `${stats.activeStudents}명`,
      change: '+4명',
      icon: Users,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      label: '오늘 예정 수업',
      value: `${stats.todaySchedules}건`,
      change: '정상 진행',
      icon: Calendar,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
    },
    {
      label: '미처리 상담',
      value: `${stats.pendingConsultations}건`,
      change: '확인 필요',
      icon: MessageSquare,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-900/20',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {SUMMARY_STATS.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="bg-white dark:bg-neutral-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-lg ${stat.bg}`}>
                  <Icon className={stat.color} size={24} />
                </div>
                <span
                  className={`text-xs font-bold px-2 py-1 rounded-full ${
                    stat.color === 'text-red-600 dark:text-red-400'
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                      : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {stat.change}
                </span>
              </div>
              <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                {stat.label}
              </h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {stat.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* 오늘의 수업 일정 */}
      <TodayClassesSection academyId={academyId} />

      {/* 최근 상담 내역 */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-lg text-gray-800 dark:text-white">최근 상담/등록 현황</h3>
          <button className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            전체보기
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b dark:border-neutral-800 pb-2">
                <th className="pb-3 pl-2">이름</th>
                <th className="pb-3">관심 분야</th>
                <th className="pb-3">담당자</th>
                <th className="pb-3">날짜</th>
                <th className="pb-3">상태</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {recentConsultations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-gray-500 dark:text-gray-400">
                    상담 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                recentConsultations.map((consultation) => (
                  <tr
                    key={consultation.id}
                    className="border-b dark:border-neutral-800 last:border-0 hover:bg-gray-50 dark:hover:bg-neutral-800"
                  >
                    <td className="py-3 pl-2 font-medium text-gray-900 dark:text-white">
                      {consultation.name}
                    </td>
                    <td className="text-gray-600 dark:text-gray-400">{consultation.topic}</td>
                    <td className="text-gray-600 dark:text-gray-400">
                      {consultation.users?.name || '-'}
                    </td>
                    <td className="text-gray-600 dark:text-gray-400">
                      {new Date(consultation.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td>
                      <StatusBadge
                        status={
                          consultation.status === 'NEW'
                            ? '상담대기'
                            : consultation.status === 'SCHEDULED'
                            ? '상담예정'
                            : '완료'
                        }
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
