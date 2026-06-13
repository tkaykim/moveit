"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Palette,
  UserCheck,
  Ticket,
  BookOpen,
  CalendarDays,
  Share2,
  CheckCircle2,
  Circle,
  ChevronRight,
  X,
  PartyPopper,
  Sparkles,
} from 'lucide-react';
import { authFetch } from '@/lib/supabase/auth-fetch';
import { useAcademy } from '../../contexts/academy-context';
import { useOnboardingOptional } from '../../contexts/onboarding-context';

type ItemKey = 'decorate' | 'instructors' | 'tickets' | 'classes' | 'schedules' | 'promo';

interface ProgressResponse {
  items?: {
    decorate?: { done: boolean };
    instructors?: { done: boolean; count: number };
    tickets?: { done: boolean; count: number };
    classes?: { done: boolean; count: number };
    schedules?: { done: boolean; count: number };
  };
}

interface LocalState {
  promoDone: boolean;
  dismissed: boolean;
}

const ICONS: Record<ItemKey, typeof Palette> = {
  decorate: Palette,
  instructors: UserCheck,
  tickets: Ticket,
  classes: BookOpen,
  schedules: CalendarDays,
  promo: Share2,
};

interface ItemDef {
  key: ItemKey;
  title: string;
  desc: string;
  cta: string;
  path: (slug: string) => string;
}

const ITEMS: ItemDef[] = [
  {
    key: 'decorate',
    title: '학원 홈 꾸미기',
    desc: '소개글·대표사진·페이지 구성으로 우리 학원 페이지를 채워요.',
    cta: '설정으로 이동',
    path: (slug) => `/academy-admin/${slug}/settings`,
  },
  {
    key: 'instructors',
    title: '강사 등록',
    desc: '수업을 맡을 강사를 등록해요.',
    cta: '강사 관리로 이동',
    path: (slug) => `/academy-admin/${slug}/instructors`,
  },
  {
    key: 'tickets',
    title: '수강권 만들기',
    desc: '기간제·횟수제·워크샵 수강권과 가격을 만들어요.',
    cta: '수강권/상품으로 이동',
    path: (slug) => `/academy-admin/${slug}/products`,
  },
  {
    key: 'classes',
    title: '수업(클래스) 만들기',
    desc: '반 이름·장르·강사를 정해 수업의 기본 단위를 만들어요.',
    cta: '클래스 관리로 이동',
    path: (slug) => `/academy-admin/${slug}/class-masters`,
  },
  {
    key: 'schedules',
    title: '수업 일정 배치',
    desc: '요일·시간 반복 일정을 등록하면 달력에 수업이 자동으로 깔려요.',
    cta: '스케줄 관리로 이동',
    path: (slug) => `/academy-admin/${slug}/schedule`,
  },
  {
    key: 'promo',
    title: '홍보 링크로 알리기',
    desc: '수업·수강권 링크를 복사해 인스타·카톡에 올리면 회원이 바로 신청해요.',
    cta: '홍보 방법 보기',
    path: (slug) => `/academy-admin/${slug}/guide#promote`,
  },
];

function storageKey(academyId: string) {
  return `moveit_setup_checklist_v1_${academyId}`;
}

function readLocal(academyId: string): LocalState {
  if (typeof window === 'undefined') return { promoDone: false, dismissed: false };
  try {
    const raw = localStorage.getItem(storageKey(academyId));
    if (!raw) return { promoDone: false, dismissed: false };
    const parsed = JSON.parse(raw);
    return {
      promoDone: !!parsed.promoDone,
      dismissed: !!parsed.dismissed,
    };
  } catch {
    return { promoDone: false, dismissed: false };
  }
}

function writeLocal(academyId: string, state: LocalState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(academyId), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function SetupChecklist({ academyId }: { academyId: string }) {
  const { academySlug: slug } = useAcademy();
  const router = useRouter();
  const onboarding = useOnboardingOptional();

  const [loading, setLoading] = useState(true);
  const [doneMap, setDoneMap] = useState<Record<ItemKey, boolean>>({
    decorate: false,
    instructors: false,
    tickets: false,
    classes: false,
    schedules: false,
    promo: false,
  });
  const [local, setLocal] = useState<LocalState>({ promoDone: false, dismissed: false });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLocal(readLocal(academyId));
    setHydrated(true);
  }, [academyId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/academy-admin/${encodeURIComponent(academyId)}/setup-progress`);
      if (res.ok) {
        const data: ProgressResponse = await res.json();
        const it = data.items ?? {};
        setDoneMap((prev) => ({
          ...prev,
          decorate: !!it.decorate?.done,
          instructors: !!it.instructors?.done,
          tickets: !!it.tickets?.done,
          classes: !!it.classes?.done,
          schedules: !!it.schedules?.done,
        }));
      }
    } catch {
      /* 조회 실패 시 위젯은 숨김 처리 (아래 effectiveDone 계산에서 영향 없음) */
    } finally {
      setLoading(false);
    }
  }, [academyId]);

  useEffect(() => {
    load();
  }, [load]);

  const effectiveDone: Record<ItemKey, boolean> = useMemo(
    () => ({ ...doneMap, promo: local.promoDone }),
    [doneMap, local.promoDone]
  );

  const completedCount = ITEMS.filter((i) => effectiveDone[i.key]).length;
  const total = ITEMS.length;
  const allDone = completedCount === total;

  const markPromoDone = useCallback(() => {
    setLocal((prev) => {
      const next = { ...prev, promoDone: true };
      writeLocal(academyId, next);
      return next;
    });
  }, [academyId]);

  const dismiss = useCallback(() => {
    setLocal((prev) => {
      const next = { ...prev, dismissed: true };
      writeLocal(academyId, next);
      return next;
    });
  }, [academyId]);

  const handleItemClick = useCallback(
    (item: ItemDef) => {
      if (item.key === 'promo') {
        // 홍보 항목은 안내를 본 시점에 완료로 표시
        markPromoDone();
      }
      router.push(item.path(slug));
    },
    [router, slug, markPromoDone]
  );

  // 로딩 중 / 미하이드레이트: 깜빡임 방지로 렌더 보류
  if (loading || !hydrated) return null;

  // 사용자가 닫았거나 모두 완료한 경우 위젯 숨김
  if (local.dismissed) return null;
  if (allDone) return null;

  const pct = Math.round((completedCount / total) * 100);

  return (
    <div
      data-onboarding="page-dashboard-setup"
      className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent dark:from-primary/10 p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex-shrink-0 mt-0.5 w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
              학원 오픈 준비
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
              아래 단계를 마치면 회원을 받을 준비가 끝나요.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-bold text-primary tabular-nums">
            {completedCount}/{total}
          </span>
          <button
            type="button"
            onClick={dismiss}
            className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-600 dark:hover:text-neutral-200"
            aria-label="오픈 준비 안내 닫기"
            title="닫기"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 진행률 바 */}
      <div className="mt-3 h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* 항목 리스트 */}
      <ul className="mt-4 space-y-2">
        {ITEMS.map((item, idx) => {
          const done = effectiveDone[item.key];
          const Icon = ICONS[item.key];
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => handleItemClick(item)}
                className={`group w-full flex items-center gap-3 text-left rounded-lg border px-3 py-2.5 transition-colors ${
                  done
                    ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-900/10'
                    : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-primary hover:bg-primary/[0.03]'
                }`}
              >
                <span className="flex-shrink-0">
                  {done ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-neutral-300 dark:text-neutral-600" />
                  )}
                </span>
                <span
                  className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                    done
                      ? 'bg-emerald-100/70 dark:bg-emerald-900/20'
                      : 'bg-neutral-100 dark:bg-neutral-800'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      done
                        ? 'text-emerald-500'
                        : 'text-neutral-500 dark:text-neutral-400 group-hover:text-primary'
                    }`}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500 tabular-nums">
                      {idx + 1}
                    </span>
                    <span
                      className={`text-sm font-semibold ${
                        done
                          ? 'text-neutral-400 dark:text-neutral-500 line-through'
                          : 'text-neutral-900 dark:text-white'
                      }`}
                    >
                      {item.title}
                    </span>
                  </span>
                  {!done && (
                    <span className="block text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                      {item.desc}
                    </span>
                  )}
                </span>
                {!done && (
                  <span className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="hidden sm:inline">{item.cta}</span>
                    <ChevronRight className="w-4 h-4" />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* 하단: 전체 둘러보기 */}
      {onboarding && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            처음이신가요? 화면을 따라가며 안내해 드려요.
          </p>
          <button
            type="button"
            onClick={onboarding.startOnboarding}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary border border-primary/40 hover:bg-primary/10"
          >
            <PartyPopper className="w-3.5 h-3.5" />
            전체 둘러보기
          </button>
        </div>
      )}
    </div>
  );
}
