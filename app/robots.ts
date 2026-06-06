import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://moveit-xi.vercel.app";
const DISALLOW = ["/admin", "/api/", "/signin", "/signup", "/auth/", "/mypage"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // AI 검색/학습 크롤러 포함 전체 허용(관리·기능 경로만 제외)
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      // 무단 데이터 수집봇 차단
      { userAgent: "Bytespider", disallow: "/" },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
