'use client';

import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/supabase/auth-fetch';
import { BillingStatsDashboard } from './components/billing-stats-dashboard';
import { SubscriptionList } from './components/subscription-list';
import type { BillingStats } from '@/types/billing';

export default function AdminBillingPage() {
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingList, setLoadingList] = useState(true);

  const handleStatusChange = (v: string) => {
    setStatusFilter(v);
    setPage(1);
  };
  const handlePlanChange = (v: string) => {
    setPlanFilter(v);
    setPage(1);
  };
  const handleSearchChange = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await authFetch('/api/admin/billing/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else {
        setStats(null);
      }
    } catch {
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadSubscriptions = useCallback(async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (planFilter !== 'all') params.set('planId', planFilter);
      if (search.trim()) params.set('search', search.trim());
      const res = await authFetch(`/api/admin/billing/subscriptions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data?.data ?? []);
        setTotal(data?.total ?? 0);
      } else {
        setSubscriptions([]);
        setTotal(0);
      }
    } catch {
      setSubscriptions([]);
      setTotal(0);
    } finally {
      setLoadingList(false);
    }
  }, [page, limit, statusFilter, planFilter, search]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-black dark:text-white">구독 관리</h1>
      <BillingStatsDashboard stats={stats} loading={loadingStats} />
      <SubscriptionList
        items={subscriptions}
        total={total}
        page={page}
        limit={limit}
        loading={loadingList}
        statusFilter={statusFilter}
        planFilter={planFilter}
        search={search}
        onStatusChange={handleStatusChange}
        onPlanChange={handlePlanChange}
        onSearchChange={handleSearchChange}
        onPageChange={setPage}
      />
    </div>
  );
}
