"use client";

import { useState } from 'react';
import { ViewState, Academy, Dancer, ClassInfo } from '@/types';
import { HomeView } from '@/components/views/home-view';
import { AcademyListView } from '@/components/views/academy-list-view';
import { AcademyDetailView } from '@/components/views/academy-detail-view';
import { DancerListView } from '@/components/views/dancer-list-view';
import { DancerDetailView } from '@/components/views/dancer-detail-view';
import { CalendarView } from '@/components/views/calendar-view';
import { PaymentView } from '@/components/views/payment-view';
import { PaymentSuccessView } from '@/components/views/payment-success-view';
import { MyPageView } from '@/components/views/my-page-view';
import { SearchResultsView } from '@/components/views/search-results-view';
import { TicketsView } from '@/components/views/tickets-view';
import { PaymentHistoryView } from '@/components/views/payment-history-view';
import { SettingsView } from '@/components/views/settings-view';
import { FAQView } from '@/components/views/faq-view';
import { NoticesView } from '@/components/views/notices-view';
import { BottomNav } from '@/components/navigation/bottom-nav';

export default function Home() {
  const [activeTab, setActiveTab] = useState<ViewState>('HOME');
  const [history, setHistory] = useState<ViewState[]>(['HOME']);
  const [selectedAcademy, setSelectedAcademy] = useState<Academy | null>(null);
  const [selectedDancer, setSelectedDancer] = useState<Dancer | null>(null);
  const [selectedClass, setSelectedClass] = useState<(ClassInfo & { time?: string; price?: number }) | null>(null);
  const [myTickets, setMyTickets] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const navigateTo = (view: ViewState, query?: string) => {
    if (view === 'SEARCH_RESULTS' && query) {
      setSearchQuery(query);
    }
    setHistory([...history, view]);
    setActiveTab(view);
  };

  const goBack = () => {
    if (history.length > 1) {
      const newHistory = [...history];
      newHistory.pop();
      const prevView = newHistory[newHistory.length - 1];
      setHistory(newHistory);
      setActiveTab(prevView);
    }
  };

  const handleAcademyClick = (academy: Academy) => {
    setSelectedAcademy(academy);
    navigateTo('DETAIL_ACADEMY');
  };

  const handleDancerClick = (dancer: Dancer) => {
    setSelectedDancer(dancer);
    navigateTo('DETAIL_DANCER');
  };

  const handleClassBooking = (classInfo: ClassInfo & { time?: string; price?: number }) => {
    setSelectedClass(classInfo);
    navigateTo('PAYMENT');
  };

  const processPayment = () => {
    setTimeout(() => {
      setMyTickets(prev => prev - 1);
      navigateTo('PAYMENT_SUCCESS');
    }, 1500);
  };

  const handleTabChange = (tab: ViewState) => {
    setHistory(['HOME']);
    setActiveTab(tab);
  };

  return (
    <div className="flex justify-center bg-neutral-50 dark:bg-black min-h-screen font-sans selection:bg-primary dark:selection:bg-[#CCFF00] selection:text-black">
      <div className="w-full max-w-[420px] bg-white dark:bg-neutral-950 min-h-screen relative shadow-2xl overflow-hidden flex flex-col border-x border-neutral-200 dark:border-neutral-900">
        <main className="flex-1 overflow-y-auto scrollbar-hide pb-20">
          {activeTab === 'HOME' && (
            <HomeView 
              onNavigate={navigateTo} 
              onAcademyClick={handleAcademyClick}
              onDancerClick={handleDancerClick}
            />
          )}
          {activeTab === 'SEARCH_RESULTS' && (
            <SearchResultsView
              query={searchQuery}
              onBack={() => {
                const newHistory = [...history];
                newHistory.pop();
                setHistory(newHistory);
                setActiveTab(newHistory[newHistory.length - 1] || 'HOME');
              }}
              onAcademyClick={handleAcademyClick}
              onDancerClick={handleDancerClick}
            />
          )}
          {activeTab === 'ACADEMY' && <AcademyListView onAcademyClick={handleAcademyClick} />}
          {activeTab === 'DETAIL_ACADEMY' && (
            <AcademyDetailView 
              academy={selectedAcademy} 
              onBack={goBack}
              onClassBook={handleClassBooking}
            />
          )}
          {activeTab === 'PAYMENT' && (
            <PaymentView 
              academy={selectedAcademy}
              classInfo={selectedClass}
              myTickets={myTickets}
              onBack={goBack}
              onPayment={processPayment}
            />
          )}
          {activeTab === 'PAYMENT_SUCCESS' && (
            <PaymentSuccessView 
              myTickets={myTickets}
              onNavigate={handleTabChange}
            />
          )}
          {activeTab === 'MY' && (
            <MyPageView 
              myTickets={myTickets}
              onQrOpen={() => {}}
              onNavigate={handleTabChange}
              onAcademyClick={handleAcademyClick}
              onDancerClick={handleDancerClick}
            />
          )}
          {activeTab === 'DANCER' && <DancerListView onDancerClick={handleDancerClick} />}
          {activeTab === 'DETAIL_DANCER' && (
            <DancerDetailView 
              dancer={selectedDancer} 
              onBack={goBack}
            />
          )}
          {activeTab === 'SAVED' && (
            <CalendarView 
              onAcademyClick={handleAcademyClick}
              onClassBook={handleClassBooking}
            />
          )}
          {activeTab === 'TICKETS' && (
            <TicketsView 
              onBack={goBack}
            />
          )}
          {activeTab === 'PAYMENT_HISTORY' && (
            <PaymentHistoryView 
              onBack={goBack}
            />
          )}
          {activeTab === 'SETTINGS' && (
            <SettingsView 
              onBack={goBack}
            />
          )}
          {activeTab === 'FAQ' && (
            <FAQView 
              onBack={goBack}
            />
          )}
          {activeTab === 'NOTICES' && (
            <NoticesView 
              onBack={goBack}
            />
          )}
        </main>
        <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
      </div>
    </div>
  );
}
