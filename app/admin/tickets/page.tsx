"use client";

import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Ticket } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { Database } from '@/types/database';

type Ticket = Database['public']['Tables']['tickets']['Row'] & {
  academies: any | null;
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    price: 0,
    ticket_type: '1회권' as string,
    total_count: 1,
    valid_days: 30,
    is_on_sale: true,
  });

  const loadData = useCallback(async () => {
    const supabase = getSupabaseClient() as any;
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      // /admin에서는 is_general=true인 전체 수강권만 조회
      const ticketsRes = await supabase
        .from('tickets')
        .select('*, academies(*)')
        .eq('is_general', true)
        .order('created_at', { ascending: false });

      if (ticketsRes.error) throw ticketsRes.error;

      setTickets(ticketsRes.data || []);
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
      // /admin에서는 전체 수강권만 생성 (is_general=true, academy_id=NULL)
      const submitData: Database['public']['Tables']['tickets']['Insert'] = {
        is_general: true,
        academy_id: null, // 전체 수강권은 academy_id가 NULL
        name: formData.name,
        price: formData.price,
        ticket_type: formData.ticket_type,
        total_count: formData.total_count,
        valid_days: formData.valid_days,
        is_on_sale: formData.is_on_sale,
      };

      if (editingId) {
        const { error } = await supabase
          .from('tickets')
          .update(submitData)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tickets')
          .insert([submitData]);

        if (error) throw error;
      }

      await loadData();
      setShowForm(false);
      setEditingId(null);
      setFormData({
        name: '',
        price: 0,
        ticket_type: '1회권',
        total_count: 1,
        valid_days: 30,
        is_on_sale: true,
      });
    } catch (error) {
      console.error('Error saving ticket:', error);
      alert('수강권 저장에 실패했습니다.');
    }
  };

  const handleEdit = (ticket: Ticket) => {
    setEditingId(ticket.id);
    setFormData({
      name: ticket.name || '',
      price: ticket.price || 0,
      ticket_type: ticket.ticket_type || '1회권',
      total_count: ticket.total_count || 1,
      valid_days: ticket.valid_days || 30,
      is_on_sale: ticket.is_on_sale ?? true,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    const supabase = getSupabaseClient() as any;
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('tickets')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error deleting ticket:', error);
      alert('수강권 삭제에 실패했습니다.');
    }
  };

  if (loading) {
    return <div className="text-center py-12">로딩 중...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">수강권 관리</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            전체 수강권을 등록하고 관리할 수 있습니다. (학원 전용 수강권은 각 학원 관리 페이지에서 관리)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              setFormData({
                name: '',
                price: 0,
                ticket_type: '1회권',
                total_count: 1,
                valid_days: 30,
                is_on_sale: true,
              });
            }}
            className="px-4 py-2 bg-primary dark:bg-[#CCFF00] text-black rounded-lg hover:opacity-90 flex items-center gap-2"
          >
            <Plus size={20} />
            {showForm ? '취소' : '수강권 추가'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 mb-6">
          <h2 className="text-xl font-bold text-black dark:text-white mb-4">
            {editingId ? '수강권 수정' : '새 수강권 등록'}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                수강권명 *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="예: 전체 1회권, 전체 10회권"
                className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                수강권 유형 *
              </label>
              <select
                required
                value={formData.ticket_type}
                onChange={(e) => setFormData({ ...formData, ticket_type: e.target.value })}
                className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
              >
                <option value="1회권">1회권</option>
                <option value="10회권">10회권</option>
                <option value="20회권">20회권</option>
                <option value="30회권">30회권</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                가격 (원) *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                사용 가능 횟수 *
              </label>
              <input
                type="number"
                required
                min="1"
                value={formData.total_count}
                onChange={(e) => setFormData({ ...formData, total_count: Number(e.target.value) })}
                className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                유효기간 (일) *
              </label>
              <input
                type="number"
                required
                min="1"
                value={formData.valid_days}
                onChange={(e) => setFormData({ ...formData, valid_days: Number(e.target.value) })}
                className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
              />
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                구매일로부터 사용 가능한 일수
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_on_sale"
                checked={formData.is_on_sale}
                onChange={(e) => setFormData({ ...formData, is_on_sale: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="is_on_sale" className="text-sm font-medium text-black dark:text-white">
                판매 중
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
                  수강권명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  유형
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  가격
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  사용 가능 횟수
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  유효기간
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
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-neutral-500 dark:text-neutral-400">
                    등록된 수강권이 없습니다.
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black dark:text-white">
                      {ticket.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                      {ticket.ticket_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                      {ticket.price?.toLocaleString()}원
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                      {ticket.total_count}회
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                      {ticket.valid_days}일
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        ticket.is_on_sale
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                      }`}>
                        {ticket.is_on_sale ? '판매 중' : '판매 중지'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(ticket)}
                          className="text-primary dark:text-[#CCFF00] hover:opacity-80"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(ticket.id)}
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

