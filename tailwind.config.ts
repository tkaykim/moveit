import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
      },
      // 2026-05-10: z-index 위계를 의미 단위 토큰으로 정리.
      //   nav(40)        : bottom-nav, 모바일 사이드바 오버레이, 일반 dropdown
      //   modal(50)      : 일반 모달 (admin 폼·detail 등)
      //   drawer(60)     : 모달 위 모달, 결제 drawer, 토스 결제 위젯
      //   guestCta(70)   : 비회원 결제 후 가입 CTA(다른 결제 모달 위)
      //   auth(80)       : 로그인/가입 모달 — drawer/위젯/가입CTA 위, 시스템 오버레이 아래
      //   system(100)    : onboarding overlay, exit-QR 비번, intro preview 등 시스템 차단 UI
      // 신규 코드는 z-{nav,modal,drawer,guestCta,auth,system} 사용 권장. 기존 임의값
      // (z-[60]/z-[70]/z-[80]/z-[100])은 점진 마이그레이션.
      zIndex: {
        nav: '40',
        modal: '50',
        drawer: '60',
        guestCta: '70',
        auth: '80',
        system: '100',
      },
      animation: {
        'in': 'fadeIn 0.3s ease-in',
        'slide-in-from-right': 'slideInFromRight 0.3s ease-out',
        'slide-in-from-right-10': 'slideInFromRight10 0.3s ease-out',
        'slide-in-from-bottom': 'slideInFromBottom 0.3s ease-out',
        'zoom-in-95': 'zoomIn95 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInFromRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideInFromRight10: {
          '0%': { transform: 'translateX(10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInFromBottom: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        zoomIn95: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
export default config;

