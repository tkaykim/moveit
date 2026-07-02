'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Check, ChevronLeft, Copy, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authFetch } from '@/lib/supabase/auth-fetch';
import { MyTab } from '@/components/auth/MyTab';
import { ACADEMY_PRESETS } from '@/lib/presets/academy-presets';

/**
 * 원장 온보딩 위저드 — 질문 3개, 5분 완성.
 * ① 학원 이름·색 ② 운영 방식(실제 학원 사례 프리셋) ③ 대표 수업 1개(건너뛰기 가능)
 * 끝나면 즉시 "우리 학원 앱"(/s/slug) 미리보기 + 공유 링크.
 * 계좌·홀·강사·구독은 여기서 묻지 않는다 (사용 시점 just-in-time).
 */

const BRAND_COLORS = ['#111111', '#7C3AED', '#DB2777', '#DC2626', '#EA580C', '#16A34A', '#0891B2', '#2563EB'];
const GENRES = ['K-POP', '힙합', '걸스힙합', '하우스', '락킹', '팝핑', '왁킹', '코레오', '재즈', '키즈'];
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

interface DoneInfo {
  slug: string | null;
  academyId: string;
  miniAppPath: string;
  adminPath: string;
  ticketsCreated: number;
}

export default function StartWizardPage() {
  const { user, loading: authLoading } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<DoneInfo | null>(null);

  // Step 1
  const [nameKr, setNameKr] = useState('');
  const [slugHint, setSlugHint] = useState('');
  const [brandColor, setBrandColor] = useState(BRAND_COLORS[0]);
  const [instagram, setInstagram] = useState('');

  // Step 2
  const [presetKey, setPresetKey] = useState<string>('');

  // Step 3
  const [skipClass, setSkipClass] = useState(false);
  const [classTitle, setClassTitle] = useState('');
  const [classGenre, setClassGenre] = useState('');
  const [instructorName, setInstructorName] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState('19:00');
  const [endTime, setEndTime] = useState('20:20');

  const selectedPreset = useMemo(() => ACADEMY_PRESETS.find((p) => p.key === presetKey), [presetKey]);

  const canNext1 = nameKr.trim().length >= 2;
  const canNext2 = !!selectedPreset;
  const canSubmit = skipClass || (classTitle.trim() && days.length > 0 && startTime < endTime);

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        name_kr: nameKr.trim(),
        slug_hint: slugHint.trim() || undefined,
        brand_color: brandColor,
        instagram_handle: instagram.trim() || undefined,
        preset_key: presetKey,
      };
      if (!skipClass && classTitle.trim()) {
        body.first_class = {
          title: classTitle.trim(),
          genre: classGenre || undefined,
          instructor_name: instructorName.trim() || undefined,
          days_of_week: days,
          start_time: startTime,
          end_time: endTime,
        };
      }
      const res = await authFetch('/api/onboarding/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '설정에 실패했습니다.');
      setDone(data as DoneInfo);
    } catch (e) {
      setError(e instanceof Error ? e.message : '설정에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white dark:bg-neutral-950">
        <Loader2 className="animate-spin text-neutral-400" size={28} />
      </div>
    );
  }

  // 로그인 게이트
  if (!user) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 bg-white dark:bg-neutral-950">
        <div className="max-w-sm w-full text-center space-y-5">
          <p className="text-3xl">💃</p>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white leading-snug">
            우리 학원 앱을
            <br />5분 만에 만들어 드릴게요
          </h1>
          <p className="text-sm text-neutral-500">질문은 딱 3개입니다. 로그인 후 바로 시작하세요.</p>
          <button
            onClick={() => setAuthModalOpen(true)}
            className="w-full py-3.5 rounded-xl font-bold bg-neutral-900 dark:bg-white text-white dark:text-black"
          >
            로그인하고 시작하기
          </button>
        </div>
        <MyTab isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      </div>
    );
  }

  // 완료 화면 — aha moment
  if (done) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const miniUrl = `${origin}${done.miniAppPath}`;
    return (
      <div className="min-h-[100dvh] bg-white dark:bg-neutral-950 flex flex-col items-center px-6 py-10">
        <div className="max-w-sm w-full text-center">
          <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center text-white mb-4" style={{ backgroundColor: brandColor }}>
            <Check size={26} />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
            {nameKr} 앱이 만들어졌어요
          </h1>
          <p className="text-sm text-neutral-500 mt-2">
            수강권 {done.ticketsCreated}종이 자동 등록됐습니다.
            <br />
            링크를 학원생들에게 보내 보세요.
          </p>

          {/* 폰 프레임 미리보기 */}
          <div className="mx-auto mt-7 w-[270px] h-[520px] rounded-[36px] border-[10px] border-neutral-900 dark:border-neutral-700 overflow-hidden shadow-xl bg-white">
            <iframe src={done.miniAppPath} title="내 학원 앱 미리보기" className="w-full h-full" />
          </div>

          <div className="mt-7 space-y-2.5">
            <button
              onClick={() => navigator.clipboard?.writeText(miniUrl)}
              className="w-full py-3 rounded-xl text-sm font-bold border border-neutral-300 dark:border-neutral-700 flex items-center justify-center gap-2 text-neutral-800 dark:text-neutral-200"
            >
              <Copy size={15} /> 학원 앱 링크 복사
            </button>
            <a
              href={done.miniAppPath}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 rounded-xl text-sm font-bold border border-neutral-300 dark:border-neutral-700 flex items-center justify-center gap-2 text-neutral-800 dark:text-neutral-200"
            >
              <ExternalLink size={15} /> 새 창에서 열기
            </a>
            <Link
              href={done.adminPath}
              className="block w-full py-3.5 rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: brandColor }}
            >
              관리자 화면으로 가기
            </Link>
            <p className="text-[11px] text-neutral-400 pt-1">
              로고·소개·수강권 가격은 관리자 화면의 &lsquo;우리 학원&rsquo;에서 언제든 바꿀 수 있어요
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-neutral-950">
      <div className="max-w-md mx-auto px-6 py-8">
        {/* 진행 표시 */}
        <div className="flex items-center gap-2 mb-8">
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} className="p-1 -ml-2 mr-1 text-neutral-500" aria-label="이전 단계">
              <ChevronLeft size={20} />
            </button>
          )}
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-1.5 flex-1 rounded-full transition-colors"
              style={{ backgroundColor: n <= step ? brandColor : 'var(--tw-empty, #e5e5e5)' }}
            />
          ))}
          <span className="text-xs text-neutral-400 ml-1 tabular-nums">{step}/3</span>
        </div>

        {/* STEP 1 — 학원 이름·색 */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-neutral-900 dark:text-white">학원 이름이 뭔가요?</h1>
              <p className="text-sm text-neutral-500 mt-1">학원생들이 보게 될 이름과 색을 정해 주세요.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-neutral-700 dark:text-neutral-300">학원 이름</label>
              <input
                value={nameKr}
                onChange={(e) => setNameKr(e.target.value)}
                placeholder="예: 무브잇 댄스 스튜디오"
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-4 py-3 text-base text-neutral-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-neutral-700 dark:text-neutral-300">
                앱 주소 <span className="text-neutral-400 font-normal">(영문, 선택)</span>
              </label>
              <div className="flex items-center rounded-xl border border-neutral-300 dark:border-neutral-700 px-4">
                <span className="text-sm text-neutral-400">/s/</span>
                <input
                  value={slugHint}
                  onChange={(e) => setSlugHint(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="mystudio"
                  className="flex-1 bg-transparent px-1 py-3 text-base text-neutral-900 dark:text-white outline-none"
                />
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">비워두면 자동으로 만들어 드려요</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-neutral-700 dark:text-neutral-300">브랜드 색</label>
              <div className="flex gap-2.5 flex-wrap">
                {BRAND_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setBrandColor(c)}
                    className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: c, outline: brandColor === c ? `3px solid ${c}55` : 'none' }}
                    aria-label={`색상 ${c}`}
                  >
                    {brandColor === c && <Check size={16} className="text-white" />}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-neutral-700 dark:text-neutral-300">
                인스타그램 <span className="text-neutral-400 font-normal">(선택)</span>
              </label>
              <div className="flex items-center rounded-xl border border-neutral-300 dark:border-neutral-700 px-4">
                <span className="text-sm text-neutral-400">@</span>
                <input
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value.replace(/^@/, ''))}
                  placeholder="mystudio_official"
                  className="flex-1 bg-transparent px-1 py-3 text-base text-neutral-900 dark:text-white outline-none"
                />
              </div>
            </div>
            <button
              onClick={() => setStep(2)}
              disabled={!canNext1}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
              style={{ backgroundColor: brandColor }}
            >
              다음
            </button>
          </div>
        )}

        {/* STEP 2 — 운영 방식 프리셋 */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-xl font-bold text-neutral-900 dark:text-white">수강권은 어떤 방식인가요?</h1>
              <p className="text-sm text-neutral-500 mt-1">
                실제 학원들이 쓰는 방식 그대로 준비했어요. 선택하면 수강권이 자동으로 만들어지고, 가격은 나중에 바꾸면 됩니다.
              </p>
            </div>
            <div className="space-y-2.5">
              {ACADEMY_PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPresetKey(p.key)}
                  className="w-full text-left p-4 rounded-xl border-2 transition-colors"
                  style={{ borderColor: presetKey === p.key ? brandColor : 'rgb(229 229 229 / 0.6)' }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{p.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-neutral-900 dark:text-white">{p.name}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">{p.tagline}</p>
                    </div>
                    {presetKey === p.key && (
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: brandColor }}>
                        <Check size={13} />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-2">{p.example}</p>
                  {presetKey === p.key && (
                    <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex flex-wrap gap-1.5">
                      {p.tickets.map((t) => (
                        <span key={t.name} className="text-[11px] px-2 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                          {t.name} {t.price.toLocaleString('ko-KR')}원
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(3)}
              disabled={!canNext2}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
              style={{ backgroundColor: brandColor }}
            >
              다음
            </button>
          </div>
        )}

        {/* STEP 3 — 대표 수업 */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-neutral-900 dark:text-white">대표 수업 하나만 알려주세요</h1>
              <p className="text-sm text-neutral-500 mt-1">시간표에 바로 올라갑니다. 나머지 수업은 나중에 추가하면 돼요.</p>
            </div>

            {!skipClass && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-neutral-700 dark:text-neutral-300">수업 이름</label>
                  <input
                    value={classTitle}
                    onChange={(e) => setClassTitle(e.target.value)}
                    placeholder="예: 걸스힙합 기초반"
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-4 py-3 text-base text-neutral-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-neutral-700 dark:text-neutral-300">장르</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {GENRES.map((g) => (
                      <button
                        key={g}
                        onClick={() => setClassGenre(classGenre === g ? '' : g)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium border"
                        style={
                          classGenre === g
                            ? { backgroundColor: brandColor, borderColor: brandColor, color: '#fff' }
                            : { borderColor: 'rgb(212 212 212)', color: 'rgb(115 115 115)' }
                        }
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-neutral-700 dark:text-neutral-300">
                    강사 이름 <span className="text-neutral-400 font-normal">(선택)</span>
                  </label>
                  <input
                    value={instructorName}
                    onChange={(e) => setInstructorName(e.target.value)}
                    placeholder="예: 지수"
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-4 py-3 text-base text-neutral-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-neutral-700 dark:text-neutral-300">요일</label>
                  <div className="grid grid-cols-7 gap-1.5">
                    {DAYS.map((d, i) => (
                      <button
                        key={d}
                        onClick={() => setDays((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]))}
                        className="py-2.5 rounded-lg text-sm font-bold border"
                        style={
                          days.includes(i)
                            ? { backgroundColor: brandColor, borderColor: brandColor, color: '#fff' }
                            : { borderColor: 'rgb(212 212 212)', color: 'rgb(115 115 115)' }
                        }
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-neutral-700 dark:text-neutral-300">시작</label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-4 py-3 text-base text-neutral-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-neutral-700 dark:text-neutral-300">종료</label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-4 py-3 text-base text-neutral-900 dark:text-white"
                    />
                  </div>
                </div>
              </>
            )}

            <label className="flex items-center gap-2 text-sm text-neutral-500">
              <input type="checkbox" checked={skipClass} onChange={(e) => setSkipClass(e.target.checked)} className="rounded" />
              수업은 나중에 등록할게요
            </label>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              onClick={submit}
              disabled={!canSubmit || submitting}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ backgroundColor: brandColor }}
            >
              {submitting && <Loader2 size={15} className="animate-spin" />}
              내 학원 앱 만들기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
