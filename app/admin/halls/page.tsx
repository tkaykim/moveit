"use client";

import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { Hall, Academy } from '@/lib/supabase/types';

export default function HallsPage() {
  const [halls, setHalls] = useState<(Hall & { academies: Academy | null })[]>([]);
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    academy_id: '',
    name: '',
    capacity: 0,
  });

  const loadData = useCallback(async () => {
    const supabase = getSupabaseClient() as any;
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const [hallsRes, academiesRes] = await Promise.all([
        supabase
          .from('halls')
          .select('*, academies(*)')
          .order('name', { ascending: true }),
        supabase
          .from('academies')
          .select('*')
          .order('name_kr', { ascending: true }),
      ]);

      if (hallsRes.error) throw hallsRes.error;
      if (academiesRes.error) throw academiesRes.error;

      setHalls(hallsRes.data || []);
      setAcademies(academiesRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabaseClient() as any;
    if (!supabase) return;

    try {
      const submitData = {
        academy_id: formData.academy_id,
        name: formData.name,
        capacity: Number(formData.capacity) || 0,
      };

      if (editingId) {
        const { error } = await (supabase as any)
          .from('halls')
          .update(submitData)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('halls')
          .insert([submitData]);

        if (error) throw error;
      }

      await loadData();
      setShowForm(false);
      setEditingId(null);
      setFormData({
        academy_id: '',
        name: '',
        capacity: 0,
      });
    } catch (error) {
      console.error('Error saving hall:', error);
      alert('강의실 저장에 실패했습니다.');
    }
  };

  const handleEdit = (hall: Hall & { academy_id?: string }) => {
    setEditingId(hall.id);
    setFormData({
      academy_id: (hall as any).academy_id || '',
      name: hall.name || '',
      capacity: hall.capacity || 0,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    const supabase = getSupabaseClient() as any;
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('halls')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error deleting hall:', error);
      alert('강의실 삭제에 실패했습니다.');
    }
  };

  if (loading) {
    return <div className="text-center py-12">로딩 중...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">홀 관리</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            홀을 등록하고 관리할 수 있습니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              setFormData({
                academy_id: '',
                name: '',
                capacity: 0,
              });
            }}
            className="px-4 py-2 bg-primary dark:bg-[#CCFF00] text-black rounded-lg hover:opacity-90 flex items-center gap-2"
          >
            <Plus size={20} />
            {showForm ? '취소' : '강의실 추가'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 mb-6">
          <h2 className="text-xl font-bold text-black dark:text-white mb-4">
            {editingId ? '강의실 수정' : '새 강의실 등록'}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                학원 *
              </label>
              <select
                required
                value={formData.academy_id}
                onChange={(e) => setFormData({ ...formData, academy_id: e.target.value })}
                className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
              >
                <option value="">학원 선택</option>
                {academies.map((academy) => (
                  <option key={academy.id} value={academy.id}>
                    {academy.name_kr || academy.name_en || '이름 없음'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                강의실명 *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                수용 인원
              </label>
              <input
                type="number"
                min="0"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
              />
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
                  학원
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  강의실명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  수용 인원
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {halls.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-neutral-500 dark:text-neutral-400">
                    등록된 강의실이 없습니다.
                  </td>
                </tr>
              ) : (
                halls.map((hall) => (
                  <tr key={hall.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black dark:text-white">
                      {(hall.academies as Academy | null)?.name_kr || (hall.academies as Academy | null)?.name_en || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black dark:text-white">
                      {hall.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                      {hall.capacity}명
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(hall)}
                          className="text-primary dark:text-[#CCFF00] hover:opacity-80"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(hall.id)}
                          className="text-red-500 hover:opacity-80"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
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

