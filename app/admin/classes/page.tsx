"use client";

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Users, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { Class, Academy, Hall, Instructor, Schedule, Booking, User } from '@/lib/supabase/types';
import { formatNumberInput, parseNumberFromString, formatNumberWithCommas } from '@/lib/utils/number-format';

const GENRES = ['Choreo', 'hiphop', 'locking', 'waacking', 'popping', 'krump', 'voguing', 'breaking(bboying)', 'heels', 'kpop', 'house', '기타'] as const;

type ClassWithRelations = Class & {
  academies: Academy | null;
  instructors: Instructor | null;
  schedules: (Schedule & {
    halls: Hall | null;
    instructors: Instructor | null;
    bookings: (Booking & { users: User | null })[];
  })[];
};

export default function ClassesPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassWithRelations[]>([]);
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [showBookings, setShowBookings] = useState(false);
  const [formData, setFormData] = useState({
    // 클래스 정보
    academy_id: '',
    hall_id: '',
    instructor_id: '',
    difficulty_level: '',
    selectedGenres: [] as string[],
    class_type: '',
    price: 0,
    title: '',
    description: '',
    thumbnail_url: '',
    poster_url: '',
    song: '',
    // 시간표 정보
    start_time: '',
    end_time: '',
    max_students: 20,
    // 페이 관련 필드
    base_salary: '',
    base_student_count: '',
    additional_salary_per_student: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (formData.academy_id) {
      loadHalls(formData.academy_id);
    } else {
      setHalls([]);
      setFormData((prev) => ({ ...prev, hall_id: '', max_students: 20 }));
    }
  }, [formData.academy_id]);

  useEffect(() => {
    if (formData.hall_id && halls.length > 0) {
      const selectedHall = halls.find(h => h.id === formData.hall_id);
      if (selectedHall && selectedHall.capacity && selectedHall.capacity > 0) {
        setFormData((prev) => ({ ...prev, max_students: selectedHall.capacity || 20 }));
      }
    }
  }, [formData.hall_id, halls]);

  const loadData = async () => {
    const supabase = getSupabaseClient() as any;
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const [classesRes, academiesRes, instructorsRes] = await Promise.all([
        supabase
          .from('classes')
          .select(`
            *,
            academies(*),
            instructors(*),
            schedules(
              *,
              halls(*),
              instructors(*),
              bookings(
                *,
                users(*)
              )
            )
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('academies')
          .select('*')
          .order('name_kr', { ascending: true }),
        supabase
          .from('instructors')
          .select('*')
          .order('name_kr', { ascending: true }),
      ]);

      if (classesRes.error) throw classesRes.error;
      if (academiesRes.error) throw academiesRes.error;
      if (instructorsRes.error) throw instructorsRes.error;

      setClasses(classesRes.data || []);
      setAcademies(academiesRes.data || []);
      setInstructors(instructorsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadHalls = async (academyId: string) => {
    const supabase = getSupabaseClient() as any;
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('halls')
        .select('*')
        .eq('academy_id', academyId)
        .order('name', { ascending: true });

      if (error) throw error;
      setHalls(data || []);
    } catch (error) {
      console.error('Error loading halls:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabaseClient() as any;
    if (!supabase) return;

    try {
      const classData: any = {
        academy_id: formData.academy_id,
        instructor_id: formData.instructor_id || null,
        hall_id: formData.hall_id || null,
        song: formData.song || null,
        title: formData.title || (() => {
          const instructor = instructors.find(i => i.id === formData.instructor_id);
          if (instructor) {
            const nameKr = instructor.name_kr;
            const nameEn = instructor.name_en;
            const instructorName = nameKr || nameEn || '';
            return `${instructorName} ${formData.selectedGenres.join(', ')}`;
          }
          return formData.selectedGenres.join(', ');
        })(),
        description: formData.description || null,
        difficulty_level: formData.difficulty_level || null,
        genre: formData.selectedGenres.length > 0 ? formData.selectedGenres.join(', ') : null,
        class_type: formData.class_type || 'regular',
        thumbnail_url: formData.thumbnail_url || null,
        poster_url: formData.poster_url || null,
        price: formData.price || 0,
        base_salary: parseNumberFromString(formData.base_salary),
        base_student_count: formData.base_student_count ? parseInt(formData.base_student_count, 10) : null,
        additional_salary_per_student: formData.additional_salary_per_student ? parseNumberFromString(formData.additional_salary_per_student) : null,
      };

      if (editingId) {
        // 수정 모드: 클래스만 업데이트
        const { error: classError } = await (supabase as any)
          .from('classes')
          .update(classData)
          .eq('id', editingId);

        if (classError) throw classError;
      } else {
        // 생성 모드: 클래스와 시간표를 동시에 생성
        const { data: newClass, error: classError } = await (supabase as any)
          .from('classes')
          .insert([classData])
          .select()
          .single();

        if (classError) throw classError;

        // 시간표 생성
        const scheduleData: any = {
          class_id: newClass.id,
          hall_id: formData.hall_id || null,
          instructor_id: formData.instructor_id || null,
          start_time: formData.start_time,
          end_time: formData.end_time,
          max_students: Number(formData.max_students),
          current_students: 0,
          is_canceled: false,
        };

        const { error: scheduleError } = await (supabase as any)
          .from('schedules')
          .insert([scheduleData]);

        if (scheduleError) throw scheduleError;
      }

      await loadData();
      setShowForm(false);
      setEditingId(null);
      resetForm();
    } catch (error) {
      console.error('Error saving class:', error);
      alert('클래스 저장에 실패했습니다.');
    }
  };

  const resetForm = () => {
    setFormData({
      academy_id: '',
      hall_id: '',
      instructor_id: '',
      difficulty_level: '',
      selectedGenres: [],
      class_type: '',
      price: 0,
      title: '',
      description: '',
      thumbnail_url: '',
      poster_url: '',
      song: '',
      start_time: '',
      end_time: '',
      max_students: 20,
      base_salary: '',
      base_student_count: '',
      additional_salary_per_student: '',
    });
    setHalls([]);
  };

  const handleEdit = (classItem: ClassWithRelations) => {
    setEditingId(classItem.id);
    const firstSchedule = classItem.schedules?.[0];
    const genres = classItem.genre
      ? classItem.genre.split(',').map(g => g.trim()).filter(g => GENRES.includes(g as typeof GENRES[number]))
      : [];

    setFormData({
      academy_id: classItem.academy_id || '',
      hall_id: firstSchedule?.hall_id || '',
      instructor_id: firstSchedule?.instructor_id || classItem.instructor_id || '',
      difficulty_level: classItem.difficulty_level || '',
      selectedGenres: genres,
      class_type: classItem.class_type || '',
      price: classItem.price || 0,
      title: classItem.title || '',
      description: classItem.description || '',
      thumbnail_url: classItem.thumbnail_url || '',
      poster_url: classItem.poster_url || '',
      song: (classItem as any).song || '',
      start_time: (firstSchedule && firstSchedule.start_time) ? new Date(firstSchedule.start_time).toISOString().slice(0, 16) : '',
      end_time: (firstSchedule && firstSchedule.end_time) ? new Date(firstSchedule.end_time).toISOString().slice(0, 16) : '',
      max_students: firstSchedule?.max_students || 20,
      base_salary: formatNumberWithCommas((classItem as any).base_salary || 0),
      base_student_count: (classItem as any).base_student_count ? String((classItem as any).base_student_count) : '',
      additional_salary_per_student: formatNumberWithCommas((classItem as any).additional_salary_per_student || 0),
    });

    if (classItem.academy_id) {
      loadHalls(classItem.academy_id);
    }

    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까? 관련된 시간표와 예약도 함께 삭제됩니다.')) return;

    const supabase = getSupabaseClient() as any;
    if (!supabase) return;

    try {
      // 먼저 관련 예약 삭제
      const schedules = classes.find(c => c.id === id)?.schedules || [];
      for (const schedule of schedules) {
        await supabase
          .from('bookings')
          .delete()
          .eq('schedule_id', schedule.id);
      }

      // 관련 시간표 삭제
      const { error: scheduleError } = await supabase
        .from('schedules')
        .delete()
        .eq('class_id', id);

      if (scheduleError) throw scheduleError;

      // 클래스 삭제
      const { error: classError } = await supabase
        .from('classes')
        .delete()
        .eq('id', id);

      if (classError) throw classError;

      await loadData();
    } catch (error) {
      console.error('Error deleting class:', error);
      alert('클래스 삭제에 실패했습니다.');
    }
  };

  const handleViewBookings = (classItem: ClassWithRelations) => {
    setSelectedClassId(classItem.id);
    setShowBookings(true);
  };

  const toggleGenre = (genre: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedGenres: prev.selectedGenres.includes(genre)
        ? prev.selectedGenres.filter((g) => g !== genre)
        : [...prev.selectedGenres, genre],
    }));
  };

  const removeGenre = (genre: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedGenres: prev.selectedGenres.filter((g) => g !== genre),
    }));
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getBookingsForClass = (classItem: ClassWithRelations) => {
    const allBookings: (Booking & { users: User | null; schedule: Schedule })[] = [];
    classItem.schedules?.forEach((schedule) => {
      schedule.bookings?.forEach((booking) => {
        allBookings.push({
          ...booking,
          users: booking.users,
          schedule: schedule as Schedule,
        });
      });
    });
    return allBookings;
  };

  if (loading) {
    return <div className="text-center py-12">로딩 중...</div>;
  }

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const bookings = selectedClass ? getBookingsForClass(selectedClass) : [];
  const selectedHall = halls.find(h => h.id === formData.hall_id);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">클래스 관리</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            클래스, 시간표, 예약을 함께 관리할 수 있습니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              resetForm();
            }}
            className="px-4 py-2 bg-primary dark:bg-[#CCFF00] text-black rounded-lg hover:opacity-90 flex items-center gap-2"
          >
            <Plus size={20} />
            {showForm ? '취소' : '클래스 추가'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 mb-6">
          <h2 className="text-xl font-bold text-black dark:text-white mb-4">
            {editingId ? '클래스 수정' : '새 클래스 등록'}
          </h2>
          
          <div className="space-y-6">
            {/* 1. 학원 선택 */}
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                1. 학원 *
              </label>
              <select
                required
                value={formData.academy_id}
                onChange={(e) => setFormData({ ...formData, academy_id: e.target.value, hall_id: '', max_students: 20 })}
                className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
              >
                <option value="">학원 선택</option>
                {academies.map((academy) => {
                  const nameKr = academy.name_kr;
                  const nameEn = academy.name_en;
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


            {/* 3. 홀 선택 */}
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                3. 홀
              </label>
              <select
                value={formData.hall_id}
                onChange={(e) => {
                  const selectedHall = halls.find(h => h.id === e.target.value);
                  setFormData({ 
                    ...formData, 
                    hall_id: e.target.value,
                    max_students: selectedHall?.capacity || 20
                  });
                }}
                disabled={!formData.academy_id || halls.length === 0}
                className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white disabled:opacity-50"
              >
                <option value="">홀 선택 (선택사항)</option>
                {halls.map((hall) => (
                  <option key={hall.id} value={hall.id}>
                    {hall.name} {hall.capacity && hall.capacity > 0 && `(${hall.capacity}명)`}
                  </option>
                ))}
              </select>
              {!formData.academy_id && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  먼저 학원을 선택해주세요
                </p>
              )}
            </div>

            {/* 4. 강사 선택 */}
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                4. 강사 *
              </label>
              <select
                required
                value={formData.instructor_id}
                onChange={(e) => setFormData({ ...formData, instructor_id: e.target.value })}
                className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
              >
                <option value="">강사 선택</option>
                {instructors.map((instructor) => {
                  const nameKr = instructor.name_kr;
                  const nameEn = instructor.name_en;
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

            {/* 5. 난이도 선택 */}
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                5. 난이도
              </label>
              <select
                value={formData.difficulty_level}
                onChange={(e) => setFormData({ ...formData, difficulty_level: e.target.value })}
                className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
              >
                <option value="">선택</option>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
                <option value="Master">Master</option>
                <option value="All Level">All Level</option>
              </select>
            </div>

            {/* 6. 장르 선택 (칩 형태) */}
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                6. 장르 *
              </label>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {GENRES.map((genre) => {
                    const isSelected = formData.selectedGenres.includes(genre);
                    return (
                      <button
                        key={genre}
                        type="button"
                        onClick={() => toggleGenre(genre)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-primary dark:bg-[#CCFF00] text-black'
                            : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700'
                        }`}
                      >
                        {genre}
                      </button>
                    );
                  })}
                </div>
                {formData.selectedGenres.length > 0 && (
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">선택된 장르:</span>
                    {formData.selectedGenres.map((genre) => (
                      <span
                        key={genre}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-primary/20 dark:bg-[#CCFF00]/20 text-primary dark:text-[#CCFF00] rounded-full text-sm"
                      >
                        {genre}
                        <button
                          type="button"
                          onClick={() => removeGenre(genre)}
                          className="hover:opacity-70"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 7. 클래스 타입 */}
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                7. 클래스 타입 *
              </label>
              <select
                required
                value={formData.class_type}
                onChange={(e) => setFormData({ ...formData, class_type: e.target.value })}
                className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
              >
                <option value="">선택</option>
                <option value="REGULAR">정규반</option>
                <option value="ONE_DAY">원데이</option>
                <option value="PRIVATE">개인레슨</option>
                <option value="RENTAL">대관</option>
              </select>
            </div>

            {/* 8. 클래스 요금 */}
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                클래스 요금 (원)
              </label>
              <input
                type="number"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                placeholder="0"
              />
            </div>

            {/* 페이 책정 */}
            <div>
              <h3 className="text-lg font-semibold text-black dark:text-white mb-4">페이 책정</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-black dark:text-white mb-2">
                    기본급 * <span className="text-xs text-neutral-500">(원)</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                    value={formData.base_salary}
                    onChange={(e) => {
                      const formatted = formatNumberInput(e.target.value);
                      setFormData({ ...formData, base_salary: formatted });
                    }}
                    placeholder="예: 50,000"
                  />
                </div>

                <div className="bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-lg space-y-3">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                    인원이 <span className="font-semibold">기본 인원 수</span> 이상일 경우, 기본 인원을 제외한 추가 인원당 추가 지급
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-black dark:text-white mb-2">
                        기본 인원 수 <span className="text-xs text-neutral-500">(명)</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                        value={formData.base_student_count}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || /^\d+$/.test(value)) {
                            setFormData({ ...formData, base_student_count: value });
                          }
                        }}
                        placeholder="예: 10"
                      />
                      <p className="text-xs text-neutral-500 mt-1">이 인원까지는 기본급만 지급</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-black dark:text-white mb-2">
                        추가 인원당 금액 <span className="text-xs text-neutral-500">(원)</span>
                      </label>
                      <input
                        type="text"
                        className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                        value={formData.additional_salary_per_student}
                        onChange={(e) => {
                          const formatted = formatNumberInput(e.target.value);
                          setFormData({ ...formData, additional_salary_per_student: formatted });
                        }}
                        placeholder="예: 5,000"
                      />
                      <p className="text-xs text-neutral-500 mt-1">기본 인원 초과 시 인원당 추가 지급</p>
                    </div>
                  </div>

                  <div className="text-xs text-neutral-500 dark:text-neutral-400 bg-white dark:bg-neutral-900 p-2 rounded border border-neutral-200 dark:border-neutral-700">
                    <p className="font-semibold mb-1">예시:</p>
                    <p>기본급: 50,000원, 기본 인원: 10명, 추가 인원당: 5,000원</p>
                    <p>→ 10명까지: 50,000원, 11명: 55,000원, 12명: 60,000원</p>
                    <p className="mt-2 text-neutral-400">* 기본급만 있는 경우: 기본 인원 수와 추가 인원당 금액은 비워두세요</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 9. 시간표 정보 */}
            <div>
              <h3 className="text-lg font-semibold text-black dark:text-white mb-4">8. 시간표 정보</h3>
              <div className="space-y-4">
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
                <div>
                  <label className="block text-sm font-medium text-black dark:text-white mb-2">
                    최대 인원 * {selectedHall && selectedHall.capacity && selectedHall.capacity > 0 && (
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        (홀 수용 인원: {selectedHall.capacity}명)
                      </span>
                    )}
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
              </div>
            </div>

            {/* 추가 정보 */}
            <div>
              <h3 className="text-lg font-semibold text-black dark:text-white mb-4">추가 정보</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-black dark:text-white mb-2">
                    클래스명
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="자동 생성되거나 수동 입력"
                    className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black dark:text-white mb-2">
                    노래
                  </label>
                  <input
                    type="text"
                    value={formData.song}
                    onChange={(e) => setFormData({ ...formData, song: e.target.value })}
                    placeholder="노래 제목"
                    className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black dark:text-white mb-2">
                    설명
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black dark:text-white mb-2">
                    썸네일 URL
                  </label>
                  <input
                    type="url"
                    value={formData.thumbnail_url}
                    onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                    placeholder="영상 썸네일 URL"
                    className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black dark:text-white mb-2">
                    포스터 URL
                  </label>
                  <input
                    type="url"
                    value={formData.poster_url}
                    onChange={(e) => setFormData({ ...formData, poster_url: e.target.value })}
                    placeholder="수업 포스터 이미지 URL"
                    className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                  />
                </div>
              </div>
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

      {showBookings && selectedClass && (
        <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-black dark:text-white">
              예약 현황 - {selectedClass.title}
            </h2>
            <button
              onClick={() => {
                setShowBookings(false);
                setSelectedClassId(null);
              }}
              className="px-4 py-2 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-700"
            >
              닫기
            </button>
          </div>
          {bookings.length === 0 ? (
            <p className="text-neutral-500 dark:text-neutral-400 text-center py-8">
              예약 내역이 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-100 dark:bg-neutral-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase">
                      사용자
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase">
                      예약 시간
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase">
                      상태
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase">
                      예약일
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {bookings.map((booking) => {
                    const user = booking.users as User | null;
                    return (
                      <tr key={booking.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black dark:text-white">
                          {user?.name || user?.email || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">
                          {formatDateTime(booking.schedule.start_time)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            booking.status === 'CONFIRMED'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                              : booking.status === 'CANCELLED'
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                              : booking.status === 'COMPLETED'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                          }`}>
                            {booking.status === 'CONFIRMED' ? '확정' :
                             booking.status === 'CANCELLED' ? '취소' :
                             booking.status === 'COMPLETED' ? '완료' : booking.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                          {formatDateTime(booking.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-100 dark:bg-neutral-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  클래스명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  학원
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  강사
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  시간
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  인원
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  예약
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {classes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-neutral-500 dark:text-neutral-400">
                    등록된 클래스가 없습니다.
                  </td>
                </tr>
              ) : (
                classes.map((classItem) => {
                  const schedule = classItem.schedules?.[0];
                  const bookingCount = getBookingsForClass(classItem).length;
                  return (
                    <tr 
                      key={classItem.id} 
                      className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer"
                      onClick={() => router.push(`/admin/classes/${classItem.id}`)}
                    >
                      <td className="px-6 py-4 text-sm font-medium text-black dark:text-white">
                        <span className="hover:text-primary dark:hover:text-[#CCFF00] hover:underline">
                          {classItem.title}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                        {(() => {
                          const academy = classItem.academies as Academy | null;
                          if (!academy) return '-';
                          const nameKr = academy.name_kr;
                          const nameEn = academy.name_en;
                          if (nameKr && nameEn) return `${nameKr} (${nameEn})`;
                          return nameKr || nameEn || '-';
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                        {(() => {
                          const instructor = (classItem.instructors as Instructor | null) || 
                            (schedule?.instructors as Instructor | null);
                          if (!instructor) return '-';
                          const nameKr = instructor.name_kr;
                          const nameEn = instructor.name_en;
                          if (nameKr && nameEn) return `${nameKr} (${nameEn})`;
                          return nameKr || nameEn || '-';
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                        {schedule ? formatDateTime(schedule.start_time) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                        {schedule ? `${schedule.current_students} / ${schedule.max_students}` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleViewBookings(classItem)}
                          className="flex items-center gap-1 text-primary dark:text-[#CCFF00] hover:opacity-80 text-sm"
                        >
                          <Users size={16} />
                          {bookingCount}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(classItem)}
                            className="text-primary dark:text-[#CCFF00] hover:opacity-80"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(classItem.id)}
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
