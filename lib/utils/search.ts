import { getSupabaseClient } from './supabase-client';
import { Academy, Dancer } from '@/types';

export interface SearchResult {
  academies: Academy[];
  instructors: Dancer[];
  genres: string[];
}

export async function searchAll(query: string): Promise<SearchResult> {
  const supabase = getSupabaseClient() as any;
  if (!supabase || !query.trim()) {
    return { academies: [], instructors: [], genres: [] };
  }

  const searchTerm = query.trim().toLowerCase();
  
  try {
    // 학원 검색 (이름, 태그)
    const { data: academiesData, error: academiesError } = await supabase
      .from('academies')
      .select(`
        *,
        branches (*),
        classes (*)
      `)
      .or(`name_kr.ilike.%${searchTerm}%,name_en.ilike.%${searchTerm}%,tags.ilike.%${searchTerm}%`)
      .limit(20);

    if (academiesError) throw academiesError;

    // 강사 검색 (이름, 특기)
    const { data: instructorsData, error: instructorsError } = await supabase
      .from('instructors')
      .select(`
        *,
        classes (*)
      `)
      .or(`name_kr.ilike.%${searchTerm}%,name_en.ilike.%${searchTerm}%,specialties.ilike.%${searchTerm}%`)
      .limit(20);

    if (instructorsError) throw instructorsError;

    // 클래스를 통한 장르 검색
    const { data: classesData, error: classesError } = await supabase
      .from('classes')
      .select('genre')
      .ilike('genre', `%${searchTerm}%`)
      .limit(20);

    if (classesError) throw classesError;

    // Academy 변환 - 각 지점을 별도 항목으로
    const academies: Academy[] = (academiesData || []).flatMap((dbAcademy: any) => {
      const name = dbAcademy.name_kr || dbAcademy.name_en || '이름 없음';
      const branches = dbAcademy.branches || [];
      const classes = dbAcademy.classes || [];
      const minPrice = classes.length > 0 
        ? Math.min(...classes.map((c: any) => c.price || 0))
        : 0;

      // 지점이 없으면 하나의 항목으로 반환
      if (branches.length === 0) {
        return [{
          id: dbAcademy.id,
          name_kr: dbAcademy.name_kr,
          name_en: dbAcademy.name_en,
          tags: dbAcademy.tags,
          logo_url: dbAcademy.logo_url,
          name,
          branch: undefined,
          dist: undefined,
          rating: undefined,
          price: minPrice > 0 ? minPrice : undefined,
          badges: [],
          img: dbAcademy.logo_url || undefined,
          academyId: dbAcademy.id,
        } as any];
      }

      // 각 지점을 별도 항목으로 변환
      return branches.map((branch: any) => ({
        id: `${dbAcademy.id}-${branch.id}`,
        name_kr: dbAcademy.name_kr,
        name_en: dbAcademy.name_en,
        tags: dbAcademy.tags,
        logo_url: branch.image_url || dbAcademy.logo_url,
        name,
        branch: branch.name,
        dist: undefined,
        rating: undefined,
        price: minPrice > 0 ? minPrice : undefined,
        badges: [],
        img: branch.image_url || dbAcademy.logo_url || undefined,
        academyId: dbAcademy.id,
        branchId: branch.id,
      } as any));
    });

    // Instructor 변환
    const instructors: Dancer[] = (instructorsData || []).map((dbInstructor: any) => {
      const name = dbInstructor.name_kr || dbInstructor.name_en || '이름 없음';
      const specialties = dbInstructor.specialties || '';
      const genre = specialties.split(',')[0]?.trim() || 'ALL';
      const crew = specialties.split(',')[1]?.trim() || '';

      return {
        id: dbInstructor.id,
        name_kr: dbInstructor.name_kr,
        name_en: dbInstructor.name_en,
        bio: dbInstructor.bio,
        instagram_url: dbInstructor.instagram_url,
        specialties: dbInstructor.specialties,
        name,
        crew: crew || undefined,
        genre: genre || undefined,
        followers: undefined,
        img: dbInstructor.profile_image_url || undefined,
      };
    });

    // 장르 목록 추출
    const genres = Array.from(new Set((classesData || []).map((c: any) => c.genre).filter((g): g is string => !!g)));

    return {
      academies,
      instructors,
      genres,
    };
  } catch (error) {
    console.error('Search error:', error);
    return { academies: [], instructors: [], genres: [] };
  }
}

export async function searchByGenre(genre: string): Promise<SearchResult> {
  const supabase = getSupabaseClient() as any;
  if (!supabase || !genre) {
    return { academies: [], instructors: [], genres: [] };
  }

  try {
    // 장르로 클래스 검색
    const { data: classesData, error: classesError } = await supabase
      .from('classes')
      .select(`
        *,
        academies (*, branches (*)),
        instructors (*)
      `)
      .ilike('genre', `%${genre}%`)
      .limit(50);

    if (classesError) throw classesError;

    const academyMap = new Map<string, any>();
    const instructorMap = new Map<string, any>();

    (classesData || []).forEach((cls: any) => {
      // 학원 수집
      if (cls.academies && !academyMap.has(cls.academies.id)) {
        academyMap.set(cls.academies.id, cls.academies);
      }
      // 강사 수집
      if (cls.instructors && !instructorMap.has(cls.instructors.id)) {
        instructorMap.set(cls.instructors.id, cls.instructors);
      }
    });

    // Academy 변환 (클래스 가격 정보 포함)
    const academyPriceMap = new Map<string, number>();
    (classesData || []).forEach((cls: any) => {
      if (cls.academies && cls.price) {
        const academyId = cls.academies.id;
        const currentMin = academyPriceMap.get(academyId) || Infinity;
        if (cls.price < currentMin) {
          academyPriceMap.set(academyId, cls.price);
        }
      }
    });

    // 각 학원의 모든 지점을 별도 항목으로 변환
    const academies: Academy[] = Array.from(academyMap.values()).flatMap((dbAcademy: any) => {
      const name = dbAcademy.name_kr || dbAcademy.name_en || '이름 없음';
      const branches = dbAcademy.branches || [];
      const minPrice = academyPriceMap.get(dbAcademy.id) || 0;

      // 지점이 없으면 하나의 항목으로 반환
      if (branches.length === 0) {
        return [{
          id: dbAcademy.id,
          name_kr: dbAcademy.name_kr,
          name_en: dbAcademy.name_en,
          tags: dbAcademy.tags,
          logo_url: dbAcademy.logo_url,
          name,
          branch: undefined,
          dist: undefined,
          rating: undefined,
          price: minPrice > 0 ? minPrice : undefined,
          badges: [],
          img: dbAcademy.logo_url || undefined,
          academyId: dbAcademy.id,
        } as any];
      }

      // 각 지점을 별도 항목으로 변환
      return branches.map((branch: any) => ({
        id: `${dbAcademy.id}-${branch.id}`,
        name_kr: dbAcademy.name_kr,
        name_en: dbAcademy.name_en,
        tags: dbAcademy.tags,
        logo_url: branch.image_url || dbAcademy.logo_url,
        name,
        branch: branch.name,
        dist: undefined,
        rating: undefined,
        price: minPrice > 0 ? minPrice : undefined,
        badges: [],
        img: branch.image_url || dbAcademy.logo_url || undefined,
        academyId: dbAcademy.id,
        branchId: branch.id,
      } as any));
    });

    // Instructor 변환
    const instructors: Dancer[] = Array.from(instructorMap.values()).map((dbInstructor: any) => {
      const name = dbInstructor.name_kr || dbInstructor.name_en || '이름 없음';
      const specialties = dbInstructor.specialties || '';
      const genre = specialties.split(',')[0]?.trim() || 'ALL';
      const crew = specialties.split(',')[1]?.trim() || '';

      return {
        id: dbInstructor.id,
        name_kr: dbInstructor.name_kr,
        name_en: dbInstructor.name_en,
        bio: dbInstructor.bio,
        instagram_url: dbInstructor.instagram_url,
        specialties: dbInstructor.specialties,
        name,
        crew: crew || undefined,
        genre: genre || undefined,
        followers: undefined,
        img: dbInstructor.profile_image_url || undefined,
      };
    });

    return {
      academies,
      instructors,
      genres: [genre],
    };
  } catch (error) {
    console.error('Genre search error:', error);
    return { academies: [], instructors: [], genres: [] };
  }
}

