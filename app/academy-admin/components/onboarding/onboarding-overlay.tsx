'use client';

import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useOnboarding } from '../../contexts/onboarding-context';
import {
  GLOBAL_STEPS,
  PAGE_STEPS,
  getPageKeyFromPathname,
  getSidebarStepUrl,
  type WelcomeStep,
  type SidebarStep,
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
    getCurrentPageSteps,
  } = useOnboarding();
  const pathname = usePathname();
  const router = useRouter();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const academyId = pathname?.match(/\/academy-admin\/([^/]+)/)?.[1] ?? '';

  const getTargetSelector = useCallback((): string | null => {
    if (phase === 'welcome' || phase === 'done') return null;
    if (phase === 'sidebar') {
      const step = GLOBAL_STEPS[currentStep];
      if (step && step.type === 'sidebar') return step.target;
      return null;
    }
    if (phase === 'page') {
      const pageKey = getPageKeyFromPathname(pathname ?? '');
      const steps = pageKey ? PAGE_STEPS[pageKey] : [];
      const step = steps?.[pageStepIndex];
      return step?.target ?? null;
    }
    return null;
  }, [phase, currentStep, pageStepIndex, pathname]);

  useEffect(() => {
    if (!run) return;
    const selector = getTargetSelector();
    if (!selector) {
      setTargetRect(null);
      return;
    }
    const resolveElement = (): Element | null => {
      const sidebarMatch = selector.match(/^sidebar-(\d+)$/);
      if (sidebarMatch) {
        const index = parseInt(sidebarMatch[1], 10);
        const links = document.querySelectorAll('aside nav a');
        return links[index] ?? null;
      }
      if (selector === 'header-quick-pay') {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (el) => el.textContent?.includes('수강권 간편결제') || el.getAttribute('aria-label') === '수강권 판매'
        );
        return btn ?? null;
      }
      return document.querySelector(`[data-onboarding="${selector}"]`);
    };
    const update = () => {
      const el = resolveElement();
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    };
    update();
    const raf = requestAnimationFrame(update);
    const interval = setInterval(update, 200);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(interval);
    };
  }, [run, getTargetSelector]);

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
  const pageKey = getPageKeyFromPathname(pathname ?? '');
  const pageSteps = pageKey ? PAGE_STEPS[pageKey] : [];
  const pageStep = phase === 'page' ? pageSteps[pageStepIndex] : null;

  let title = '';
  let body = '';
  let showNext = true;
  let nextLabel = '다음';
  let onPrimary: () => void = nextStep;

  if (isWelcome) {
    const s = step as WelcomeStep;
    title = s.title;
    body = s.body;
    nextLabel = '시작';
  } else if (isDone) {
    title = '튜토리얼 완료';
    body = 'MOVE IT 관리자 화면 둘러보기를 마쳤습니다. 필요할 때 헤더의 "온보딩 튜토리얼"에서 다시 볼 수 있어요.';
    nextLabel = '확인';
    onPrimary = completeOnboarding;
  } else if (isSidebar) {
    const s = step as SidebarStep;
    title = s.label;
    body = s.message;
    nextLabel = '이동하기';
    onPrimary = () => {
      if (academyId) {
        router.push(getSidebarStepUrl(academyId, currentStep));
      }
    };
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" aria-modal="true" role="dialog">
      {/* Backdrop: full dim or 4 strips to leave target visible */}
      {targetRect ? (
        <>
          <div className="absolute inset-0 bg-black/60 dark:bg-black/70" style={{ top: 0, left: 0, right: 0, height: targetRect.top - padding }} onClick={(e) => e.target === e.currentTarget && closeOnboarding()} />
          <div className="absolute bg-black/60 dark:bg-black/70" style={{ top: targetRect.top - padding, left: 0, width: targetRect.left - padding, bottom: 0 }} onClick={(e) => e.target === e.currentTarget && closeOnboarding()} />
          <div className="absolute bg-black/60 dark:bg-black/70" style={{ top: targetRect.top - padding, left: targetRect.right + padding, right: 0, bottom: 0 }} onClick={(e) => e.target === e.currentTarget && closeOnboarding()} />
          <div className="absolute left-0 right-0 bg-black/60 dark:bg-black/70" style={{ top: targetRect.bottom + padding, left: 0, right: 0, bottom: 0 }} onClick={(e) => e.target === e.currentTarget && closeOnboarding()} />
          <div
            className="absolute rounded-lg ring-2 ring-primary dark:ring-[#CCFF00] ring-offset-2 ring-offset-white dark:ring-offset-neutral-900 pointer-events-none"
            style={{
              left: targetRect.left - padding,
              top: targetRect.top - padding,
              width: targetRect.width + padding * 2,
              height: targetRect.height + padding * 2,
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/60 dark:bg-black/70" onClick={(e) => e.target === e.currentTarget && closeOnboarding()} />
      )}

      {/* Message card */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 p-6 flex flex-col max-h-[85vh]">
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
        <div className="mt-2 overflow-y-auto flex-1 min-h-0 max-h-[40vh] pr-1">
          <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed whitespace-pre-line">
            {body}
          </p>
          {showActionHint && (
            <p className="mt-3 text-sm font-medium text-primary dark:text-[#CCFF00] flex items-center gap-2">
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
            <button
              type="button"
              onClick={onPrimary}
              className="px-4 py-2 rounded-lg bg-primary dark:bg-[#CCFF00] text-black font-medium text-sm hover:opacity-90"
            >
              {nextLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
