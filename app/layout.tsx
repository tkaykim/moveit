import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";

const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'arial'],
});

export const metadata: Metadata = {
  title: "MOVE.IT - 댄스 학원 강사 플랫폼",
  description: "댄스 학원, 강사, 수강 클래스를 찾고 예약하는 플랫폼",
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="format-detection" content="telephone=no" />
        <style dangerouslySetInnerHTML={{
          __html: `
            /* Critical CSS - 레이아웃 깨짐 방지 */
            html { visibility: hidden; }
            html.css-loaded { visibility: visible; }
            body { margin: 0; padding: 0; }
            * { box-sizing: border-box; }
          `
        }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // CSS 로딩 확인
                function checkCSSLoaded() {
                  if (document.styleSheets.length > 0) {
                    document.documentElement.classList.add('css-loaded');
                    return true;
                  }
                  return false;
                }
                
                // 즉시 확인
                if (checkCSSLoaded()) {
                  return;
                }
                
                // DOMContentLoaded 후 확인
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', function() {
                    setTimeout(function() {
                      if (!checkCSSLoaded()) {
                        document.documentElement.classList.add('css-loaded');
                      }
                    }, 100);
                  });
                } else {
                  setTimeout(function() {
                    if (!checkCSSLoaded()) {
                      document.documentElement.classList.add('css-loaded');
                    }
                  }, 100);
                }
                
                // 최대 3초 후 강제로 표시
                setTimeout(function() {
                  document.documentElement.classList.add('css-loaded');
                }, 3000);
              })();
            `
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          enableColorScheme
          disableTransitionOnChange={false}
        >
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

