'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Calendar, User, Clock, Users, CheckCircle } from 'lucide-react';

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

interface ClassItem {
  id: string;
  title: string;
  teacher: string;
  time: string;
  color: string;
  days: number[];
  maxStudents?: number;
  enrolled?: number;
}

const INITIAL_CLASSES: ClassItem[] = [
  { id: '1', title: 'K-POP 입문', teacher: 'J-HO', time: '18:00', color: 'bg-blue-500', days: [1, 3], maxStudents: 20, enrolled: 12 },
  { id: '2', title: '걸스힙합', teacher: 'MINA', time: '19:30', color: 'bg-pink-500', days: [2, 4], maxStudents: 15, enrolled: 10 },
  { id: '3', title: '코레오그래피', teacher: 'WOO', time: '21:00', color: 'bg-purple-500', days: [1, 3, 5], maxStudents: 20, enrolled: 8 },
  { id: '4', title: '왁킹 정규', teacher: 'HANA', time: '20:00', color: 'bg-amber-500', days: [2, 4], maxStudents: 15, enrolled: 14 },
  { id: '5', title: '프리스타일', teacher: 'REX', time: '15:00', color: 'bg-green-500', days: [6], maxStudents: 12, enrolled: 5 },
];

export function FeatureCalendar() {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>(INITIAL_CLASSES);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [booked, setBooked] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newClass, setNewClass] = useState({ title: '', teacher: '', time: '19:00', dayOfWeek: 1 });

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();

  const getClassesForDay = (day: number) => {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    return classes.filter(c => c.days.includes(dayOfWeek));
  };

  const dayClasses = selectedDay ? getClassesForDay(selectedDay) : [];

  const handleAddClass = () => {
    if (!newClass.title.trim() || !newClass.teacher.trim()) return;
    const id = `demo-${Date.now()}`;
    const colorList = ['bg-blue-500', 'bg-pink-500', 'bg-purple-500', 'bg-amber-500', 'bg-green-500'];
    setClasses(prev => [...prev, {
      id,
      title: newClass.title.trim(),
      teacher: newClass.teacher.trim(),
      time: newClass.time,
      color: colorList[prev.length % colorList.length],
      days: [newClass.dayOfWeek],
      maxStudents: 20,
      enrolled: 0,
    }]);
    setNewClass({ title: '', teacher: '', time: '19:00', dayOfWeek: 1 });
    setShowAddForm(false);
  };

  const handleBook = () => {
    setBooked(true);
    if (selectedClass) {
      setClasses(prev => prev.map(c =>
        c.id === selectedClass.id ? { ...c, enrolled: (c.enrolled ?? 0) + 1 } : c
      ));
    }
    setTimeout(() => {
      setBooked(false);
      setSelectedClass(null);
    }, 1800);
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
            {year}년 {month + 1}월
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
            스케줄 관리
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <ChevronLeft size={14} className="text-neutral-400" />
          </button>
          <button type="button" className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <ChevronRight size={14} className="text-neutral-400" />
          </button>
        </div>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map((d, i) => (
            <div key={d} className={`text-center text-[10px] font-medium py-1 ${
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-neutral-400'
            }`}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayClassList = getClassesForDay(day);
            const isToday = day === today;
            const isSelected = day === selectedDay;
            return (
              <button
                key={day}
                type="button"
                onClick={() => { setSelectedDay(isSelected ? null : day); setSelectedClass(null); }}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center relative transition-all ${
                  isSelected
                    ? 'bg-neutral-900 dark:bg-[#CCFF00] text-white dark:text-black'
                    : isToday
                      ? 'bg-neutral-100 dark:bg-neutral-800 font-bold'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                }`}
              >
                <span className="text-[11px]">{day}</span>
                {dayClassList.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {dayClassList.slice(0, 3).map((c) => (
                      <div key={c.id} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white dark:bg-black' : c.color}`} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDay && (
        <div className="border-t border-neutral-100 dark:border-neutral-800 p-3 animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-neutral-900 dark:text-white">
              {month + 1}월 {selectedDay}일 수업
            </p>
            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1 text-[10px] font-bold text-[#aacc00] dark:text-[#CCFF00]"
            >
              <Plus size={12} /> 수업 추가
            </button>
          </div>

          {/* 수업 생성 폼 */}
          {showAddForm && (
            <div className="mb-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 space-y-2">
              <input
                type="text"
                placeholder="수업명"
                value={newClass.title}
                onChange={e => setNewClass(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
              />
              <input
                type="text"
                placeholder="강사명"
                value={newClass.teacher}
                onChange={e => setNewClass(prev => ({ ...prev, teacher: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
              />
              <div className="flex gap-2">
                <input
                  type="time"
                  value={newClass.time}
                  onChange={e => setNewClass(prev => ({ ...prev, time: e.target.value }))}
                  className="flex-1 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                />
                <select
                  value={newClass.dayOfWeek}
                  onChange={e => setNewClass(prev => ({ ...prev, dayOfWeek: Number(e.target.value) }))}
                  className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                >
                  {DAYS.map((d, i) => (
                    <option key={d} value={i}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddClass}
                  className="flex-1 py-1.5 rounded-lg bg-[#CCFF00] text-neutral-900 text-xs font-bold"
                >
                  추가
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-700 text-xs"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {/* 수업 클릭 시 상세 + 예약하기 */}
          {selectedClass && !booked && (
            <div className="mb-3 p-3 rounded-xl bg-[#CCFF00]/10 dark:bg-[#CCFF00]/5 border border-[#CCFF00]/20 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-900 dark:text-white">수업 정보</span>
                <button type="button" onClick={() => setSelectedClass(null)} className="p-1 rounded hover:bg-black/5">
                  <X size={14} className="text-neutral-500" />
                </button>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-neutral-500" />
                  <span className="font-bold">{selectedClass.title}</span>
                </div>
                <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                  <User size={14} />
                  <span>{selectedClass.teacher}</span>
                </div>
                <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                  <Clock size={14} />
                  <span>{selectedClass.time}</span>
                </div>
                <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                  <Users size={14} />
                  <span>{selectedClass.enrolled ?? 0}/{selectedClass.maxStudents ?? 20}명</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleBook}
                className="w-full py-2 rounded-lg bg-neutral-900 dark:bg-[#CCFF00] text-white dark:text-black text-xs font-bold"
              >
                예약하기
              </button>
            </div>
          )}

          {booked && (
            <div className="mb-3 p-4 rounded-xl bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-800 flex flex-col items-center justify-center gap-2 animate-in zoom-in duration-300">
              <CheckCircle size={28} className="text-green-600 dark:text-green-400" />
              <p className="text-sm font-bold text-green-800 dark:text-green-200">예약되었습니다 (데모)</p>
            </div>
          )}

          {dayClasses.length > 0 && !selectedClass && !booked ? (
            <div className="space-y-1.5">
              {dayClasses.map((cls) => (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => setSelectedClass(cls)}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left"
                >
                  <div className={`w-1 h-8 rounded-full flex-shrink-0 ${cls.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">{cls.title}</p>
                    <p className="text-[10px] text-neutral-500">{cls.teacher} · {cls.time}</p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 flex-shrink-0">
                    {cls.enrolled ?? 0}/{cls.maxStudents ?? 20}명
                  </span>
                </button>
              ))}
            </div>
          ) : !showAddForm && !selectedClass && !booked && dayClasses.length === 0 ? (
            <p className="text-xs text-neutral-400 text-center py-3">이 날은 수업이 없습니다. 수업 추가로 만들어보세요.</p>
          ) : null}
        </div>
      )}

      {!selectedDay && (
        <div className="border-t border-neutral-100 dark:border-neutral-800 p-3 text-center">
          <p className="text-[11px] text-neutral-400">날짜 클릭 → 수업 선택 → 예약하기까지 체험해보세요</p>
        </div>
      )}
    </div>
  );
}
