'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Check, ChevronLeft, Copy, ExternalLink, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authFetch } from '@/lib/supabase/auth-fetch';
import { MyTab } from '@/components/auth/MyTab';
import { OPERATION_TYPES, composeTickets } from '@/lib/presets/academy-presets';

/**
 * 원장 온보딩 위저드 v2 — 질문 3개, 5분 완성.
 * ① 학원 이름·색 ② 운영 방식(다중 선택 — 기간제+쿠폰제 병행 등) ③ 대표 수업(건너뛰기 가능)
 * 끝나면 즉시 "우리 학원 앱"(/s/slug) 미리보기 + 공유 링크. 계좌·홀·강사는 묻지 않는다.
 */

const BRAND_COLORS = ['#111111', '#7C3AED', '#DB2777', '#E11D48', '#EA580C', '#059669', '#0284C7', '#4F46E5'];
const GENRES = ['K-POP', '힙합', '걸스힙합', '하우스', '락킹', '팝핑', '왁킹', '코레오', '재즈', '키즈'];
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

interface DoneInfo {
  slug: string | null;
  academyId: string;
  miniAppPath: string;
  adminPath: string;
  ticketsCreated: number;
}

/** hex + 알파(00~FF) 틴트 */
const tint = (hex: string, alpha: string) => `${hex}${alpha}`;

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
  const [brand, setBrand] = useState(BRAND_COLORS[1]);
  const [instagram, setInstagram] = useState('');

  // Step 2 — 다중 선택
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // Step 3
  const [skipClass, setSkipClass] = useState(false);
  const [classTitle, setClassTitle] = useState('');
  const [classGenre, setClassGenre] = useState('');
  const [instructorName, setInstructorName] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState('19:00');
  const [endTime, setEndTime] = useState('20:20');

  const composed = useMemo(() => composeTickets(selectedKeys), [selectedKeys]);
  const canNext1 = nameKr.trim().length >= 2;
  const canNext2 = selectedKeys.length > 0;
  const canSubmit = skipClass || (classTitle.trim() && days.length > 0 && startTime < endTime);

  const toggleKey = (key: string) =>
    setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        name_kr: nameKr.trim(),
        slug_hint: slugHint.trim() || undefined,
        brand_color: brand,
        instagram_handle: instagram.trim() || undefined,
        preset_keys: selectedKeys,
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

  // ── 공통 셸: 브랜드 틴트 그라디언트 배경 ──
  const shellStyle = {
    backgroundImage: `radial-gradient(80% 50% at 50% -10%, ${tint(brand, '1F')}, transparent 70%)`,
  };

  if (authLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white dark:bg-neutral-950">
        <Loader2 className="animate-spin text-neutral-300" size={28} />
      </div>
    );
  }

  // ── 로그인 게이트 ──
  if (!user) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 bg-white dark:bg-neutral-950" style={shellStyle}>
        <div className="max-w-sm w-full text-center">
          <div
            className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-lg"
            style={{ backgroundColor: brand, boxShadow: `0 12px 32px -8px ${tint(brand, '66')}` }}
          >
            💃
          </div>
          <h1 className="text-[28px] leading-[1.25] font-extrabold tracking-tight text-neutral-900 dark:text-white">
            우리 학원 앱,
            <br />5분이면 만들어져요
          </h1>
          <p className="text-[15px] text-neutral-500 mt-3">
            질문은 딱 3개.
            <br />
            시간표·수강권·워크샵 신청까지 링크 하나로.
          </p>
          <button
            onClick={() => setAuthModalOpen(true)}
            className="mt-8 w-full py-4 rounded-2xl text-[15px] font-bold text-white transition-transform active:scale-[0.98]"
            style={{ backgroundColor: brand, boxShadow: `0 10px 24px -6px ${tint(brand, '59')}` }}
          >
            시작하기
          </button>
          <p className="mt-3 text-xs text-neutral-400">로그인 또는 회원가입 후 바로 시작됩니다</p>
        </div>
        <MyTab isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      </div>
    );
  }

  // ── 완료 화면 ──
  if (done) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const miniUrl = `${origin}${done.miniAppPath}`;
    return (
      <div className="min-h-[100dvh] bg-white dark:bg-neutral-950" style={shellStyle}>
        <div className="max-w-sm mx-auto px-6 py-12 text-center">
          <div
            className="w-14 h-14 mx-auto rounded-full flex items-center justify-center text-white mb-5"
            style={{ backgroundColor: brand, boxShadow: `0 12px 32px -8px ${tint(brand, '66')}` }}
          >
            <Check size={28} strokeWidth={3} />
          </div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-neutral-900 dark:text-white leading-snug">
            {nameKr}
            <br />
            앱이 완성됐어요 🎉
          </h1>
          <p className="text-sm text-neutral-500 mt-2.5">
            수강권 {done.ticketsCreated}종이 자동 등록됐습니다.
            <br />
            링크를 인스타 프로필이나 단톡방에 올려 보세요.
          </p>

          {/* 폰 프레임 미리보기 */}
          <div className="mx-auto mt-8 w-[280px] h-[540px] rounded-[42px] border-[10px] border-neutral-900 dark:border-neutral-700 overflow-hidden bg-white shadow-2xl">
            <iframe src={done.miniAppPath} title="내 학원 앱 미리보기" className="w-full h-full" />
          </div>

          <div className="mt-8 space-y-2.5">
            <button
              onClick={() => navigator.clipboard?.writeText(miniUrl)}
              className="w-full py-3.5 rounded-2xl text-sm font-bold border border-neutral-200 dark:border-neutral-800 flex items-center justify-center gap-2 text-neutral-800 dark:text-neutral-200 bg-white/70 dark:bg-neutral-900/70"
            >
              <Copy size={15} /> 학원 앱 링크 복사
            </button>
            <a
              href={done.miniAppPath}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 rounded-2xl text-sm font-bold border border-neutral-200 dark:border-neutral-800 flex items-center justify-center gap-2 text-neutral-800 dark:text-neutral-200 bg-white/70 dark:bg-neutral-900/70"
            >
              <ExternalLink size={15} /> 새 창에서 열기
            </a>
            <Link
              href={done.adminPath}
              className="block w-full py-4 rounded-2xl text-[15px] font-bold text-white"
              style={{ backgroundColor: brand, boxShadow: `0 10px 24px -6px ${tint(brand, '59')}` }}
            >
              관리자 화면으로 가기
            </Link>
            <p className="text-[11px] text-neutral-400 pt-1.5">
              로고·소개·가격은 관리자 &lsquo;우리 학원&rsquo;에서 언제든 수정할 수 있어요
            </p>
          </div>
        </div>
      </div>
    );
  }

  const filledInput =
    'w-full rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-transparent px-5 py-4 text-[16px] text-neutral-900 dark:text-white placeholder:text-neutral-400 outline-none focus:border-neutral-300 dark:focus:border-neutral-700 transition-colors';

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-neutral-950" style={shellStyle}>
      <div className="max-w-md mx-auto px-6 pt-7 pb-14">
        {/* 진행 헤더 */}
        <div className="flex items-center gap-3 mb-9">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="w-9 h-9 -ml-1.5 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900"
              aria-label="이전 단계"
            >
              <ChevronLeft size={20} />
            </button>
          ) : (
            <div className="w-9 h-9 -ml-1.5" />
          )}
          <div className="flex-1 flex gap-1.5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-1 flex-1 rounded-full bg-neutral-200/70 dark:bg-neutral-800 transition-colors"
                style={n <= step ? { backgroundColor: brand } : undefined}
              />
            ))}
          </div>
          <span className="text-xs font-semibold text-neutral-400 tabular-nums">{step}/3</span>
        </div>

        {/* STEP 1 — 학원 이름·색 */}
        {step === 1 && (
          <div className="space-y-8">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: brand }}>
                Step 1 · 우리 학원
              </p>
              <h1 className="text-[26px] font-extrabold tracking-tight text-neutral-900 dark:text-white leading-snug">
                학원 이름이 뭔가요?
              </h1>
              <p className="text-sm text-neutral-500 mt-1.5">학원생들이 보게 될 이름과 대표 색을 정해 주세요.</p>
            </div>

            <input
              value={nameKr}
              onChange={(e) => setNameKr(e.target.value)}
              placeholder="예: 무브잇 댄스 스튜디오"
              className={filledInput}
            />

            {/* 브랜드 색 + 라이브 미리보기 */}
            <div>
              <div className="flex gap-3 flex-wrap">
                {BRAND_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setBrand(c)}
                    className="w-11 h-11 rounded-full flex items-center justify-center transition-transform active:scale-90"
                    style={{
                      backgroundColor: c,
                      boxShadow: brand === c ? `0 0 0 3px white, 0 0 0 6px ${c}` : 'none',
                    }}
                    aria-label={`색상 ${c}`}
                  >
                    {brand === c && <Check size={17} className="text-white" strokeWidth={3} />}
                  </button>
                ))}
              </div>
              {nameKr.trim() && (
                <div className="mt-5 inline-flex items-center gap-2.5 pl-2 pr-4 py-2 rounded-full" style={{ backgroundColor: tint(brand, '14') }}>
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: brand }}
                  >
                    {nameKr.trim().slice(0, 1)}
                  </span>
                  <span className="text-sm font-bold" style={{ color: brand }}>
                    {nameKr.trim()}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center rounded-2xl bg-neutral-100 dark:bg-neutral-900 px-5">
                <span className="text-[15px] text-neutral-400 font-medium">/s/</span>
                <input
                  value={slugHint}
                  onChange={(e) => setSlugHint(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="mystudio (앱 주소, 선택)"
                  className="flex-1 bg-transparent px-1.5 py-4 text-[16px] text-neutral-900 dark:text-white placeholder:text-neutral-400 outline-none"
                />
              </div>
              <div className="flex items-center rounded-2xl bg-neutral-100 dark:bg-neutral-900 px-5">
                <span className="text-[15px] text-neutral-400 font-medium">@</span>
                <input
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value.replace(/^@/, ''))}
                  placeholder="인스타그램 아이디 (선택)"
                  className="flex-1 bg-transparent px-1.5 py-4 text-[16px] text-neutral-900 dark:text-white placeholder:text-neutral-400 outline-none"
                />
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!canNext1}
              className="w-full py-4 rounded-2xl text-[15px] font-bold text-white disabled:opacity-30 flex items-center justify-center gap-1.5 transition-transform active:scale-[0.98]"
              style={{ backgroundColor: brand, boxShadow: canNext1 ? `0 10px 24px -6px ${tint(brand, '59')}` : 'none' }}
            >
              다음 <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* STEP 2 — 운영 방식 (다중 선택) */}
        {step === 2 && (
          <div className="space-y-7">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: brand }}>
                Step 2 · 운영 방식
              </p>
              <h1 className="text-[26px] font-extrabold tracking-tight text-neutral-900 dark:text-white leading-snug">
                어떤 수업을 운영하세요?
              </h1>
              <p className="text-sm text-neutral-500 mt-1.5">
                <b className="text-neutral-700 dark:text-neutral-300">여러 개 선택할 수 있어요.</b> 선택하면 수강권이
                자동으로 만들어지고, 가격은 나중에 바꾸면 됩니다.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {OPERATION_TYPES.map((t) => {
                const on = selectedKeys.includes(t.key);
                return (
                  <button
                    key={t.key}
                    onClick={() => toggleKey(t.key)}
                    className="relative text-left p-4 rounded-2xl border transition-all active:scale-[0.98]"
                    style={
                      on
                        ? { borderColor: brand, backgroundColor: tint(brand, '0F') }
                        : { borderColor: 'rgb(229 229 229 / 0.7)' }
                    }
                  >
                    {on && (
                      <span
                        className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: brand }}
                      >
                        <Check size={12} strokeWidth={3.5} />
                      </span>
                    )}
                    <span className="text-2xl">{t.emoji}</span>
                    <p className="mt-2 text-[15px] font-bold text-neutral-900 dark:text-white">{t.name}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{t.tagline}</p>
                  </button>
                );
              })}
            </div>

            {/* 조합 결과 라이브 미리보기 */}
            {composed.length > 0 && (
              <div className="rounded-2xl p-4" style={{ backgroundColor: tint(brand, '0D') }}>
                <p className="text-xs font-bold mb-2.5" style={{ color: brand }}>
                  이 수강권 {composed.length}종이 만들어져요
                </p>
                <ul className="space-y-1.5">
                  {composed.map((t) => (
                    <li key={t.name} className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
                        {t.name}
                        {t.is_public === false && <span className="ml-1.5 text-[10px] text-neutral-400">상담 후 등록</span>}
                      </span>
                      <span className="font-bold tabular-nums text-neutral-900 dark:text-white flex-shrink-0">
                        {t.price.toLocaleString('ko-KR')}원
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => setStep(3)}
              disabled={!canNext2}
              className="w-full py-4 rounded-2xl text-[15px] font-bold text-white disabled:opacity-30 flex items-center justify-center gap-1.5 transition-transform active:scale-[0.98]"
              style={{ backgroundColor: brand, boxShadow: canNext2 ? `0 10px 24px -6px ${tint(brand, '59')}` : 'none' }}
            >
              다음 <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* STEP 3 — 대표 수업 */}
        {step === 3 && (
          <div className="space-y-7">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: brand }}>
                Step 3 · 첫 수업
              </p>
              <h1 className="text-[26px] font-extrabold tracking-tight text-neutral-900 dark:text-white leading-snug">
                대표 수업 하나만
                <br />
                알려주세요
              </h1>
              <p className="text-sm text-neutral-500 mt-1.5">시간표에 바로 올라갑니다. 나머지는 나중에 추가하면 돼요.</p>
            </div>

            {!skipClass && (
              <div className="space-y-5">
                <input
                  value={classTitle}
                  onChange={(e) => setClassTitle(e.target.value)}
                  placeholder="수업 이름 — 예: 걸스힙합 기초반"
                  className={filledInput}
                />
                <div className="flex gap-1.5 flex-wrap">
                  {GENRES.map((g) => {
                    const on = classGenre === g;
                    return (
                      <button
                        key={g}
                        onClick={() => setClassGenre(on ? '' : g)}
                        className="px-3.5 py-2 rounded-full text-[13px] font-semibold border transition-colors"
                        style={
                          on
                            ? { backgroundColor: brand, borderColor: brand, color: '#fff' }
                            : { borderColor: 'rgb(212 212 212 / 0.8)', color: 'rgb(115 115 115)' }
                        }
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
                <input
                  value={instructorName}
                  onChange={(e) => setInstructorName(e.target.value)}
                  placeholder="강사 이름 (선택)"
                  className={filledInput}
                />
                <div>
                  <div className="flex justify-between gap-1.5">
                    {DAYS.map((d, i) => {
                      const on = days.includes(i);
                      return (
                        <button
                          key={d}
                          onClick={() => setDays((prev) => (on ? prev.filter((x) => x !== i) : [...prev, i]))}
                          className="w-11 h-11 rounded-full text-sm font-bold border transition-all active:scale-90"
                          style={
                            on
                              ? { backgroundColor: brand, borderColor: brand, color: '#fff' }
                              : { borderColor: 'rgb(212 212 212 / 0.8)', color: 'rgb(115 115 115)' }
                          }
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-2xl bg-neutral-100 dark:bg-neutral-900 px-5 py-3">
                    <p className="text-[11px] font-semibold text-neutral-400 mb-0.5">시작</p>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-transparent text-[16px] font-bold text-neutral-900 dark:text-white outline-none"
                    />
                  </div>
                  <div className="rounded-2xl bg-neutral-100 dark:bg-neutral-900 px-5 py-3">
                    <p className="text-[11px] font-semibold text-neutral-400 mb-0.5">종료</p>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full bg-transparent text-[16px] font-bold text-neutral-900 dark:text-white outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            <label className="flex items-center gap-2.5 text-sm text-neutral-500 cursor-pointer">
              <input type="checkbox" checked={skipClass} onChange={(e) => setSkipClass(e.target.checked)} className="w-4 h-4 rounded" />
              수업은 나중에 등록할게요
            </label>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              onClick={submit}
              disabled={!canSubmit || submitting}
              className="w-full py-4 rounded-2xl text-[15px] font-bold text-white disabled:opacity-30 flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
              style={{ backgroundColor: brand, boxShadow: canSubmit ? `0 10px 24px -6px ${tint(brand, '59')}` : 'none' }}
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              내 학원 앱 만들기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
