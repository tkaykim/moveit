"use client";

import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { Schedule, Class, Branch, Hall, Instructor } from '@/lib/supabase/types';

type ScheduleWithRelations = Schedule & {
  classes: Class | null;
  branches: Branch | null;
  halls: Hall | null;
  instructors: Instructor | null;
};

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<ScheduleWithRelations[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    class_id: '',
    branch_id: '',
    hall_id: '',
    instructor_id: '',
    start_time: '',
    end_time: '',
    max_students: 20,
    current_students: 0,
    is_canceled: false,
  });

  const loadData = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const [schedulesRes, classesRes, branchesRes, instructorsRes] = await Promise.all([
        supabase
          .from('schedules')
          .select('*, classes(*), branches(*), halls(*), instructors(*)')
          .order('start_time', { ascending: true }),
        supabase
          .from('classes')
          .select('*')
          .order('title', { ascending: true }),
        supabase
          .from('branches')
          .select('*')
          .order('name', { ascending: true }),
        supabase
          .from('instructors')
          .select('*')
          .order('name_kr', { ascending: true }),
      ]);

      if (schedulesRes.error) throw schedulesRes.error;
      if (classesRes.error) throw classesRes.error;
      if (branchesRes.error) throw branchesRes.error;
      if (instructorsRes.error) throw instructorsRes.error;

      setSchedules(schedulesRes.data || []);
      setClasses(classesRes.data || []);
      setBranches(branchesRes.data || []);
      setInstructors(instructorsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHalls = useCallback(async (branchId: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('halls')
        .select('*')
        .eq('branch_id', branchId)
        .order('name', { ascending: true });

      if (error) throw error;
      setHalls(data || []);
    } catch (error) {
      console.error('Error loading halls:', error);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (formData.branch_id) {
      loadHalls(formData.branch_id);
    } else {
      setHalls([]);
    }
  }, [formData.branch_id, loadHalls]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const submitData = {
        ...formData,
        max_students: Number(formData.max_students),
        current_students: Number(formData.current_students) || 0,
      };

      if (editingId) {
        const { error } = await (supabase as any)
          .from('schedules')
          .update(submitData)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('schedules')
          .insert([submitData]);

        if (error) throw error;
      }

      await loadData();
      setShowForm(false);
      setEditingId(null);
      setFormData({
        class_id: '',
        branch_id: '',
        hall_id: '',
        instructor_id: '',
        start_time: '',
        end_time: '',
        max_students: 20,
        current_students: 0,
        is_canceled: false,
      });
      setHalls([]);
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('시간표 저장에 실패했습니다.');
    }
  };

  const handleEdit = (schedule: ScheduleWithRelations) => {
    setEditingId(schedule.id);
    setFormData({
      class_id: schedule.class_id,
      branch_id: schedule.branch_id,
      hall_id: schedule.hall_id,
      instructor_id: schedule.instructor_id,
      start_time: new Date(schedule.start_time).toISOString().slice(0, 16),
      end_time: new Date(schedule.end_time).toISOString().slice(0, 16),
      max_students: schedule.max_students,
      current_students: schedule.current_students,
      is_canceled: schedule.is_canceled,
    });
    loadHalls(schedule.branch_id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      alert('시간표 삭제에 실패했습니다.');
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return <div className="text-center py-12">로딩 중...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">시간표 관리</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            시간표를 등록하고 관리할 수 있습니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              setFormData({
                class_id: '',
                branch_id: '',
                hall_id: '',
                instructor_id: '',
                start_time: '',
                end_time: '',
                max_students: 20,
                current_students: 0,
                is_canceled: false,
              });
              setHalls([]);
            }}
            className="px-4 py-2 bg-primary dark:bg-[#CCFF00] text-black rounded-lg hover:opacity-90 flex items-center gap-2"
          >
            <Plus size={20} />
            {showForm ? '취소' : '시간표 추가'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 mb-6">
          <h2 className="text-xl font-bold text-black dark:text-white mb-4">
            {editingId ? '시간표 수정' : '새 시간표 등록'}
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-2">
                  클래스 *
                </label>
                <select
                  required
                  value={formData.class_id}
                  onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                  className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                >
                  <option value="">클래스 선택</option>
                  {classes.map((classItem) => (
                    <option key={classItem.id} value={classItem.id}>
                      {classItem.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-2">
                  지점 *
                </label>
                <select
                  required
                  value={formData.branch_id}
                  onChange={(e) => setFormData({ ...formData, branch_id: e.target.value, hall_id: '' })}
                  className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                >
                  <option value="">지점 선택</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-2">
                  강의실 *
                </label>
                <select
                  required
                  value={formData.hall_id}
                  onChange={(e) => setFormData({ ...formData, hall_id: e.target.value })}
                  disabled={!formData.branch_id || halls.length === 0}
                  className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white disabled:opacity-50"
                >
                  <option value="">강의실 선택</option>
                  {halls.map((hall) => (
                    <option key={hall.id} value={hall.id}>
                      {hall.name}
                    </option>
                  ))}
                </select>
                {!formData.branch_id && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    지점을 먼저 선택하세요
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-2">
                  강사 *
                </label>
                <select
                  required
                  value={formData.instructor_id}
                  onChange={(e) => setFormData({ ...formData, instructor_id: e.target.value })}
                  className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                >
                  <option value="">강사 선택</option>
                  {instructors.map((instructor) => {
                    const instructorAny = instructor as any;
                    const nameKr = instructorAny.name_kr;
                    const nameEn = instructorAny.name_en;
                    const displayName = nameKr && nameEn 
                      ? `${nameKr} (${nameEn})` 
                      : nameKr || nameEn || '-';
                    return (
                      <option key={instructor.id} value={instructor.id}>
                        {displayName}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-2">
                  시작 시간 *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-2">
                  종료 시간 *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-2">
                  최대 인원 *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.max_students}
                  onChange={(e) => setFormData({ ...formData, max_students: Number(e.target.value) })}
                  className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-2">
                  현재 인원
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.current_students}
                  onChange={(e) => setFormData({ ...formData, current_students: Number(e.target.value) })}
                  className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_canceled"
                checked={formData.is_canceled}
                onChange={(e) => setFormData({ ...formData, is_canceled: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="is_canceled" className="text-sm text-black dark:text-white">
                취소됨
              </label>
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 bg-primary dark:bg-[#CCFF00] text-black font-bold rounded-lg hover:opacity-90"
            >
              {editingId ? '수정' : '등록'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-100 dark:bg-neutral-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  클래스
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  강사
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  지점/강의실
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  시간
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  인원
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {schedules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-neutral-500 dark:text-neutral-400">
                    등록된 시간표가 없습니다.
                  </td>
                </tr>
              ) : (
                schedules.map((schedule) => {
                  const isFull = schedule.current_students >= schedule.max_students;
                  const isAlmostFull = schedule.current_students >= schedule.max_students * 0.8;
                  
                  return (
                    <tr key={schedule.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                      <td className="px-6 py-4 text-sm font-medium text-black dark:text-white">
                        {(schedule.classes as Class | null)?.title || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                        {(() => {
                          const instructor = schedule.instructors as Instructor | null;
                          if (!instructor) return '-';
                          const instructorAny = instructor as any;
                          const nameKr = instructorAny.name_kr;
                          const nameEn = instructorAny.name_en;
                          if (nameKr && nameEn) return `${nameKr} (${nameEn})`;
                          return nameKr || nameEn || '-';
                        })()}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">
                        <div>{(schedule.branches as Branch | null)?.name || '-'}</div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-500">
                          {(schedule.halls as Hall | null)?.name || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                        <div>{formatDateTime(schedule.start_time)}</div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-500">
                          ~ {formatDateTime(schedule.end_time)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                        {schedule.current_students} / {schedule.max_students}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {schedule.is_canceled ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">
                            취소됨
                          </span>
                        ) : isFull ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">
                            FULL
                          </span>
                        ) : isAlmostFull ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400">
                            ALMOST FULL
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                            AVAILABLE
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(schedule)}
                            className="text-primary dark:text-[#CCFF00] hover:opacity-80"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(schedule.id)}
                            className="text-red-500 hover:opacity-80"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

