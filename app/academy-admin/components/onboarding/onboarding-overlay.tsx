'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useOnboarding } from '../../contexts/onboarding-context';
import {
  GLOBAL_STEPS,
  PAGE_STEPS,
  getPageKeyFromPathname,
  getSidebarStepUrl,
  type WelcomeStep,
  type SidebarStep,
  type InfoStep,
} from '../../config/onboarding-steps';
import { usePathname, useRouter } from 'next/navigation';

export function OnboardingOverlay() {
  const {
    run,
    phase,
    currentStep,
    pageStepIndex,
    nextStep,
    closeOnboarding,
    completeOnboarding,
  } = useOnboarding();
  const pathname = usePathname();
  const router = useRouter();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const academyId = pathname?.match(/\/academy-admin\/([^/]+)/)?.[1] ?? '';

  const getTargetSelector = useCallback((): string | null => {
    if (phase === 'sidebar') {
      const step = GLOBAL_STEPS[currentStep];
      if (step && step.type === 'sidebar') return step.target;
      return null; // info 스텝 등은 하이라이트 없음
    }
    if (phase === 'page') {
      const pageKey = getPageKeyFromPathname(pathname ?? '');
      const steps = pageKey ? PAGE_STEPS[pageKey] : [];
      const step = steps?.[pageStepIndex];
      return step?.target ?? null;
    }
    return null;
  }, [phase, currentStep, pageStepIndex, pathname]);

  const resolveElement = useCallback((selector: string): Element | null => {
    if (selector === 'header-quick-pay') {
      const btn = Array.from(document.querySelectorAll('button')).find(
        (el) =>
          el.textContent?.includes('수강권 간편결제') ||
          el.getAttribute('aria-label') === '수강권 판매'
      );
      return btn ?? null;
    }
    return document.querySelector(`[data-onboarding="${selector}"]`);
  }, []);

  /** 가장 가까운 스크롤 가능한 조상을 찾아 직접 scrollTop으로 요소를 중앙에 맞춘다.
   *  sticky/fixed 조상(사이드바) 안에서는 scrollIntoView가 무시되는 경우가 있어 직접 계산한다. */
  const scrollElementIntoView = useCallback((el: Element) => {
    let p = el.parentElement;
    let scroller: HTMLElement | null = null;
    while (p) {
      const style = window.getComputedStyle(p);
      const oy = style.overflowY;
      if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 1) {
        scroller = p;
        break;
      }
      p = p.parentElement;
    }
    if (scroller) {
      const elRect = el.getBoundingClientRect();
      const scRect = scroller.getBoundingClientRect();
      const current = scroller.scrollTop;
      const elTopWithin = elRect.top - scRect.top + current;
      const target = elTopWithin - scroller.clientHeight / 2 + (el as HTMLElement).offsetHeight / 2;
      scroller.scrollTop = Math.max(0, target);
    } else {
      try {
        el.scrollIntoView({ block: 'center', inline: 'nearest' });
      } catch {
        el.scrollIntoView();
      }
    }
  }, []);

  /** 화면 안에 일부라도 보이고 크기가 유효한지 */
  const isUsableRect = useCallback((rect: DOMRect): boolean => {
    if (rect.width <= 1 || rect.height <= 1) return false;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.bottom < 0 || rect.top > vh) return false;
    if (rect.right < 0 || rect.left > vw) return false;
    return true;
  }, []);

  // 현재 타겟 셀렉터를 ref로 보관 — 매 프레임 최신값을 읽는다.
  // (셀렉터(스텝)가 바뀔 때마다 effect를 재구독하면 setInterval/타이밍이 꼬여
  //  스크롤이 누락되는 문제가 있어, run에만 의존하는 단일 rAF 루프로 처리한다.)
  const currentSelector = getTargetSelector();
  const selectorRef = useRef<string | null>(null);
  selectorRef.current = currentSelector;
  const lastRectRef = useRef<DOMRect | null>(null);

  const commitRect = useCallback((next: DOMRect | null) => {
    const prev = lastRectRef.current;
    const changed =
      !prev !== !next ||
      (!!prev &&
        !!next &&
        (Math.round(prev.left) !== Math.round(next.left) ||
          Math.round(prev.top) !== Math.round(next.top) ||
          Math.round(prev.width) !== Math.round(next.width) ||
          Math.round(prev.height) !== Math.round(next.height)));
    if (changed) {
      lastRectRef.current = next;
      setTargetRect(next);
    }
  }, []);

  // 타겟 위치 추적 + 화면 밖이면 보이도록 스크롤.
  // run 과 안정 콜백에만 의존해 한 번만 구독하고, 현재 타겟은 ref로 매 틱 읽는다.
  // (스텝마다 재구독하면 타이밍이 꼬여 스크롤이 누락되는 문제가 있었다.)
  useEffect(() => {
    if (!run) {
      setTargetRect(null);
      lastRectRef.current = null;
      return;
    }
    const update = () => {
      const selector = selectorRef.current;
      if (!selector) {
        commitRect(null);
        return;
      }
      const el = resolveElement(selector);
      if (!el) {
        commitRect(null);
        return;
      }
      let rect = el.getBoundingClientRect();
      if (!isUsableRect(rect)) {
        scrollElementIntoView(el);
        rect = el.getBoundingClientRect();
      }
      commitRect(isUsableRect(rect) ? rect : null);
    };
    update();
    const interval = setInterval(update, 200);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      clearInterval(interval);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [run, resolveElement, scrollElementIntoView, isUsableRect, commitRect]);

  useEffect(() => {
    if (!run) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeOnboarding();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [run, closeOnboarding]);

  if (!run) return null;

  const step = GLOBAL_STEPS[currentStep];
  const isWelcome = phase === 'welcome' && step?.type === 'welcome';
  const isDone = phase === 'done';
  const isSidebar = phase === 'sidebar' && step?.type === 'sidebar';
  const isInfo = phase === 'sidebar' && step?.type === 'info';
  const pageKey = getPageKeyFromPathname(pathname ?? '');
  const pageSteps = pageKey ? PAGE_STEPS[pageKey] : [];
  const pageStep = phase === 'page' ? pageSteps[pageStepIndex] : null;

  let title = '';
  let body = '';
  let nextLabel = '다음';
  let onPrimary: () => void = nextStep;
  let ctaLabel: string | null = null;
  let onCta: (() => void) | null = null;

  if (isWelcome) {
    const s = step as WelcomeStep;
    title = s.title;
    body = s.body;
    nextLabel = '시작';
  } else if (isDone) {
    title = '튜토리얼 완료';
    body =
      'MOVE IT 관리자 화면 둘러보기를 마쳤습니다.\n' +
      '대시보드의 "학원 오픈 준비" 카드나, 헤더의 "둘러보기" 버튼으로 언제든 다시 볼 수 있어요.';
    nextLabel = '확인';
    onPrimary = completeOnboarding;
  } else if (isSidebar) {
    const s = step as SidebarStep;
    title = s.label;
    body = s.message;
    nextLabel = '이동하기';
    onPrimary = () => {
      if (academyId) router.push(getSidebarStepUrl(academyId, s));
    };
  } else if (isInfo) {
    const s = step as InfoStep;
    title = s.title;
    body = s.body;
    nextLabel = '완료';
    onPrimary = completeOnboarding;
    if (s.ctaPath) {
      ctaLabel = s.ctaLabel ?? '바로가기';
      onCta = () => {
        if (academyId) router.push(`/academy-admin/${academyId}/${s.ctaPath}`);
        completeOnboarding();
      };
    }
  } else if (pageStep) {
    title = pageStep.title;
    body = pageStep.body;
    const isLastPageStep = pageStepIndex >= pageSteps.length - 1;
    nextLabel = isLastPageStep ? '다음 메뉴로' : '다음';
  }

  if (!title) title = '안내';
  if (!body) body = '다음 단계로 진행해 주세요.';

  const showActionHint = phase === 'page' && pageStep?.actionHint === 'click';
  const tip = phase === 'page' ? pageStep?.tip : undefined;
  const stepIndicator =
    phase === 'page' && pageSteps.length > 0
      ? `${pageStepIndex + 1} / ${pageSteps.length}`
      : null;

  const padding = 4;

  // 카드 배치: 타겟이 화면 위쪽이면 카드는 아래, 아래쪽이면 카드는 위 (타겟을 가리지 않도록)
  let cardPositionClass = 'top-1/2 -translate-y-1/2';
  if (targetRect) {
    const targetCenterY = targetRect.top + targetRect.height / 2;
    const placeBelow = targetCenterY < window.innerHeight / 2;
    cardPositionClass = placeBelow ? 'bottom-6' : 'top-24';
  }

  return (
    <div className="fixed inset-0 z-[100]" aria-modal="true" role="dialog">
      {/* Backdrop: full dim or 4 strips to leave target visible */}
      {targetRect ? (
        <>
          <div
            className="absolute inset-0 bg-black/60 dark:bg-black/70"
            style={{ top: 0, left: 0, right: 0, height: Math.max(0, targetRect.top - padding) }}
            onClick={(e) => e.target === e.currentTarget && closeOnboarding()}
          />
          <div
            className="absolute bg-black/60 dark:bg-black/70"
            style={{ top: Math.max(0, targetRect.top - padding), left: 0, width: Math.max(0, targetRect.left - padding), bottom: 0 }}
            onClick={(e) => e.target === e.currentTarget && closeOnboarding()}
          />
          <div
            className="absolute bg-black/60 dark:bg-black/70"
            style={{ top: Math.max(0, targetRect.top - padding), left: targetRect.right + padding, right: 0, bottom: 0 }}
            onClick={(e) => e.target === e.currentTarget && closeOnboarding()}
          />
          <div
            className="absolute left-0 right-0 bg-black/60 dark:bg-black/70"
            style={{ top: targetRect.bottom + padding, left: 0, right: 0, bottom: 0 }}
            onClick={(e) => e.target === e.currentTarget && closeOnboarding()}
          />
          <div
            className="absolute rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-neutral-900 pointer-events-none"
            style={{
              left: targetRect.left - padding,
              top: targetRect.top - padding,
              width: targetRect.width + padding * 2,
              height: targetRect.height + padding * 2,
            }}
          />
        </>
      ) : (
        <div
          className="absolute inset-0 bg-black/60 dark:bg-black/70"
          onClick={(e) => e.target === e.currentTarget && closeOnboarding()}
        />
      )}

      {/* Message card */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 z-10 w-full max-w-md px-4 ${cardPositionClass}`}
      >
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 p-6 flex flex-col max-h-[80vh]">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {stepIndicator && (
                <span className="inline-block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1">
                  {stepIndicator}
                </span>
              )}
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white pr-8">{title}</h3>
            </div>
            <button
              type="button"
              onClick={closeOnboarding}
              className="flex-shrink-0 p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:text-neutral-400 dark:hover:text-white"
              aria-label="닫기"
            >
              <X size={18} />
            </button>
          </div>
          <div className="mt-2 overflow-y-auto flex-1 min-h-0 max-h-[45vh] pr-1">
            <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed whitespace-pre-line">
              {body}
            </p>
            {showActionHint && (
              <p className="mt-3 text-sm font-medium text-primary flex items-center gap-2">
                <span aria-hidden>👉</span>
                하이라이트된 버튼(또는 영역)을 직접 눌러 보세요.
              </p>
            )}
            {tip && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">팁</span> {tip}
                </p>
              </div>
            )}
          </div>
          <div className="mt-6 flex items-center justify-between gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={closeOnboarding}
              className="text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              건너뛰기
            </button>
            <div className="flex gap-2">
              {ctaLabel && onCta && (
                <button
                  type="button"
                  onClick={onCta}
                  className="px-4 py-2 rounded-lg border border-primary/50 text-primary font-medium text-sm hover:bg-primary/10"
                >
                  {ctaLabel}
                </button>
              )}
              <button
                type="button"
                onClick={onPrimary}
                className="px-4 py-2 rounded-lg bg-primary text-black font-medium text-sm hover:opacity-90"
              >
                {nextLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
