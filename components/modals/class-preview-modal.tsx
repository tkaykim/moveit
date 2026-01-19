"use client";

import { useState, useEffect } from 'react';
import { Clock, Music, MapPin, Play, X, User, Tag, Calendar } from 'lucide-react';
import { LevelBadge } from '@/components/common/level-badge';
import { ClassInfo } from '@/types';
import Image from 'next/image';

interface ClassPreviewModalProps {
  classInfo: ClassInfo & { time?: string } | null;
  onClose: () => void;
  onBook: (classInfo: ClassInfo & { time?: string }) => void;
}

// 유튜브 URL을 embed URL로 변환
const getYoutubeEmbedUrl = (url: string): string | null => {
  if (!url) return null;
  
  if (url.includes('youtube.com/embed/')) {
    return url;
  }
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
  }
  
  return null;
};

// 유튜브 썸네일 URL 가져오기
const getYoutubeThumbnail = (url: string): string | null => {
  if (!url) return null;
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
    }
  }
  
  return null;
};

export const ClassPreviewModal = ({ classInfo, onClose, onBook }: ClassPreviewModalProps) => {
  const [classDetails, setClassDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  // 수업 상세 정보 로드
  useEffect(() => {
    if (!classInfo) return;

    const loadClassDetails = async () => {
      setLoading(true);
      try {
        const { getSupabaseClient } = await import('@/lib/utils/supabase-client');
        const supabase = getSupabaseClient();
        if (!supabase) return;

        const { data, error } = await supabase
          .from('classes')
          .select(`
            *,
            instructors (
              id,
              name_kr,
              name_en,
              profile_image_url,
              bio,
              specialties
            ),
            halls (
              id,
              name
            ),
            academies (
              id,
              name_kr,
              name_en,
              address
            )
          `)
          .eq('id', classInfo.id)
          .single();

        if (!error && data) {
          setClassDetails(data);
        }
      } catch (error) {
        console.error('Error loading class details:', error);
      } finally {
        setLoading(false);
      }
    };

    loadClassDetails();
  }, [classInfo]);

  if (!classInfo) return null;

  const isFull = classInfo.status === 'FULL';
  
  // 영상 URL 및 썸네일
  const videoUrl = classDetails?.video_url || (classInfo as any).video_url;
  const thumbnailUrl = classDetails?.thumbnail_url || (classInfo as any).thumbnail_url || getYoutubeThumbnail(videoUrl);
  const embedUrl = videoUrl ? getYoutubeEmbedUrl(videoUrl) : null;
  
  // 강사 정보
  const instructor = classDetails?.instructors || {};
  const instructorImage = instructor.profile_image_url;
  const instructorBio = instructor.bio;
  const instructorSpecialties = instructor.specialties;
  
  // 수업 설명
  const description = classDetails?.description;
  
  // 홀/장소 정보
  const hallName = classDetails?.halls?.name || classInfo.hall_name;
  
  // 장르와 난이도
  const genre = classDetails?.genre || classInfo.genre;
  const level = classDetails?.difficulty_level || classInfo.level;

  // 시간 포맷팅
  const formatEndTime = () => {
    if (classInfo.endTime) {
      const endDate = new Date(classInfo.endTime);
      return endDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return null;
  };

  const endTimeStr = formatEndTime();

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center">
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" 
          onClick={onClose} 
        />
        <div className="relative w-full max-w-[420px] max-h-[85vh] bg-white dark:bg-neutral-900 rounded-t-3xl animate-in slide-in-from-bottom duration-300 border-t border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col">
          {/* 드래그 핸들 */}
          <div className="flex-shrink-0 pt-3 pb-2">
            <div className="w-12 h-1 bg-neutral-300 dark:bg-neutral-700 rounded-full mx-auto" />
          </div>
          
          {/* 스크롤 가능한 콘텐츠 영역 */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {/* 영상 섹션 */}
            {(thumbnailUrl || embedUrl) && (
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden mb-4 bg-neutral-200 dark:bg-neutral-800">
                {showVideo && embedUrl ? (
                  <iframe
                    src={`${embedUrl}?autoplay=1&rel=0&modestbranding=1`}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="수업 영상"
                  />
                ) : thumbnailUrl ? (
                  <button
                    onClick={() => setShowVideo(true)}
                    className="relative w-full h-full group"
                  >
                    <Image
                      src={thumbnailUrl}
                      alt="수업 영상 썸네일"
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-white/90 dark:bg-black/80 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Play size={28} className="text-primary dark:text-[#CCFF00] ml-1" fill="currentColor" />
                      </div>
                    </div>
                    <div className="absolute bottom-3 left-3 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      수업 영상 보기
                    </div>
                  </button>
                ) : embedUrl ? (
                  <button
                    onClick={() => setShowVideo(true)}
                    className="w-full h-full flex items-center justify-center group"
                  >
                    <div className="w-16 h-16 rounded-full bg-primary/10 dark:bg-[#CCFF00]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play size={28} className="text-primary dark:text-[#CCFF00] ml-1" />
                    </div>
                  </button>
                ) : null}
              </div>
            )}

            {/* 메인 정보 */}
            <div className="flex gap-4 mb-4">
              {/* 강사 이미지 */}
              <div className="w-16 h-16 flex-shrink-0 bg-neutral-200 dark:bg-neutral-800 rounded-2xl overflow-hidden flex items-center justify-center">
                {instructorImage ? (
                  <Image
                    src={instructorImage}
                    alt={classInfo.instructor}
                    width={64}
                    height={64}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <span className="text-2xl font-black text-neutral-400 dark:text-neutral-500">
                    {classInfo.instructor[0]}
                  </span>
                )}
              </div>
              
              {/* 기본 정보 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-black text-black dark:text-white truncate">
                    {classDetails?.title || classInfo.class_title || `${genre} Class`}
                  </h3>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <User size={12} className="text-neutral-500" />
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {classInfo.instructor}
                  </span>
                  <LevelBadge level={level} />
                </div>
                
                {/* 시간 정보 */}
                <div className="flex items-center gap-2 text-sm text-primary dark:text-[#CCFF00]">
                  <Clock size={14} />
                  <span className="font-medium">
                    {classInfo.time}
                    {endTimeStr && <span className="text-neutral-500 dark:text-neutral-400"> ~ {endTimeStr}</span>}
                  </span>
                </div>
              </div>
            </div>

            {/* 태그 정보 */}
            <div className="flex flex-wrap gap-2 mb-4">
              {genre && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full">
                  <Tag size={12} className="text-neutral-500" />
                  <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{genre}</span>
                </div>
              )}
              {hallName && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full">
                  <MapPin size={12} className="text-neutral-500" />
                  <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{hallName}</span>
                </div>
              )}
            </div>

            {/* 수업 설명 */}
            {description && (
              <div className="mb-4">
                <h4 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-2">수업 소개</h4>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  {description}
                </p>
              </div>
            )}

            {/* 강사 소개 */}
            {(instructorBio || instructorSpecialties) && (
              <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4 mb-4">
                <h4 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-2">강사 소개</h4>
                {instructorSpecialties && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {instructorSpecialties.split(',').map((specialty: string, idx: number) => (
                      <span key={idx} className="text-[10px] px-2 py-0.5 bg-primary/10 dark:bg-[#CCFF00]/10 text-primary dark:text-[#CCFF00] rounded-full">
                        {specialty.trim()}
                      </span>
                    ))}
                  </div>
                )}
                {instructorBio && (
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    {instructorBio}
                  </p>
                )}
              </div>
            )}

            {/* 곡 정보 */}
            {classInfo.song && (
              <div className="bg-neutral-100 dark:bg-black/30 rounded-xl p-3 mb-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center">
                  <Music size={16} className="text-neutral-600 dark:text-neutral-400" />
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-500 uppercase tracking-wider">Song</div>
                  <div className="text-sm font-bold text-black dark:text-white">{classInfo.song}</div>
                </div>
              </div>
            )}

            {/* 학원 정보 */}
            {classInfo.academy && (
              <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                <MapPin size={12} />
                <span>{classInfo.academy.name || '학원 정보 없음'}</span>
                {classInfo.academy?.address && (
                  <span className="text-neutral-400 dark:text-neutral-500">• {classInfo.academy.address}</span>
                )}
              </div>
            )}

            {/* 마감 안내 */}
            {isFull && (
              <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-3 mb-4">
                <p className="text-sm text-rose-600 dark:text-rose-400 font-medium text-center">
                  이 수업은 마감되었습니다
                </p>
              </div>
            )}
          </div>

          {/* 하단 버튼 - 고정 */}
          <div className="flex-shrink-0 p-4 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <div className="flex gap-3">
              <button 
                onClick={onClose} 
                className="flex-1 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white font-bold py-4 rounded-xl hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
              >
                닫기
              </button>
              <button 
                onClick={() => onBook(classInfo)}
                disabled={isFull}
                className={`flex-[2] font-black py-4 rounded-xl text-lg transition-all ${
                  isFull 
                    ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed' 
                    : 'bg-primary dark:bg-[#CCFF00] text-white dark:text-black shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95'
                }`}
              >
                {isFull ? '예약 마감' : '예약하기'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 전체화면 비디오 모달 */}
      {showVideo && embedUrl && (
        <div 
          className="fixed inset-0 z-[60] bg-black flex items-center justify-center"
          onClick={() => setShowVideo(false)}
        >
          <button
            onClick={() => setShowVideo(false)}
            className="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
          >
            <X size={24} />
          </button>
          <div className="relative w-full max-w-4xl aspect-video mx-4">
            <iframe
              src={`${embedUrl}?autoplay=1&rel=0&modestbranding=1`}
              className="w-full h-full rounded-lg"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="수업 영상"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
};
