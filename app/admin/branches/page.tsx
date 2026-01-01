"use client";

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { Branch, Academy } from '@/lib/supabase/types';

export default function BranchesPage() {
  const [branches, setBranches] = useState<(Branch & { academies: Academy | null })[]>([]);
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    academy_id: '',
    name: '',
    address_primary: '',
    address_detail: '',
    contact_number: '',
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const [branchesRes, academiesRes] = await Promise.all([
        supabase
          .from('branches')
          .select('*, academies(*)')
          .order('created_at', { ascending: false }),
        supabase
          .from('academies')
          .select('*')
          .order('name', { ascending: true }),
      ]);

      if (branchesRes.error) throw branchesRes.error;
      if (academiesRes.error) throw academiesRes.error;

      setBranches(branchesRes.data || []);
      setAcademies(academiesRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const submitData = {
        ...formData,
        address_detail: formData.address_detail || null,
        contact_number: formData.contact_number || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from('branches')
          .update(submitData)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('branches')
          .insert([submitData]);

        if (error) throw error;
      }

      await loadData();
      setShowForm(false);
      setEditingId(null);
      setFormData({
        academy_id: '',
        name: '',
        address_primary: '',
        address_detail: '',
        contact_number: '',
        is_active: true,
      });
    } catch (error) {
      console.error('Error saving branch:', error);
      alert('지점 저장에 실패했습니다.');
    }
  };

  const handleEdit = (branch: Branch) => {
    setEditingId(branch.id);
    setFormData({
      academy_id: branch.academy_id,
      name: branch.name,
      address_primary: branch.address_primary,
      address_detail: branch.address_detail || '',
      contact_number: branch.contact_number || '',
      is_active: branch.is_active,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error deleting branch:', error);
      alert('지점 삭제에 실패했습니다.');
    }
  };

  if (loading) {
    return <div className="text-center py-12">로딩 중...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">지점 관리</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            지점을 등록하고 관리할 수 있습니다.
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
                address_primary: '',
                address_detail: '',
                contact_number: '',
                is_active: true,
              });
            }}
            className="px-4 py-2 bg-primary dark:bg-[#CCFF00] text-black rounded-lg hover:opacity-90 flex items-center gap-2"
          >
            <Plus size={20} />
            {showForm ? '취소' : '지점 추가'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 mb-6">
          <h2 className="text-xl font-bold text-black dark:text-white mb-4">
            {editingId ? '지점 수정' : '새 지점 등록'}
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
                {academies.map((academy) => {
                  const academyAny = academy as any;
                  const nameKr = academyAny.name_kr;
                  const nameEn = academyAny.name_en;
                  const displayName = nameKr && nameEn 
                    ? `${nameKr} (${nameEn})` 
                    : nameKr || nameEn || '-';
                  return (
                    <option key={academy.id} value={academy.id}>
                      {displayName}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                지점명 *
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
                주소 *
              </label>
              <input
                type="text"
                required
                value={formData.address_primary}
                onChange={(e) => setFormData({ ...formData, address_primary: e.target.value })}
                className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                상세 주소
              </label>
              <input
                type="text"
                value={formData.address_detail}
                onChange={(e) => setFormData({ ...formData, address_detail: e.target.value })}
                className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                연락처
              </label>
              <input
                type="tel"
                value={formData.contact_number}
                onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="is_active" className="text-sm text-black dark:text-white">
                활성화
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
                  학원
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  지점명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  주소
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
              {branches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-neutral-500 dark:text-neutral-400">
                    등록된 지점이 없습니다.
                  </td>
                </tr>
              ) : (
                branches.map((branch) => (
                  <tr key={branch.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black dark:text-white">
                      {(() => {
                        const academy = branch.academies as Academy | null;
                        if (!academy) return '-';
                        const academyAny = academy as any;
                        const nameKr = academyAny.name_kr;
                        const nameEn = academyAny.name_en;
                        if (nameKr && nameEn) return `${nameKr} (${nameEn})`;
                        return nameKr || nameEn || '-';
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black dark:text-white">
                      {branch.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">
                      {branch.address_primary}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        branch.is_active 
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' 
                          : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                      }`}>
                        {branch.is_active ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(branch)}
                          className="text-primary dark:text-[#CCFF00] hover:opacity-80"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(branch.id)}
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

