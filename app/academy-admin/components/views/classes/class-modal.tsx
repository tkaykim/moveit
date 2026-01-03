"use client";

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface ClassModalProps {
  academyId: string;
  classData?: any;
  onClose: () => void;
}

const GENRES = ['Choreo', 'hiphop', 'locking', 'waacking', 'popping', 'krump', 'voguing', 'breaking(bboying)'];
const DIFFICULTY_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const CLASS_TYPES = ['regular', 'popup', 'workshop', 'ONE_DAY', 'PRIVATE', 'RENTAL'];

export function ClassModal({ academyId, classData, onClose }: ClassModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    song: '',
    genre: '',
    difficulty_level: 'BEGINNER',
    class_type: 'regular',
    price: 0,
    description: '',
    start_time: '',
    end_time: '',
    instructor_id: '',
    hall_id: '',
    max_students: 0,
  });
  const [instructors, setInstructors] = useState<any[]>([]);
  const [halls, setHalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
    if (classData) {
      setFormData({
        title: classData.title || '',
        song: classData.song || '',
        genre: classData.genre || '',
        difficulty_level: classData.difficulty_level || 'BEGINNER',
        class_type: classData.class_type || 'regular',
        price: classData.price || 0,
        description: classData.description || '',
        start_time: classData.start_time
          ? new Date(classData.start_time).toISOString().slice(0, 16)
          : '',
        end_time: classData.end_time
          ? new Date(classData.end_time).toISOString().slice(0, 16)
          : '',
        instructor_id: classData.instructor_id || '',
        hall_id: classData.hall_id || '',
        max_students: classData.max_students || 0,
      });
    }
  }, [classData, academyId]);

  const loadData = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const { data: instructorsData } = await supabase.from('instructors').select('*');
      setInstructors(instructorsData || []);

      const { data: hallsData } = await supabase
        .from('halls')
        .select('*')
        .eq('academy_id', academyId);
      setHalls(hallsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const supabase = getSupabaseClient();
    if (!supabase) {
      alert('데이터베이스 연결에 실패했습니다.');
      setLoading(false);
      return;
    }

    try {
      const data = {
        academy_id: academyId,
        title: formData.title,
        song: formData.song || null,
        genre: formData.genre || null,
        difficulty_level: formData.difficulty_level,
        class_type: formData.class_type,
        price: formData.price,
        description: formData.description || null,
        start_time: formData.start_time ? new Date(formData.start_time).toISOString() : null,
        end_time: formData.end_time ? new Date(formData.end_time).toISOString() : null,
        instructor_id: formData.instructor_id || null,
        hall_id: formData.hall_id || null,
        max_students: formData.max_students,
      };

      if (classData) {
        const { error } = await supabase.from('classes').update(data).eq('id', classData.id);

        if (error) throw error;
        alert('클래스가 수정되었습니다.');
      } else {
        const { error } = await supabase.from('classes').insert([data]);

        if (error) throw error;
        alert('클래스가 등록되었습니다.');
      }

      onClose();
    } catch (error: any) {
      console.error('Error saving class:', error);
      alert(`클래스 저장에 실패했습니다: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center sticky top-0 bg-white dark:bg-neutral-900">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
            {classData ? '클래스 수정' : '클래스 등록'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              클래스명 *
            </label>
            <input
              type="text"
              required
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                장르
              </label>
              <select
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.genre}
                onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
              >
                <option value="">선택하세요</option>
                {GENRES.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                난이도
              </label>
              <select
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.difficulty_level}
                onChange={(e) => setFormData({ ...formData, difficulty_level: e.target.value })}
              >
                {DIFFICULTY_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              클래스 유형
            </label>
            <select
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.class_type}
              onChange={(e) => setFormData({ ...formData, class_type: e.target.value })}
            >
              {CLASS_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              가격
            </label>
            <input
              type="number"
              min="0"
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              곡명
            </label>
            <input
              type="text"
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.song}
              onChange={(e) => setFormData({ ...formData, song: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              설명
            </label>
            <textarea
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {loading ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

