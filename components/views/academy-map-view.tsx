"use client";

import { fetchWithAuth } from '@/lib/api/auth-fetch';

import Image from "next/image";
import {
  MapPin,
  Search,
  X,
  Heart,
  Phone,
  ExternalLink,
  ChevronRight,
  Navigation,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Map as MapIcon,
} from "lucide-react";
import { useEffect, useState, useMemo, useCallback } from "react";
import { getSupabaseClient } from "@/lib/utils/supabase-client";
import { Academy } from "@/types";
import { AcademyFilterModal, AcademyFilter } from "@/components/modals/academy-filter-modal";
import {
  calculateDistance,
  parseAddressToCoordinates,
  formatDistance,
  getMarkerCoordinates,
} from "@/lib/utils/distance";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { LanguageToggle } from "@/components/common/language-toggle";
import { useTranslation } from "@/lib/i18n/useTranslation";
import dynamic from "next/dynamic";

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };
const DEFAULT_ZOOM = 12;

type SortOption = "default" | "distance" | "price_asc" | "price_desc";

function transformAcademy(dbAcademy: any): Academy {
  const name = dbAcademy.name_kr || dbAcademy.name_en || "이름 없음";
  const images = Array.isArray(dbAcademy.images) ? dbAcademy.images : [];
  const sortedImages = images.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
  const imageUrl =
    sortedImages[0]?.url ?? dbAcademy.logo_url;

  return {
    id: dbAcademy.id,
    name_kr: dbAcademy.name_kr,
    name_en: dbAcademy.name_en,
    tags: dbAcademy.tags,
    logo_url: dbAcademy.logo_url,
    name,
    dist: undefined,
    rating: undefined,
    price: undefined,
    badges: [],
    img: imageUrl || undefined,
    academyId: dbAcademy.id,
    address: dbAcademy.address,
    contact_number: dbAcademy.contact_number ?? undefined,
  };
}

const GoogleMapBlock = dynamic(
  () => import("@/components/views/academy-map-block").then((m) => m.AcademyMapBlock),
  { ssr: false, loading: () => <div className="w-full h-full bg-neutral-200 dark:bg-neutral-800 animate-pulse rounded-xl" /> }
);

interface AcademyMapViewProps {
  onAcademyClick: (academy: Academy) => void;
}

export function AcademyMapView({ onAcademyClick }: AcademyMapViewProps) {
  const { language } = useLocale();
  const { translateTexts, isEnglish } = useTranslation();
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("default");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [filter, setFilter] = useState<AcademyFilter>({
    tags: [],
    priceRange: { min: null, max: null },
  });
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [selectedAcademy, setSelectedAcademy] = useState<Academy | null>(null);
  const [favoritedAcademies, setFavoritedAcademies] = useState<Set<string>>(new Set());
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const { user } = useAuth();
  const [isTranslated, setIsTranslated] = useState(false);
  const [drawerExpanded, setDrawerExpanded] = useState(false); // 드로어 확장 상태

  const translateAcademies = useCallback(async () => {
    if (!isEnglish || academies.length === 0 || isTranslated) return;
    const names = academies.map((a) => a.name);
    const translations = await translateTexts(names);
    setAcademies((prev) =>
      prev.map((a, i) => ({ ...a, name: translations[i] || a.name }))
    );
    setIsTranslated(true);
  }, [isEnglish, academies, translateTexts, isTranslated]);

  useEffect(() => {
    setIsTranslated(false);
  }, [language]);

  useEffect(() => {
    if (isEnglish && !loading && academies.length > 0 && !isTranslated) {
      translateAcademies();
    }
  }, [isEnglish, loading, academies.length, isTranslated, translateAcademies]);

  useEffect(() => {
    if (sortOption === "distance" && !userLocation) {
      setLocationLoading(true);
      let isMounted = true;
      const timeoutId = setTimeout(() => {
        if (isMounted) {
          setUserLocation({ lat: 37.5665, lon: 126.978 });
          setLocationLoading(false);
        }
      }, 5000);
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            clearTimeout(timeoutId);
            if (isMounted) {
              setUserLocation({
                lat: position.coords.latitude,
                lon: position.coords.longitude,
              });
              setMapCenter({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              });
              setMapZoom(14);
              setLocationLoading(false);
            }
          },
          () => {
            clearTimeout(timeoutId);
            if (isMounted) {
              setUserLocation({ lat: 37.5665, lon: 126.978 });
              setLocationLoading(false);
            }
          },
          { timeout: 5000, maximumAge: 60000, enableHighAccuracy: false }
        );
      } else {
        setUserLocation({ lat: 37.5665, lon: 126.978 });
        setLocationLoading(false);
      }
      return () => {
        isMounted = false;
      };
    }
  }, [sortOption, userLocation]);

  useEffect(() => {
    let isMounted = true;
    async function loadAcademies() {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          if (isMounted) setLoading(false);
          return;
        }
        const { data, error } = await supabase
          .from("academies")
          .select("id, name_kr, name_en, tags, logo_url, address, contact_number, images, created_at")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) throw error;
        if (!isMounted) return;
        const academyIds = (data || []).map((a: any) => a.id);
        let priceMap = new Map<string, number>();
        if (academyIds.length > 0) {
          const { data: ticketsData } = await supabase
            .from("tickets")
            .select("academy_id, price")
            .in("academy_id", academyIds)
            .eq("is_on_sale", true)
            .or("is_public.eq.true,is_public.is.null")
            .not("price", "is", null)
            .gt("price", 0)
            .limit(500);
          if (!isMounted) return;
          (ticketsData || []).forEach((ticket: any) => {
            if (ticket.academy_id && ticket.price) {
              const current = priceMap.get(ticket.academy_id);
              if (!current || ticket.price < current)
                priceMap.set(ticket.academy_id, ticket.price);
            }
          });
        }
        const transformed = (data || []).map((dbAcademy: any) => {
          const academy = transformAcademy({ ...dbAcademy, classes: [] });
          const minPrice = priceMap.get(dbAcademy.id);
          if (minPrice) academy.price = minPrice;
          return academy;
        });
        if (isMounted) setAcademies(transformed);
      } catch (e) {
        console.error("Error loading academies:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadAcademies();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setFavoritedAcademies(new Set());
      return;
    }
    fetchWithAuth("/api/favorites?type=academy")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((data) => {
        const ids = new Set<string>(
          (data.data || [])
            .map((item: any) => item.academies?.id)
            .filter((id: any): id is string => Boolean(id))
        );
        setFavoritedAcademies(ids);
      })
      .catch(() => {});
  }, [user]);

  const handleToggleFavorite = async (e: React.MouseEvent, academyId: string) => {
    e.stopPropagation();
    if (!user) return;
    try {
      const res = await fetchWithAuth("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "academy", id: academyId }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.isFavorited) {
          setFavoritedAcademies((prev) => new Set([...prev, academyId]));
        } else {
          setFavoritedAcademies((prev) => {
            const next = new Set(prev);
            next.delete(academyId);
            return next;
          });
        }
      }
    } catch (_) {}
  };

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    academies.forEach((academy) => {
      if (academy.tags) {
        academy.tags.split(",").forEach((tag) => {
          const t = tag.trim();
          if (t) tagSet.add(t);
        });
      }
    });
    return Array.from(tagSet).sort();
  }, [academies]);

  const filteredAndSortedAcademies = useMemo(() => {
    let list = [...academies];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.tags?.toLowerCase().includes(q) ||
          a.address?.toLowerCase().includes(q)
      );
    }
    if (filter.tags.length > 0) {
      list = list.filter((a) => {
        if (!a.tags) return false;
        const tags = a.tags.split(",").map((t) => t.trim().toLowerCase());
        return filter.tags.some((ft) => tags.includes(ft.toLowerCase()));
      });
    }
    if (filter.priceRange.min !== null || filter.priceRange.max !== null) {
      list = list.filter((a) => {
        if (!a.price) return false;
        const okMin =
          filter.priceRange.min === null || a.price >= filter.priceRange.min!;
        const okMax =
          filter.priceRange.max === null || a.price <= filter.priceRange.max!;
        return okMin && okMax;
      });
    }
    if (sortOption === "distance" && userLocation) {
      list = list
        .map((a) => {
          const coords = parseAddressToCoordinates(a.address);
          const distanceKm = coords
            ? calculateDistance(
                userLocation.lat,
                userLocation.lon,
                coords[0],
                coords[1]
              )
            : Infinity;
          return {
            ...a,
            dist: coords ? formatDistance(distanceKm) : undefined,
            distanceKm,
          };
        })
        .sort((a, b) => (a as any).distanceKm - (b as any).distanceKm);
    } else if (sortOption === "price_asc") {
      list.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    } else if (sortOption === "price_desc") {
      list.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    }
    return list;
  }, [academies, searchQuery, filter, sortOption, userLocation]);

  const academiesWithCoords = useMemo(() => {
    return filteredAndSortedAcademies
      .map((a) => ({
        academy: a,
        coords: getMarkerCoordinates(a.address, a.id),
      }))
      .filter((x): x is { academy: Academy; coords: { lat: number; lng: number } } => x.coords !== null);
  }, [filteredAndSortedAcademies]);

  const getSortLabel = () => {
    if (language === "en") {
      switch (sortOption) {
        case "distance":
          return "Distance";
        case "price_asc":
          return "Price: Low";
        case "price_desc":
          return "Price: High";
        default:
          return "Default";
      }
    }
    switch (sortOption) {
      case "distance":
        return "거리순";
      case "price_asc":
        return "가격 낮은순";
      case "price_desc":
        return "가격 높은순";
      default:
        return "기본순";
    }
  };

  const activeFilterCount =
    filter.tags.length +
    (filter.priceRange.min !== null || filter.priceRange.max !== null ? 1 : 0);

  // 선택한 학원으로 지도 중심 이동
  useEffect(() => {
    if (!selectedAcademy) return;
    const coords = getMarkerCoordinates(selectedAcademy.address, selectedAcademy.id);
    if (coords) {
      setMapCenter(coords);
      setMapZoom(15);
    }
  }, [selectedAcademy?.id]);

  const goToMyLocation = useCallback(() => {
    if (locationLoading) return;
    setLocationLoading(true);
    if (!navigator.geolocation) {
      setUserLocation({ lat: 37.5665, lon: 126.978 });
      setMapCenter(DEFAULT_CENTER);
      setMapZoom(DEFAULT_ZOOM);
      setLocationLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLocation({ lat, lon: lng });
        setMapCenter({ lat, lng });
        setMapZoom(14);
        setSortOption("distance");
        setLocationLoading(false);
      },
      () => {
        setUserLocation({ lat: 37.5665, lon: 126.978 });
        setMapCenter(DEFAULT_CENTER);
        setLocationLoading(false);
      },
      { timeout: 5000, maximumAge: 60000 }
    );
  }, [locationLoading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-neutral-300 dark:border-neutral-600 border-t-primary dark:border-t-[#CCFF00] rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-5rem)] pb-0 animate-in fade-in duration-300">
      {/* 상단: 검색 + 내 주변 / 정렬·필터 */}
      <div className="flex-shrink-0 sticky top-0 z-30 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md px-4 pt-8 pb-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold text-black dark:text-white truncate">
            {language === "en" ? "Dance Academy" : "댄스학원"}
          </h1>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <span className="text-sm text-neutral-500 flex-shrink-0">
              {filteredAndSortedAcademies.length}
              {language === "en" ? "" : "개"}
            </span>
          </div>
        </div>
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            size={18}
          />
          <input
            type="text"
            placeholder={
              language === "en"
                ? "Search academy, genre, address..."
                : "학원명, 장르, 주소 검색..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 bg-neutral-100 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 text-black dark:text-white placeholder-neutral-400 focus:outline-none focus:border-neutral-400 dark:focus:border-[#CCFF00] text-sm transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black dark:hover:text-white"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={goToMyLocation}
            disabled={locationLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-primary dark:bg-[#CCFF00] text-black border border-primary dark:border-[#CCFF00] disabled:opacity-60"
          >
            <Navigation size={16} />
            {locationLoading
              ? language === "en"
                ? "Getting location..."
                : "위치 확인 중..."
              : language === "en"
                ? "Near me"
                : "내 주변"}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSortDropdownOpen((o) => !o)}
              className="flex items-center gap-1 px-3 py-2 bg-neutral-100 dark:bg-neutral-900 rounded-lg text-sm text-black dark:text-white border border-neutral-200 dark:border-neutral-800"
            >
              {getSortLabel()}
              <ChevronDown
                size={14}
                className={`transition-transform ${isSortDropdownOpen ? "rotate-180" : ""}`}
              />
            </button>
            {isSortDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsSortDropdownOpen(false)}
                />
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg z-50 min-w-[120px]">
                  {[
                    {
                      value: "default",
                      label: language === "en" ? "Default" : "기본순",
                    },
                    {
                      value: "distance",
                      label: language === "en" ? "Distance" : "거리순",
                    },
                    {
                      value: "price_asc",
                      label: language === "en" ? "Price: Low" : "가격 낮은순",
                    },
                    {
                      value: "price_desc",
                      label: language === "en" ? "Price: High" : "가격 높은순",
                    },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setSortOption(opt.value as SortOption);
                        setIsSortDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 first:rounded-t-lg last:rounded-b-lg ${
                        sortOption === opt.value
                          ? "text-primary dark:text-[#CCFF00] font-medium"
                          : "text-black dark:text-white"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm border transition-colors ${
              activeFilterCount > 0
                ? "bg-primary dark:bg-[#CCFF00] text-black border-primary dark:border-[#CCFF00]"
                : "bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white border-neutral-200 dark:border-neutral-800"
            }`}
          >
            <SlidersHorizontal size={14} />
            {language === "en" ? "Filter" : "필터"}
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-white dark:bg-black text-primary dark:text-[#CCFF00] text-[10px] font-bold rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 지도 영역 */}
      <div className="flex-1 min-h-[300px] w-full relative rounded-xl overflow-hidden">
        <GoogleMapBlock
          center={mapCenter}
          zoom={mapZoom}
          academiesWithCoords={academiesWithCoords}
          selectedAcademy={selectedAcademy}
          onSelectAcademy={setSelectedAcademy}
          onCenterChange={setMapCenter}
          onZoomChange={setMapZoom}
        />
      </div>

      {/* 하단 패널: 드래그 확장 가능한 드로어 */}
      <div
        className={`flex-shrink-0 bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)] transition-all duration-300 ${
          drawerExpanded ? "absolute inset-x-0 bottom-0 top-[140px] z-40 overflow-hidden flex flex-col" : ""
        }`}
      >
        {/* 드로어 핸들 */}
        <button
          type="button"
          onClick={() => {
            setDrawerExpanded((v) => !v);
            if (!drawerExpanded) setSelectedAcademy(null);
          }}
          className="w-full flex flex-col items-center pt-2 pb-1 cursor-pointer"
        >
          <div className="w-10 h-1 bg-neutral-300 dark:bg-neutral-600 rounded-full" />
          <div className="flex items-center gap-1 mt-1 text-xs text-neutral-500">
            {drawerExpanded ? (
              <>
                <ChevronDown size={14} />
                <span>{language === "en" ? "Collapse" : "지도 보기"}</span>
              </>
            ) : (
              <>
                <ChevronUp size={14} />
                <span>{language === "en" ? "View list" : "목록 보기"}</span>
              </>
            )}
          </div>
        </button>

        {/* 확장된 목록 뷰 */}
        {drawerExpanded ? (
          <div className="flex-1 overflow-y-auto px-4 pb-6 scrollbar-hide">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-black dark:text-white">
                {language === "en" ? "Academy List" : "학원 목록"}
                <span className="ml-2 text-neutral-500 font-normal">
                  {filteredAndSortedAcademies.length}
                  {language === "en" ? "" : "개"}
                </span>
              </p>
              <button
                type="button"
                onClick={() => setDrawerExpanded(false)}
                className="flex items-center gap-1 text-xs text-primary dark:text-[#CCFF00] font-medium"
              >
                <MapIcon size={14} />
                {language === "en" ? "Map" : "지도"}
              </button>
            </div>
            {filteredAndSortedAcademies.length === 0 ? (
              <div className="py-12 text-center text-neutral-500 text-sm">
                {searchQuery || activeFilterCount > 0
                  ? language === "en"
                    ? "No results found."
                    : "검색 결과가 없습니다."
                  : language === "en"
                    ? "No academies."
                    : "학원이 없습니다."}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAndSortedAcademies.map((academy) => (
                  <button
                    key={academy.id}
                    type="button"
                    onClick={() => onAcademyClick(academy)}
                    className="flex gap-3 w-full p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-left active:scale-[0.99] transition-transform"
                  >
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-700 flex-shrink-0">
                      {(academy.img || academy.logo_url) ? (
                        <Image
                          src={academy.img || academy.logo_url || ""}
                          alt={academy.name}
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <MapPin className="text-neutral-400" size={20} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <h4 className="font-semibold text-black dark:text-white text-sm truncate">
                        {academy.name}
                      </h4>
                      {academy.address && (
                        <p className="text-xs text-neutral-500 truncate mt-0.5 flex items-center gap-1">
                          <MapPin size={10} className="flex-shrink-0" />
                          {academy.address}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {academy.price && (
                          <span className="text-xs text-primary dark:text-[#CCFF00] font-semibold">
                            {academy.price.toLocaleString()}원~
                          </span>
                        )}
                        {academy.dist && (
                          <span className="text-xs text-neutral-500">
                            {academy.dist}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight
                      size={18}
                      className="text-neutral-400 flex-shrink-0 self-center"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : selectedAcademy ? (
          /* 선택된 학원 상세 카드 */
          <div className="px-4 pb-6">
            <div className="flex gap-3">
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex-shrink-0">
                {(selectedAcademy.img || selectedAcademy.logo_url) ? (
                  <Image
                    src={selectedAcademy.img || selectedAcademy.logo_url || ""}
                    alt={selectedAcademy.name}
                    width={80}
                    height={80}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <MapPin className="text-neutral-400" size={24} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-black dark:text-white truncate">
                  {selectedAcademy.name}
                </h3>
                {selectedAcademy.address && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5 flex items-center gap-1">
                    <MapPin size={10} />
                    {selectedAcademy.address}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {selectedAcademy.price && (
                    <span className="text-sm font-semibold text-primary dark:text-[#CCFF00]">
                      {selectedAcademy.price.toLocaleString()}원~
                    </span>
                  )}
                  {selectedAcademy.dist && (
                    <span className="text-xs text-neutral-500">
                      · {selectedAcademy.dist}
                    </span>
                  )}
                </div>
              </div>
              {user && (
                <button
                  type="button"
                  onClick={(e) =>
                    handleToggleFavorite(
                      e,
                      (selectedAcademy as any).academyId || selectedAcademy.id
                    )
                  }
                  className="p-2 rounded-full bg-neutral-100 dark:bg-neutral-800 flex-shrink-0"
                >
                  <Heart
                    size={18}
                    fill={
                      favoritedAcademies.has(
                        (selectedAcademy as any).academyId || selectedAcademy.id
                      )
                        ? "currentColor"
                        : "none"
                    }
                    className={
                      favoritedAcademies.has(
                        (selectedAcademy as any).academyId || selectedAcademy.id
                      )
                        ? "text-red-500"
                        : "text-neutral-500"
                    }
                  />
                </button>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              {selectedAcademy.address && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedAcademy.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white text-sm font-medium"
                >
                  <ExternalLink size={16} />
                  {language === "en" ? "Directions" : "경로"}
                </a>
              )}
              {selectedAcademy.contact_number && (
                <a
                  href={`tel:${selectedAcademy.contact_number}`}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white text-sm font-medium"
                >
                  <Phone size={16} />
                  {language === "en" ? "Call" : "전화"}
                </a>
              )}
              <button
                type="button"
                onClick={() => onAcademyClick(selectedAcademy)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary dark:bg-[#CCFF00] text-black text-sm font-bold"
              >
                {language === "en" ? "Details" : "상세보기"}
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        ) : (
          /* 기본: 가로 스크롤 카드 목록 */
          <div className="px-4 pb-6">
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
              {filteredAndSortedAcademies.length === 0 ? (
                <div className="w-full py-6 text-center text-neutral-500 text-sm">
                  {searchQuery || activeFilterCount > 0
                    ? language === "en"
                      ? "No results found."
                      : "검색 결과가 없습니다."
                    : language === "en"
                      ? "No academies."
                      : "학원이 없습니다."}
                </div>
              ) : (
                filteredAndSortedAcademies.slice(0, 20).map((academy) => (
                  <button
                    key={academy.id}
                    type="button"
                    onClick={() => setSelectedAcademy(academy)}
                    className="flex gap-2 flex-shrink-0 w-[260px] p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-left active:scale-[0.98] transition-transform"
                  >
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-700 flex-shrink-0">
                      {(academy.img || academy.logo_url) ? (
                        <Image
                          src={academy.img || academy.logo_url || ""}
                          alt={academy.name}
                          width={56}
                          height={56}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <MapPin className="text-neutral-400" size={20} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-black dark:text-white text-sm truncate">
                        {academy.name}
                      </h4>
                      {academy.price && (
                        <p className="text-xs text-primary dark:text-[#CCFF00] font-medium mt-0.5">
                          {academy.price.toLocaleString()}원~
                        </p>
                      )}
                      {academy.dist && (
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {academy.dist}
                        </p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <AcademyFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onApply={(newFilter) => setFilter(newFilter)}
        currentFilter={filter}
        availableTags={availableTags}
      />
    </div>
  );
}
