import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
const GOOGLE_TRANSLATE_URL = 'https://translation.googleapis.com/language/translate/v2';

interface TranslateRequest {
  texts: string[];
  targetLang: string;
  sourceLang?: string;
}

interface CachedTranslation {
  source_text: string;
  translated_text: string;
}

/**
 * Google Cloud Translation API를 호출하여 번역
 */
async function translateWithGoogle(
  texts: string[],
  targetLang: string,
  sourceLang: string = 'ko'
): Promise<string[]> {
  if (!GOOGLE_TRANSLATE_API_KEY) {
    console.warn('Google Translate API key not configured. Returning original texts.');
    return texts;
  }

  try {
    const response = await fetch(`${GOOGLE_TRANSLATE_URL}?key=${GOOGLE_TRANSLATE_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: texts,
        source: sourceLang,
        target: targetLang,
        format: 'text',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Google Translate API error:', error);
      return texts;
    }

    const data = await response.json();
    const translations = data.data?.translations || [];
    
    return translations.map((t: any, i: number) => t.translatedText || texts[i]);
  } catch (error) {
    console.error('Translation error:', error);
    return texts;
  }
}

/**
 * POST /api/translate
 * 텍스트 배열을 번역합니다. 캐시된 번역이 있으면 사용하고, 없으면 Google API를 호출합니다.
 */
export async function POST(request: Request) {
  try {
    const body: TranslateRequest = await request.json();
    const { texts, targetLang, sourceLang = 'ko' } = body;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ error: 'texts array is required' }, { status: 400 });
    }

    if (!targetLang) {
      return NextResponse.json({ error: 'targetLang is required' }, { status: 400 });
    }

    // 같은 언어면 그대로 반환
    if (targetLang === sourceLang) {
      return NextResponse.json({ translations: texts });
    }

    // 빈 문자열 필터링
    const nonEmptyTexts = texts.filter(t => t && t.trim());
    if (nonEmptyTexts.length === 0) {
      return NextResponse.json({ translations: texts });
    }

    const supabase = await createClient();

    // 1. 캐시에서 기존 번역 조회
    const { data: cachedData } = await (supabase as any)
      .from('translation_cache')
      .select('source_text, translated_text')
      .in('source_text', nonEmptyTexts)
      .eq('source_lang', sourceLang)
      .eq('target_lang', targetLang);

    const cacheMap = new Map<string, string>();
    (cachedData || []).forEach((item: CachedTranslation) => {
      cacheMap.set(item.source_text, item.translated_text);
    });

    // 2. 캐시에 없는 텍스트만 번역 API 호출
    const textsToTranslate = nonEmptyTexts.filter(t => !cacheMap.has(t));

    if (textsToTranslate.length > 0 && GOOGLE_TRANSLATE_API_KEY) {
      const newTranslations = await translateWithGoogle(textsToTranslate, targetLang, sourceLang);

      // 3. 새 번역을 캐시에 저장
      const cacheInserts = textsToTranslate.map((text, i) => ({
        source_text: text,
        source_lang: sourceLang,
        target_lang: targetLang,
        translated_text: newTranslations[i],
      }));

      if (cacheInserts.length > 0) {
        await (supabase as any)
          .from('translation_cache')
          .upsert(cacheInserts, { 
            onConflict: 'source_text,source_lang,target_lang',
            ignoreDuplicates: false 
          });
      }

      // 캐시맵 업데이트
      textsToTranslate.forEach((text, i) => {
        cacheMap.set(text, newTranslations[i]);
      });
    }

    // 4. 원래 순서대로 결과 반환
    const translations = texts.map(text => {
      if (!text || !text.trim()) return text;
      return cacheMap.get(text) || text;
    });

    return NextResponse.json({ translations });
  } catch (error: any) {
    console.error('Translation API error:', error);
    return NextResponse.json(
      { error: 'Translation failed', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/translate
 * 단일 텍스트 번역 (쿼리 파라미터 사용)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const text = searchParams.get('text');
    const targetLang = searchParams.get('targetLang') || 'en';
    const sourceLang = searchParams.get('sourceLang') || 'ko';

    if (!text) {
      return NextResponse.json({ error: 'text parameter is required' }, { status: 400 });
    }

    // POST로 리다이렉트
    const response = await POST(
      new Request(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: [text],
          targetLang,
          sourceLang,
        }),
      })
    );

    const data = await response.json();
    
    if (data.translations && data.translations.length > 0) {
      return NextResponse.json({ translation: data.translations[0] });
    }

    return NextResponse.json({ translation: text });
  } catch (error: any) {
    console.error('Translation GET error:', error);
    return NextResponse.json(
      { error: 'Translation failed', message: error.message },
      { status: 500 }
    );
  }
}
