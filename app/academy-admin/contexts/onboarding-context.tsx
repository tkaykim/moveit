'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import {
  GLOBAL_STEPS,
  PAGE_STEPS,
  SIDEBAR_STEP_TO_PAGE_KEY,
  getPageKeyFromPathname,
  type OnboardingPhase,
  type PageStepDef,
} from '../config/onboarding-steps';

const STORAGE_KEY = 'moveit_admin_onboarding_done';

interface OnboardingState {
  run: boolean;
  phase: OnboardingPhase;
  currentStep: number;
  pageStepIndex: number;
  pageStepsSeen: Set<string>; // pathname or pageKey
}

interface OnboardingContextValue extends OnboardingState {
  startOnboarding: () => void;
  nextStep: () => void;
  closeOnboarding: () => void;
  completeOnboarding: () => void;
  getCurrentPageSteps: () => PageStepDef[] | null;
  markPageStepsSeen: (pathnameOrKey: string) => void;
}

const defaultState: OnboardingState = {
  run: false,
  phase: 'welcome',
  currentStep: 0,
  pageStepIndex: 0,
  pageStepsSeen: new Set(),
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<OnboardingState>(defaultState);

  const startOnboarding = useCallback(() => {
    setState({
      run: true,
      phase: 'welcome',
      currentStep: 0,
      pageStepIndex: 0,
      pageStepsSeen: new Set(),
    });
  }, []);

  const closeOnboarding = useCallback(() => {
    setState((prev) => ({ ...prev, run: false }));
  }, []);

  const completeOnboarding = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, 'true');
      } catch (_) {}
    }
    closeOnboarding();
  }, [closeOnboarding]);

  const markPageStepsSeen = useCallback((pathnameOrKey: string) => {
    setState((prev) => {
      const next = new Set(prev.pageStepsSeen);
      next.add(pathnameOrKey);
      return { ...prev, pageStepsSeen: next };
    });
  }, []);

  const getCurrentPageSteps = useCallback((): PageStepDef[] | null => {
    const pageKey = getPageKeyFromPathname(pathname ?? '');
    if (!pageKey || !PAGE_STEPS[pageKey]) return null;
    return PAGE_STEPS[pageKey];
  }, [pathname]);

  const nextStep = useCallback(() => {
    const pageKey = getPageKeyFromPathname(pathname ?? '');
    setState((prev) => {
      if (prev.phase === 'welcome') {
        return {
          ...prev,
          phase: 'sidebar',
          currentStep: 1,
        };
      }
      if (prev.phase === 'sidebar') {
        const nextIndex = prev.currentStep + 1;
        if (nextIndex >= GLOBAL_STEPS.length) {
          return {
            ...prev,
            phase: 'done',
            currentStep: nextIndex - 1,
          };
        }
        return {
          ...prev,
          currentStep: nextIndex,
        };
      }
      if (prev.phase === 'page') {
        const steps = pageKey ? PAGE_STEPS[pageKey] : [];
        const nextPageIndex = prev.pageStepIndex + 1;
        if (nextPageIndex >= (steps?.length ?? 0)) {
          const nextSeen = new Set(prev.pageStepsSeen);
          if (pageKey) nextSeen.add(pageKey);
          return {
            ...prev,
            phase: 'sidebar',
            pageStepIndex: 0,
            currentStep: Math.min(prev.currentStep + 1, GLOBAL_STEPS.length - 1),
            pageStepsSeen: nextSeen,
          };
        }
        return { ...prev, pageStepIndex: nextPageIndex };
      }
      return prev;
    });
  }, [pathname]);

  useEffect(() => {
    if (!state.run || state.phase !== 'sidebar' || !pathname) return;
    const pageKey = getPageKeyFromPathname(pathname);
    const expectedKey = SIDEBAR_STEP_TO_PAGE_KEY[state.currentStep];
    if (pageKey && expectedKey && pageKey === expectedKey && PAGE_STEPS[pageKey]?.length) {
      setState((prev) => ({ ...prev, phase: 'page', pageStepIndex: 0 }));
    }
  }, [pathname, state.run, state.phase, state.currentStep]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      ...state,
      startOnboarding,
      nextStep,
      closeOnboarding,
      completeOnboarding,
      getCurrentPageSteps,
      markPageStepsSeen,
    }),
    [
      state.run,
      state.phase,
      state.currentStep,
      state.pageStepIndex,
      state.pageStepsSeen,
      startOnboarding,
      nextStep,
      closeOnboarding,
      completeOnboarding,
      getCurrentPageSteps,
      markPageStepsSeen,
    ]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return ctx;
}

export function useOnboardingOptional(): OnboardingContextValue | null {
  return useContext(OnboardingContext);
}
