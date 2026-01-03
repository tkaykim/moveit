"use client";

import React, { useState, useEffect } from 'react';
import { 
  Home, MapPin, User, Calendar, Search, Bell, 
  ChevronLeft, QrCode, Heart, Star, Clock, Music, CheckCircle, X
} from 'lucide-react';
import { Database } from '@/types/database';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

// --- Types ---
type ViewState = 'HOME' | 'ACADEMY' | 'INSTRUCTOR' | 'SCHEDULE' | 'MY' | 'DETAIL_ACADEMY' | 'DETAIL_INSTRUCTOR' | 'BOOKING';
type Academy = Database['public']['Tables']['academies']['Row'] & { name_ko?: string; images?: string[]; phone?: string };
type Instructor = Database['public']['Tables']['instructors']['Row'] & { 
  like?: number; // 총 찜 개수
  isLiked?: boolean; // 현재 사용자가 찜했는지 여부
};
type Class = Database['public']['Tables']['classes']['Row'];

export default function MoveItApp() {
  const [activeTab, setActiveTab] = useState<ViewState>('HOME');
  const [history, setHistory] = useState<ViewState[]>(['HOME']);
  
  // Data State
  const [academies, setAcademies] = useState<(Academy & { isLiked?: boolean; likeCount?: number })[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  
  // Selection State
  const [selectedAcademy, setSelectedAcademy] = useState<Academy | null>(null);
  const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);

  // --- Handlers ---
  const navigateTo = (view: ViewState) => {
    setHistory(prev => [...prev, view]);
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

  // Load instructors data
  useEffect(() => {
    const loadInstructors = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      try {
        // 현재 사용자 정보 가져오기
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id;

        // 강사 목록 가져오기
        const { data: instructorsData, error: instructorsError } = await (supabase as any)
          .from('instructors')
          .select('*')
          .order('created_at', { ascending: false });

        if (instructorsError) {
          console.error('강사 목록 로드 에러:', instructorsError);
          throw instructorsError;
        }

        // 사용자의 찜 목록 가져오기 (별도 쿼리로 성능 최적화)
        let userFavoriteInstructorIds: string[] = [];
        if (userId) {
          const { data: favoritesData, error: favoritesError } = await (supabase as any)
            .from('instructor_favorites')
            .select('instructor_id')
            .eq('user_id', userId);

          if (!favoritesError && favoritesData) {
            userFavoriteInstructorIds = favoritesData.map((fav: any) => fav.instructor_id);
          }
        }

        // 각 강사의 총 찜 개수 가져오기
        const instructorIds = (instructorsData || []).map((inst: any) => inst.id);
        let likeCountsMap: Record<string, number> = {};
        
        if (instructorIds.length > 0) {
          const { data: likeCountsData, error: likeCountsError } = await (supabase as any)
            .from('instructor_favorites')
            .select('instructor_id')
            .in('instructor_id', instructorIds);

          if (!likeCountsError && likeCountsData) {
            // 각 강사별 찜 개수 계산
            likeCountsData.forEach((fav: any) => {
              likeCountsMap[fav.instructor_id] = (likeCountsMap[fav.instructor_id] || 0) + 1;
            });
          }
        }

        // 각 강사의 총 찜 개수 계산 및 사용자별 찜 여부 확인
        const instructorsWithLikes = (instructorsData || []).map((inst: any) => {
          // 총 찜 개수
          const likeCount = likeCountsMap[inst.id] || 0;
          // 사용자가 찜했는지 여부
          const isLiked = userFavoriteInstructorIds.includes(inst.id);
          
          return {
            ...inst,
            like: likeCount,
            isLiked: isLiked
          };
        });

        console.log('강사 데이터 로드 완료:', {
          total: instructorsWithLikes.length,
          instructors: instructorsWithLikes.map((i: any) => ({ id: i.id, name: i.name_kr || i.name_en }))
        });
        setInstructors(instructorsWithLikes);
      } catch (error) {
        console.error('Error loading instructors:', error);
        // 에러 발생 시에도 빈 배열로 설정하여 UI가 정상적으로 표시되도록 함
        setInstructors([]);
      }
    };

    loadInstructors();
  }, []);

  // Load academies data
  useEffect(() => {
    const loadAcademies = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      try {
        // 현재 사용자 정보 가져오기
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id;

        // 학원 목록과 찜 정보 가져오기
        const { data: academiesData, error: academiesError } = await (supabase as any)
          .from('academies')
          .select(`
            *,
            academy_favorites!left(id, user_id)
          `)
          .order('created_at', { ascending: false });

        if (academiesError) throw academiesError;

        // 사용자의 찜 목록 가져오기
        let userFavoriteAcademyIds: string[] = [];
        if (userId) {
          const { data: favoritesData, error: favoritesError } = await (supabase as any)
            .from('academy_favorites')
            .select('academy_id')
            .eq('user_id', userId);

          if (!favoritesError && favoritesData) {
            userFavoriteAcademyIds = favoritesData.map((fav: any) => fav.academy_id);
          }
        }

        // 각 학원의 총 찜 개수 계산 및 사용자별 찜 여부 확인
        const academiesWithLikes = (academiesData || []).map((academy: any) => {
          const likeCount = academy.academy_favorites?.length || 0;
          const isLiked = userFavoriteAcademyIds.includes(academy.id);
          
          return {
            ...academy,
            likeCount: likeCount,
            isLiked: isLiked
          };
        });

        setAcademies(academiesWithLikes);
      } catch (error) {
        console.error('Error loading academies:', error);
      }
    };

    loadAcademies();
  }, []);

  // --- Views ---
  
  const HomeView = () => (
    <div className="space-y-6 pb-24 p-5 animate-in fade-in duration-300">
      <header className="pt-4 flex justify-between items-center">
        <h1 className="text-xl font-black italic tracking-tighter text-white">MOVE<span className="text-[#CCFF00]">.</span>IT</h1>
        <div className="flex gap-4">
          <button className="relative"><Bell className="text-neutral-400" size={20} /></button>
          <button className="relative"><Search className="text-neutral-400" size={20} /></button>
        </div>
      </header>
      
      {/* Banner */}
      <div className="w-full h-48 rounded-3xl bg-gradient-to-br from-purple-700 via-blue-600 to-indigo-800 p-8 flex flex-col justify-end relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
        <span className="absolute top-5 right-5 bg-black/30 text-white px-2 py-1 rounded-lg text-[10px] font-bold backdrop-blur-md border border-white/10">PROMO</span>
        <h2 className="text-2xl font-black text-white leading-tight tracking-tight">1MILLION<br/>SUMMER WORKSHOP</h2>
        <p className="text-white/70 text-xs mt-2 font-medium">Early bird tickets available now</p>
      </div>

      {/* Quick Menu */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { icon: "🗓️", label: "정규반" },
          { icon: "🔥", label: "팝업" },
          { icon: "💃", label: "강사" },
          { icon: "🎫", label: "수강권" }
        ].map((item, idx) => (
          <button key={idx} className="flex flex-col items-center gap-2 group">
            <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-2xl shadow-xl group-active:scale-95 group-active:border-[#CCFF00] transition-all">
              {item.icon}
            </div>
            <span className="text-[11px] font-bold text-neutral-500 group-active:text-[#CCFF00]">{item.label}</span>
          </button>
        ))}
      </div>
      
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">추천 <span className="text-[#CCFF00]">HOT</span> 장르 🔥</h2>
          <span className="text-[10px] text-neutral-500 font-bold">전체보기</span>
        </div>
        <div className="flex gap-4 overflow-x-auto scrollbar-hide -mx-5 px-5">
          {['HIPHOP', 'K-POP', 'CHOREO', 'GIRLISH'].map((genre, i) => (
            <div key={i} className="w-36 h-48 bg-neutral-900 rounded-2xl flex-shrink-0 relative overflow-hidden border border-neutral-800 shadow-lg">
               <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
               <div className="absolute bottom-4 left-4">
                  <span className="text-[9px] bg-[#CCFF00] text-black px-2 py-0.5 rounded-full font-black mb-1 inline-block">{genre}</span>
                  <div className="text-white font-bold text-sm">NewJeans - How Sweet</div>
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const AcademyView = () => {
    const handleAcademyLikeClick = (e: React.MouseEvent, academyId: string, isLiked: boolean) => {
      e.stopPropagation();
      toggleAcademyLike(academyId, isLiked);
    };

    return (
      <div className="pb-24 pt-12 px-5 animate-in slide-in-from-right-10 duration-300">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-white italic">ACADEMIES</h2>
          <div className="flex gap-2">
              <button className="text-[10px] bg-neutral-800 text-neutral-300 px-3 py-1.5 rounded-full border border-neutral-700 font-bold">거리순</button>
              <button className="text-[10px] bg-neutral-800 text-neutral-300 px-3 py-1.5 rounded-full border border-neutral-700 font-bold">필터</button>
          </div>
        </div>
        {academies.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-neutral-500 text-sm">등록된 학원이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {academies.map(academy => (
              <div 
                key={academy.id} 
                onClick={() => { setSelectedAcademy(academy); navigateTo('DETAIL_ACADEMY'); }} 
                className="bg-neutral-900 rounded-3xl overflow-hidden border border-neutral-800 active:scale-[0.98] transition-transform shadow-xl relative"
              >
                <div className="h-36 bg-neutral-800 relative">
                  {academy.logo_url && (
                    <img 
                      src={academy.logo_url} 
                      alt={academy.name_kr || academy.name_en || '학원'}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] text-white font-bold border border-white/10">
                    {academy.address || '주소 없음'}
                  </div>
                  <button
                    onClick={(e) => handleAcademyLikeClick(e, academy.id, academy.isLiked || false)}
                    className="absolute top-4 right-4 z-10 p-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 transition-all hover:bg-black/60 flex items-center gap-1.5"
                  >
                    <Heart 
                      size={18} 
                      className={academy.isLiked ? 'text-red-500 fill-red-500' : 'text-white'} 
                    />
                    {(academy.likeCount || 0) > 0 && (
                      <span className="text-[10px] text-white font-bold">{academy.likeCount}</span>
                    )}
                  </button>
                </div>
                <div className="p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold text-white">{academy.name_kr || academy.name_en}</h3>
                      <p className="text-xs text-neutral-500 mt-1">{academy.address || ''}</p>
                    </div>
                    <div className="flex items-center gap-1 text-[#CCFF00] text-sm font-black">
                      <Star size={14} fill="#CCFF00" /> 4.9
                    </div>
                  </div>
                  {academy.tags && (
                    <div className="mt-4 flex gap-2 flex-wrap">
                      {academy.tags.split(',').slice(0, 3).map((tag, idx) => (
                        <span key={idx} className="text-[9px] text-neutral-400 bg-neutral-800 px-2 py-1 rounded-lg border border-neutral-700 font-medium">
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const toggleInstructorLike = async (instructorId: string, isCurrentlyLiked: boolean) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      // 현재 사용자 정보 가져오기
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('로그인이 필요합니다.');
        return;
      }

      if (isCurrentlyLiked) {
        // 찜 취소: instructor_favorites에서 삭제
        const { error: deleteError } = await (supabase as any)
          .from('instructor_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('instructor_id', instructorId);

        if (deleteError) throw deleteError;
      } else {
        // 찜 추가: instructor_favorites에 추가
        const { error: insertError } = await (supabase as any)
          .from('instructor_favorites')
          .insert({
            user_id: user.id,
            instructor_id: instructorId
          });

        if (insertError) {
          // 중복 에러는 무시 (이미 찜한 경우)
          if (insertError.code !== '23505') {
            throw insertError;
          }
        }
      }

      // 강사 목록 다시 로드하여 최신 찜 개수 반영
      const { data: { user: reloadUser } } = await supabase.auth.getUser();
      const userId = reloadUser?.id;

      // 강사 목록과 찜 정보 다시 가져오기
      const { data: instructorsData, error: instructorsError } = await (supabase as any)
        .from('instructors')
        .select(`
          *,
          instructor_favorites!left(id, user_id)
        `)
        .order('created_at', { ascending: false });

      if (instructorsError) throw instructorsError;

      // 사용자의 찜 목록 다시 가져오기
      let userFavoriteInstructorIds: string[] = [];
      if (userId) {
        const { data: favoritesData } = await (supabase as any)
          .from('instructor_favorites')
          .select('instructor_id')
          .eq('user_id', userId);

        if (favoritesData) {
          userFavoriteInstructorIds = favoritesData.map((fav: any) => fav.instructor_id);
        }
      }

      // 상태 업데이트
      const updatedInstructors = (instructorsData || []).map((inst: any) => {
        const likeCount = inst.instructor_favorites?.length || 0;
        const isLiked = userFavoriteInstructorIds.includes(inst.id);
        
        return {
          ...inst,
          like: likeCount,
          isLiked: isLiked
        };
      });

      setInstructors(updatedInstructors);
    } catch (error) {
      console.error('Error toggling instructor like:', error);
      alert('찜 기능을 사용할 수 없습니다.');
    }
  };

  const toggleAcademyLike = async (academyId: string, isCurrentlyLiked: boolean) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      // 현재 사용자 정보 가져오기
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('로그인이 필요합니다.');
        return;
      }

      if (isCurrentlyLiked) {
        // 찜 취소: academy_favorites에서 삭제
        const { error: deleteError } = await (supabase as any)
          .from('academy_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('academy_id', academyId);

        if (deleteError) throw deleteError;
      } else {
        // 찜 추가: academy_favorites에 추가
        const { error: insertError } = await (supabase as any)
          .from('academy_favorites')
          .insert({
            user_id: user.id,
            academy_id: academyId
          });

        if (insertError) {
          // 중복 에러는 무시 (이미 찜한 경우)
          if (insertError.code !== '23505') {
            throw insertError;
          }
        }
      }

      // 학원 목록 다시 로드
      const { data: { user: reloadUser } } = await supabase.auth.getUser();
      const userId = reloadUser?.id;

      // 학원 목록과 찜 정보 다시 가져오기
      const { data: academiesData, error: academiesError } = await (supabase as any)
        .from('academies')
        .select(`
          *,
          academy_favorites!left(id, user_id)
        `)
        .order('created_at', { ascending: false });

      if (academiesError) throw academiesError;

      // 사용자의 찜 목록 다시 가져오기
      let userFavoriteAcademyIds: string[] = [];
      if (userId) {
        const { data: favoritesData } = await (supabase as any)
          .from('academy_favorites')
          .select('academy_id')
          .eq('user_id', userId);

        if (favoritesData) {
          userFavoriteAcademyIds = favoritesData.map((fav: any) => fav.academy_id);
        }
      }

      // 상태 업데이트
      const updatedAcademies = (academiesData || []).map((academy: any) => {
        const likeCount = academy.academy_favorites?.length || 0;
        const isLiked = userFavoriteAcademyIds.includes(academy.id);
        
        return {
          ...academy,
          likeCount: likeCount,
          isLiked: isLiked
        };
      });

      setAcademies(updatedAcademies);
    } catch (error) {
      console.error('Error toggling academy like:', error);
      alert('찜 기능을 사용할 수 없습니다.');
    }
  };

  const InstructorView = () => {
    const handleLikeClick = (e: React.MouseEvent, instructor: Instructor) => {
      e.stopPropagation();
      toggleInstructorLike(instructor.id, instructor.isLiked || false);
    };

    const getGenreFromSpecialties = (specialties: string | null) => {
      if (!specialties) return 'ALL';
      return specialties.split(',')[0]?.trim().toUpperCase() || 'ALL';
    };

    const getCrewFromSpecialties = (specialties: string | null) => {
      if (!specialties) return '';
      return specialties.split(',')[1]?.trim() || '';
    };

    return (
      <div className="pb-24 pt-12 px-5 animate-in slide-in-from-right-10 duration-300">
        <h2 className="text-2xl font-black text-white italic mb-6">INSTRUCTORS</h2>
        {instructors.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-neutral-500 text-sm">등록된 강사가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {instructors.map(instructor => {
              const name = instructor.name_kr || instructor.name_en || '이름 없음';
              const genre = getGenreFromSpecialties(instructor.specialties);
              const crew = getCrewFromSpecialties(instructor.specialties);
              
              return (
                <div 
                  key={instructor.id} 
                  onClick={() => { setSelectedInstructor(instructor); navigateTo('DETAIL_INSTRUCTOR'); }} 
                  className="relative aspect-[3/4] rounded-3xl bg-neutral-900 overflow-hidden border border-neutral-800 group transition-all active:scale-95 shadow-xl"
                >
                  {instructor.profile_image_url ? (
                    <img 
                      src={instructor.profile_image_url} 
                      alt={name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-neutral-800" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  <button
                    onClick={(e) => handleLikeClick(e, instructor)}
                    className="absolute top-4 right-4 z-10 p-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 transition-all hover:bg-black/60 flex items-center gap-1.5"
                  >
                    <Heart 
                      size={18} 
                      className={instructor.isLiked ? 'text-red-500 fill-red-500' : 'text-white'} 
                    />
                    {(instructor.like || 0) > 0 && (
                      <span className="text-[10px] text-white font-bold">{instructor.like}</span>
                    )}
                  </button>
                  <div className="absolute bottom-5 left-5">
                    {crew && (
                      <span className="text-[9px] text-[#CCFF00] font-black border border-[#CCFF00]/30 px-2 py-0.5 rounded-full mb-2 inline-block">{crew}</span>
                    )}
                    <h3 className="text-lg font-black text-white leading-none italic tracking-tighter">{name}</h3>
                    {genre !== 'ALL' && (
                      <p className="text-[10px] text-neutral-500 mt-1 font-bold uppercase tracking-widest">{genre}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const MyView = () => {
    const [activeMyTab, setActiveMyTab] = useState<'main' | 'favorites'>('main');
    const [favoriteType, setFavoriteType] = useState<'instructor' | 'academy'>('instructor');
    const [userName, setUserName] = useState<string>('사용자');
    const [userLevel, setUserLevel] = useState<string>('');
    const favoriteInstructors = instructors.filter(inst => inst.isLiked === true);
    const favoriteAcademies = academies.filter(academy => academy.isLiked === true);

    useEffect(() => {
      const loadUserInfo = async () => {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data: userProfile } = await (supabase as any)
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

          if (userProfile) {
            setUserName(userProfile.name || userProfile.nickname || user.email || '사용자');
            // 레벨 정보는 필요시 추가 로직으로 계산
            setUserLevel('');
          }
        } catch (error) {
          console.error('사용자 정보 로드 에러:', error);
        }
      };

      loadUserInfo();
    }, []);

    const getGenreFromSpecialties = (specialties: string | null) => {
      if (!specialties) return 'ALL';
      return specialties.split(',')[0]?.trim().toUpperCase() || 'ALL';
    };

    const getCrewFromSpecialties = (specialties: string | null) => {
      if (!specialties) return '';
      return specialties.split(',')[1]?.trim() || '';
    };

    return (
      <div className="pt-12 px-5 pb-24 animate-in fade-in h-full flex flex-col">
        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#CCFF00] to-green-500 p-[2px] shadow-lg shadow-[#CCFF00]/10">
                    <div className="w-full h-full rounded-3xl bg-black flex items-center justify-center"><User className="text-white" size={28} /></div>
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">{userName}</h2>
                    {userLevel && (
                      <div className="flex gap-2 mt-1">
                        <span className="text-[9px] text-[#CCFF00] font-black border border-[#CCFF00]/30 bg-[#CCFF00]/10 px-2 py-0.5 rounded-full">{userLevel}</span>
                      </div>
                    )}
                </div>
            </div>
            <button className="bg-neutral-900 p-3 rounded-2xl border border-neutral-800 text-neutral-400 hover:text-white transition-colors"><Bell size={20} /></button>
        </div>

        {activeMyTab === 'main' ? (
          <>
            <button className="w-full bg-white text-black rounded-[32px] p-7 flex items-center justify-between mb-8 shadow-2xl shadow-[#CCFF00]/10 active:scale-[0.98] transition-all">
                <div className="flex items-center gap-5">
                    <div className="bg-black text-white p-4 rounded-2xl shadow-xl shadow-black/20"><QrCode size={36} strokeWidth={2.5} /></div>
                    <div className="text-left">
                        <div className="text-xl font-black italic tracking-tighter">QR CHECK-IN</div>
                        <div className="text-[10px] text-neutral-500 font-bold mt-0.5">입장 시 리더기에 태그해주세요</div>
                    </div>
                </div>
                <ChevronLeft className="rotate-180 text-black opacity-30" size={24} />
            </button>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-neutral-900 border border-neutral-800 rounded-[32px] p-6 h-44 flex flex-col justify-between shadow-xl">
                    <span className="text-[11px] font-black text-neutral-500 uppercase tracking-widest">수강권</span>
                    <div className="text-center">
                        <span className="text-4xl font-black text-white italic">3</span>
                        <span className="text-sm text-neutral-600 font-bold ml-1">/ 10회</span>
                    </div>
                    <div className="text-[10px] text-neutral-500 text-center font-bold">유효기간 D-24</div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-[32px] p-6 h-44 flex flex-col justify-between shadow-xl">
                    <span className="text-[11px] font-black text-neutral-500 uppercase tracking-widest">출석</span>
                    <div className="text-center">
                        <span className="text-4xl font-black text-[#CCFF00] italic">12</span>
                        <span className="text-sm text-neutral-600 font-bold ml-1">회</span>
                    </div>
                    <button className="bg-neutral-800 py-2 rounded-xl text-[9px] text-white font-black uppercase tracking-widest hover:bg-neutral-700 transition-colors">기록 보기</button>
                </div>
            </div>

            <div className="space-y-3">
              <button 
                onClick={() => { setActiveMyTab('favorites'); setFavoriteType('instructor'); }}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-[32px] p-6 flex items-center justify-between shadow-xl active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-neutral-800 p-3 rounded-2xl">
                    <Heart className="text-red-500" size={24} fill="currentColor" />
                  </div>
                  <div className="text-left">
                    <div className="text-lg font-black text-white italic tracking-tighter">강사 찜</div>
                    <div className="text-[10px] text-neutral-500 font-bold mt-0.5">{favoriteInstructors.length}명의 찜한 강사</div>
                  </div>
                </div>
                <ChevronLeft className="rotate-180 text-neutral-500" size={20} />
              </button>
              
              <button 
                onClick={() => { setActiveMyTab('favorites'); setFavoriteType('academy'); }}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-[32px] p-6 flex items-center justify-between shadow-xl active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-neutral-800 p-3 rounded-2xl">
                    <Heart className="text-red-500" size={24} fill="currentColor" />
                  </div>
                  <div className="text-left">
                    <div className="text-lg font-black text-white italic tracking-tighter">학원 찜</div>
                    <div className="text-[10px] text-neutral-500 font-bold mt-0.5">{favoriteAcademies.length}개의 찜한 학원</div>
                  </div>
                </div>
                <ChevronLeft className="rotate-180 text-neutral-500" size={20} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1">
            <div className="flex items-center justify-between mb-6">
              <button 
                onClick={() => setActiveMyTab('main')}
                className="p-2 -ml-2"
              >
                <ChevronLeft className="text-white" size={24} />
              </button>
              <h2 className="text-2xl font-black text-white italic">
                {favoriteType === 'instructor' ? '강사 찜' : '학원 찜'}
              </h2>
              <div className="w-10"></div>
            </div>

            {/* 탭 전환 버튼 */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setFavoriteType('instructor')}
                className={`flex-1 py-2.5 text-[11px] font-black rounded-xl transition-all ${
                  favoriteType === 'instructor' 
                    ? 'bg-white text-black shadow-lg' 
                    : 'text-neutral-500 hover:text-white bg-neutral-900'
                }`}
              >
                강사
              </button>
              <button
                onClick={() => setFavoriteType('academy')}
                className={`flex-1 py-2.5 text-[11px] font-black rounded-xl transition-all ${
                  favoriteType === 'academy' 
                    ? 'bg-white text-black shadow-lg' 
                    : 'text-neutral-500 hover:text-white bg-neutral-900'
                }`}
              >
                학원
              </button>
            </div>

            {favoriteType === 'instructor' ? (
              favoriteInstructors.length === 0 ? (
                <div className="text-center py-12">
                  <Heart className="text-neutral-600 mx-auto mb-4" size={48} />
                  <p className="text-neutral-500 text-sm">찜한 강사가 없습니다.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {favoriteInstructors.map(instructor => {
                    const name = instructor.name_kr || instructor.name_en || '이름 없음';
                    const genre = getGenreFromSpecialties(instructor.specialties);
                    const crew = getCrewFromSpecialties(instructor.specialties);
                    
                    return (
                      <div 
                        key={instructor.id} 
                        onClick={() => { setSelectedInstructor(instructor); navigateTo('DETAIL_INSTRUCTOR'); }} 
                        className="relative aspect-[3/4] rounded-3xl bg-neutral-900 overflow-hidden border border-neutral-800 group transition-all active:scale-95 shadow-xl"
                      >
                        {instructor.profile_image_url ? (
                          <img 
                            src={instructor.profile_image_url} 
                            alt={name}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-neutral-800" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleInstructorLike(instructor.id, instructor.isLiked || false);
                          }}
                          className="absolute top-4 right-4 z-10 p-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 transition-all hover:bg-black/60 flex items-center gap-1.5"
                        >
                          <Heart size={18} className="text-red-500 fill-red-500" />
                          {(instructor.like || 0) > 0 && (
                            <span className="text-[10px] text-white font-bold">{instructor.like}</span>
                          )}
                        </button>
                        <div className="absolute bottom-5 left-5">
                          {crew && (
                            <span className="text-[9px] text-[#CCFF00] font-black border border-[#CCFF00]/30 px-2 py-0.5 rounded-full mb-2 inline-block">{crew}</span>
                          )}
                          <h3 className="text-lg font-black text-white leading-none italic tracking-tighter">{name}</h3>
                          {genre !== 'ALL' && (
                            <p className="text-[10px] text-neutral-500 mt-1 font-bold uppercase tracking-widest">{genre}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              favoriteAcademies.length === 0 ? (
                <div className="text-center py-12">
                  <Heart className="text-neutral-600 mx-auto mb-4" size={48} />
                  <p className="text-neutral-500 text-sm">찜한 학원이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {favoriteAcademies.map(academy => (
                    <div 
                      key={academy.id} 
                      onClick={() => { setSelectedAcademy(academy); navigateTo('DETAIL_ACADEMY'); }} 
                      className="bg-neutral-900 rounded-3xl overflow-hidden border border-neutral-800 active:scale-[0.98] transition-transform shadow-xl relative"
                    >
                      <div className="h-36 bg-neutral-800 relative">
                        {academy.logo_url && (
                          <img 
                            src={academy.logo_url} 
                            alt={academy.name_kr || academy.name_en || '학원'}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        )}
                        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] text-white font-bold border border-white/10">
                          {academy.address || '주소 없음'}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAcademyLike(academy.id, academy.isLiked || false);
                          }}
                          className="absolute top-4 right-4 z-10 p-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 transition-all hover:bg-black/60 flex items-center gap-1.5"
                        >
                          <Heart size={18} className="text-red-500 fill-red-500" />
                          {(academy.likeCount || 0) > 0 && (
                            <span className="text-[10px] text-white font-bold">{academy.likeCount}</span>
                          )}
                        </button>
                      </div>
                      <div className="p-5">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-xl font-bold text-white">{academy.name_kr || academy.name_en}</h3>
                            <p className="text-xs text-neutral-500 mt-1">{academy.address || ''}</p>
                          </div>
                          <div className="flex items-center gap-1 text-[#CCFF00] text-sm font-black">
                            <Star size={14} fill="#CCFF00" /> 4.9
                          </div>
                        </div>
                        {academy.tags && (
                          <div className="mt-4 flex gap-2 flex-wrap">
                            {academy.tags.split(',').slice(0, 3).map((tag, idx) => (
                              <span key={idx} className="text-[9px] text-neutral-400 bg-neutral-800 px-2 py-1 rounded-lg border border-neutral-700 font-medium">
                                {tag.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>
    );
  };

  const AcademyDetailView = () => (
    <div className="bg-neutral-950 min-h-screen pb-24 animate-in slide-in-from-right duration-300 relative">
      <div className="relative h-72 bg-neutral-800">
        <button onClick={goBack} className="absolute top-12 left-5 z-30 p-2.5 bg-black/40 backdrop-blur-xl rounded-2xl text-white border border-white/10"><ChevronLeft size={20} /></button>
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent" />
        <div className="absolute bottom-8 left-8">
           <span className="text-[#CCFF00] text-[10px] font-black border border-[#CCFF00] px-3 py-1 rounded-full mb-3 inline-block shadow-lg shadow-[#CCFF00]/20">PREMIUM PARTNER</span>
           <h1 className="text-4xl font-black text-white italic tracking-tighter">{selectedAcademy?.name_en || selectedAcademy?.name_ko}</h1>
           <p className="text-neutral-400 text-xs mt-2 font-medium">{selectedAcademy?.address}</p>
        </div>
      </div>
      
      <div className="flex p-5 gap-2 sticky top-0 bg-neutral-950/80 backdrop-blur-xl z-20 border-b border-neutral-900">
          {['HOME', 'SCHEDULE', 'INFO', 'REVIEW'].map((tab) => (
              <button key={tab} className={`flex-1 py-2.5 text-[11px] font-black rounded-xl transition-all ${tab === 'SCHEDULE' ? 'bg-white text-black shadow-lg' : 'text-neutral-500 hover:text-white'}`}>{tab}</button>
          ))}
      </div>

      <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
              <h3 className="text-white font-black text-lg italic tracking-tighter uppercase">Weekly Schedule</h3>
              <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-800"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-800"></span>
              </div>
          </div>
          
          <div className="space-y-4">
              {[1, 2, 3].map(i => (
                  <div key={i} onClick={() => navigateTo('BOOKING')} className="bg-neutral-900 border border-neutral-800 p-6 rounded-[32px] flex justify-between items-center group active:scale-[0.98] transition-all shadow-xl">
                      <div className="flex items-center gap-6">
                          <div className="text-center w-14">
                              <div className="text-[10px] text-neutral-500 font-black mb-1">MON</div>
                              <div className="text-lg font-black text-white italic">19:30</div>
                          </div>
                          <div className="h-10 w-[1px] bg-neutral-800"></div>
                          <div>
                              <div className="text-white font-black text-base italic tracking-tighter group-active:text-[#CCFF00] transition-colors">BADA LEE CLASS</div>
                              <div className="text-[10px] text-neutral-500 font-bold mt-1 uppercase tracking-widest">CHOREOGRAPHY • BEGINNER</div>
                          </div>
                      </div>
                      <button className="bg-neutral-800 p-3 rounded-2xl text-[#CCFF00] group-hover:bg-[#CCFF00] group-hover:text-black transition-all">
                          <ChevronLeft className="rotate-180" size={20} strokeWidth={3} />
                      </button>
                  </div>
              ))}
          </div>
      </div>
    </div>
  );

  const BookingView = () => (
    <div className="bg-neutral-950 min-h-screen p-8 animate-in slide-in-from-bottom duration-500">
      <div className="flex items-center justify-between mb-10">
        <button onClick={goBack} className="p-3 bg-neutral-900 rounded-2xl text-white border border-neutral-800"><X size={20} /></button>
        <h2 className="text-xl font-black text-white italic tracking-tighter">CHECKOUT</h2>
        <div className="w-12"></div>
      </div>

      <div className="bg-neutral-900 rounded-[40px] p-8 border border-neutral-800 mb-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-[#CCFF00]/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
        <div className="flex justify-between items-start mb-8 relative z-10">
           <div>
              <div className="text-[10px] text-neutral-500 font-black mb-2 uppercase tracking-widest">1MILLION Dance</div>
              <h3 className="text-3xl font-black text-white italic tracking-tighter leading-tight">BADA LEE<br/>CLASS</h3>
           </div>
           <div className="bg-neutral-800 p-3 rounded-2xl border border-neutral-700">
              <Music className="text-[#CCFF00]" size={20} />
           </div>
        </div>
        
        <div className="space-y-4 relative z-10">
            <div className="flex justify-between items-center text-sm border-b border-neutral-800 pb-4">
                <span className="text-neutral-500 font-bold">일정</span>
                <span className="text-white font-black italic">MON 19:30</span>
            </div>
            <div className="flex justify-between items-center pt-2">
                <span className="text-neutral-500 font-bold">결제 금액</span>
                <span className="text-2xl font-black text-[#CCFF00] italic">35,000 KRW</span>
            </div>
        </div>
      </div>

      <div className="space-y-4 mb-10">
         <h3 className="text-white font-black text-sm italic tracking-widest uppercase">Payment Method</h3>
         <button className="w-full bg-neutral-900 border-2 border-[#CCFF00] rounded-3xl p-6 flex justify-between items-center shadow-2xl shadow-[#CCFF00]/5 active:scale-95 transition-all">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-2xl bg-[#CCFF00]/10 flex items-center justify-center border border-[#CCFF00]/20"><Star className="text-[#CCFF00]" size={24} fill="#CCFF00" /></div>
               <div className="text-left">
                  <div className="text-white font-black text-sm italic tracking-tighter">MY TICKET</div>
                  <div className="text-[10px] text-neutral-500 font-bold">REMAINING: 3 CLASSES</div>
               </div>
            </div>
            <div className="w-6 h-6 rounded-full bg-[#CCFF00] flex items-center justify-center shadow-lg shadow-[#CCFF00]/20"><CheckCircle size={14} className="text-black" strokeWidth={3} /></div>
         </button>
      </div>

      <button onClick={() => navigateTo('HOME')} className="w-full bg-[#CCFF00] text-black font-black py-6 rounded-[32px] text-xl italic tracking-tighter shadow-2xl shadow-[#CCFF00]/20 active:scale-95 transition-all uppercase">Confirm Booking</button>
    </div>
  );

  return (
    <main className="flex-1 overflow-y-auto scrollbar-hide relative bg-neutral-950">
      <div className="flex-1">
        {activeTab === 'HOME' && <HomeView />}
        {activeTab === 'ACADEMY' && <AcademyView />}
        {activeTab === 'INSTRUCTOR' && <InstructorView />}
        {activeTab === 'MY' && <MyView />}
        {activeTab === 'DETAIL_ACADEMY' && <AcademyDetailView />}
        {activeTab === 'BOOKING' && <BookingView />}
        {/* Placeholder for SCHEDULE, etc */}
        {activeTab === 'SCHEDULE' && <div className="p-10 text-white font-black italic text-2xl animate-pulse">COMING SOON...</div>}
      </div>

      {/* Fixed Bottom Navigation */}
      {!['BOOKING'].includes(activeTab) && (
        <nav className="fixed bottom-0 w-full max-w-[420px] bg-neutral-950/90 backdrop-blur-2xl border-t border-white/5 pb-safe pt-2 px-8 flex justify-between items-center z-40 h-[90px] shadow-2xl">
          {[
            { id: 'HOME', icon: Home, label: '홈' },
            { id: 'ACADEMY', icon: MapPin, label: '학원' },
            { id: 'INSTRUCTOR', icon: User, label: '강사' },
            { id: 'SCHEDULE', icon: Calendar, label: '일정' },
            { id: 'MY', icon: User, label: '마이' }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id || (tab.id === 'ACADEMY' && activeTab === 'DETAIL_ACADEMY');
            return (
              <button 
                key={tab.id} 
                onClick={() => { setHistory(['HOME']); setActiveTab(tab.id as ViewState); }} 
                className={`flex flex-col items-center gap-1.5 transition-all duration-500 w-12 ${isActive ? 'text-[#CCFF00] -translate-y-2' : 'text-neutral-600'}`}
              >
                <div className={`p-1 rounded-xl transition-all duration-500 ${isActive ? 'bg-[#CCFF00]/10 shadow-lg shadow-[#CCFF00]/5' : ''}`}>
                  <Icon size={22} strokeWidth={isActive ? 3 : 2} />
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest transition-all duration-500 ${isActive ? 'opacity-100' : 'opacity-40'}`}>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </main>
  );
}
