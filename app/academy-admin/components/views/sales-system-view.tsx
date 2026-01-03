"use client";

import { useState } from 'react';
import { CreditCard } from 'lucide-react';
import { SalesForm } from './sales/sales-form';
import { PaymentLogs } from './sales/payment-logs';

interface SalesSystemViewProps {
  academyId: string;
}

export function SalesSystemView({ academyId }: SalesSystemViewProps) {
  const [activeTab, setActiveTab] = useState<'sales' | 'logs'>('sales');
  const [logs, setLogs] = useState<any[]>([]);

  const handlePaymentComplete = (log: any) => {
    setLogs((prev) => [log, ...prev]);
  };

  const handleViewLogs = () => {
    setActiveTab('logs');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 text-slate-900 dark:text-slate-100 font-sans">
      {/* Header */}
      <header className="bg-white dark:bg-neutral-900 border-b border-slate-200 dark:border-neutral-800 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded-lg flex items-center justify-center text-white">
              <CreditCard size={18} />
            </div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">수강권 판매 시스템</h1>
          </div>
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'sales'
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              판매 및 등록
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'logs'
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              결제 로그
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'sales' ? (
          <SalesForm
            academyId={academyId}
            onPaymentComplete={handlePaymentComplete}
            onViewLogs={handleViewLogs}
          />
        ) : (
          <PaymentLogs logs={logs} academyId={academyId} />
        )}
      </main>
    </div>
  );
}

