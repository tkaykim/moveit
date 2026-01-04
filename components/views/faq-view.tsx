"use client";

import { ChevronLeft, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface FAQViewProps {
  onBack: () => void;
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const faqData: FAQItem[] = [
  {
    id: '1',
    question: '수강권은 어떻게 구매하나요?',
    answer: '클래스를 예약할 때 수강권을 구매할 수 있습니다. 결제 페이지에서 수강권을 선택하여 구매하시면 됩니다.',
    category: '수강권',
  },
  {
    id: '2',
    question: '수강권은 언제까지 사용할 수 있나요?',
    answer: '수강권의 유효기간은 구매한 수강권의 종류에 따라 다릅니다. 각 수강권의 만료일을 확인하실 수 있습니다.',
    category: '수강권',
  },
  {
    id: '3',
    question: '예약을 취소할 수 있나요?',
    answer: '클래스 시작 24시간 전까지 취소가 가능합니다. 마이페이지의 결제내역에서 취소할 수 있습니다.',
    category: '예약',
  },
  {
    id: '4',
    question: 'QR코드로 출석하는 방법은?',
    answer: '마이페이지의 "QR코드로 출석하기" 버튼을 눌러 QR코드를 생성하고, 학원에서 스캔하면 출석이 완료됩니다.',
    category: '출석',
  },
  {
    id: '5',
    question: '포인트는 어떻게 적립되나요?',
    answer: '클래스를 수강하거나 친구를 초대하면 포인트가 적립됩니다. 적립된 포인트는 다음 결제 시 사용할 수 있습니다.',
    category: '포인트',
  },
  {
    id: '6',
    question: '학원을 찜하는 방법은?',
    answer: '학원 상세 페이지에서 하트 아이콘을 클릭하면 찜 목록에 추가됩니다. 마이페이지에서 찜한 목록을 확인할 수 있습니다.',
    category: '기능',
  },
  {
    id: '7',
    question: '강사 정보는 어디서 확인하나요?',
    answer: '강사 탭에서 모든 강사 목록을 확인할 수 있고, 각 강사의 상세 정보와 클래스를 확인할 수 있습니다.',
    category: '기능',
  },
  {
    id: '8',
    question: '결제 방법은 무엇이 있나요?',
    answer: '현재는 수강권을 사용한 결제만 가능합니다. 수강권이 없으시면 클래스를 예약할 때 수강권을 구매하실 수 있습니다.',
    category: '결제',
  },
];

export const FAQView = ({ onBack }: FAQViewProps) => {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');

  const categories = ['전체', ...Array.from(new Set(faqData.map(item => item.category)))];

  const filteredFAQs = selectedCategory === '전체'
    ? faqData
    : faqData.filter(item => item.category === selectedCategory);

  const toggleItem = (id: string) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(id)) {
      newOpenItems.delete(id);
    } else {
      newOpenItems.add(id);
    }
    setOpenItems(newOpenItems);
  };

  return (
    <div className="bg-white dark:bg-neutral-950 min-h-screen pt-12 px-5 pb-24 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 -ml-2 text-black dark:text-white">
          <ChevronLeft />
        </button>
        <h2 className="text-xl font-bold text-black dark:text-white">FAQ</h2>
      </div>

      {/* 카테고리 필터 */}
      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              selectedCategory === category
                ? 'bg-primary dark:bg-[#CCFF00] text-black'
                : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* FAQ 목록 */}
      <div className="space-y-2">
        {filteredFAQs.length === 0 ? (
          <div className="text-center py-20">
            <HelpCircle className="mx-auto mb-4 text-neutral-400 dark:text-neutral-600" size={48} />
            <p className="text-neutral-500 dark:text-neutral-400">해당 카테고리의 FAQ가 없습니다</p>
          </div>
        ) : (
          filteredFAQs.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden"
            >
              <button
                onClick={() => toggleItem(item.id)}
                className="w-full p-4 text-left flex items-center justify-between active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start gap-3 flex-1">
                  <HelpCircle className="text-primary dark:text-[#CCFF00] flex-shrink-0 mt-0.5" size={20} />
                  <span className="text-sm font-bold text-black dark:text-white flex-1">
                    {item.question}
                  </span>
                </div>
                {openItems.has(item.id) ? (
                  <ChevronUp className="text-neutral-400 flex-shrink-0 ml-2" size={20} />
                ) : (
                  <ChevronDown className="text-neutral-400 flex-shrink-0 ml-2" size={20} />
                )}
              </button>
              {openItems.has(item.id) && (
                <div className="px-4 pb-4 pl-11">
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800 rounded-xl p-3">
                    {item.answer}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};






