import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MOVEIT - Dance Academy Platform",
  description: "Find your dance style and book classes",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <div className="flex justify-center bg-black min-h-screen">
          <div className="w-full max-w-[420px] bg-neutral-950 min-h-screen relative shadow-2xl flex flex-col border-x border-neutral-900 overflow-hidden">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}





