"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Clock,
  Loader2,
  Phone,
  Plus,
  Save,
  Settings2,
  Tag,
  Trash2,
  Users,
} from "lucide-react";

interface ConsultationSettingsTabProps {
  academyId: string;
}

interface ConsultationCategory {
  id: string;
  name: string;
  duration_minutes: number;
  display_order: number | null;
}

interface TimeSlot {
  start: string;
  end: string;
}

interface ConsultationAvailability {
  phone: Record<string, TimeSlot[]>;
  visit: Record<string, TimeSlot[]>;
}

type SettingsSubTab = "category" | "availability";

const DAYS = [
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
  { key: "sat", label: "토" },
  { key: "sun", label: "일" },
] as const;

const DEFAULT_SLOT: TimeSlot = { start: "09:00", end: "18:00" };

const ALL_DAYS_DEFAULT_SLOT: TimeSlot[] = [{ start: "00:00", end: "23:59" }];

function getDefaultAllDaysAvailability(): ConsultationAvailability {
  const allDays: Record<string, TimeSlot[]> = {};
  for (const d of DAYS) {
    allDays[d.key] = [{ ...ALL_DAYS_DEFAULT_SLOT[0] }];
  }
  return { phone: { ...allDays }, visit: { ...allDays } };
}

function normalizeAvailability(input: any): ConsultationAvailability {
  if (!input || typeof input !== "object") return getDefaultAllDaysAvailability();
  const phone = typeof input.phone === "object" && input.phone ? input.phone : null;
  const visit = typeof input.visit === "object" && input.visit ? input.visit : null;
  // phone/visit 둘 다 비어있으면 기본값(모든 요일 24시간)
  if (
    (!phone || Object.keys(phone).length === 0) &&
    (!visit || Object.keys(visit).length === 0)
  ) {
    return getDefaultAllDaysAvailability();
  }
  return {
    phone: phone || {},
    visit: visit || {},
  };
}

function getFirstSlot(slots: TimeSlot[] | undefined): TimeSlot {
  const slot = slots?.[0];
  if (!slot) return DEFAULT_SLOT;
  return { start: slot.start || DEFAULT_SLOT.start, end: slot.end || DEFAULT_SLOT.end };
}

export function ConsultationSettingsTab({ academyId }: ConsultationSettingsTabProps) {
  const [subTab, setSubTab] = useState<SettingsSubTab>("availability");

  // 카테고리
  const [categories, setCategories] = useState<ConsultationCategory[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [categoryMinutes, setCategoryMinutes] = useState(30);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [presetLoading, setPresetLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  // 가능 시간
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [availabilitySaved, setAvailabilitySaved] = useState<ConsultationAvailability>({ phone: {}, visit: {} });
  const [availabilityDraft, setAvailabilityDraft] = useState<ConsultationAvailability>({ phone: {}, visit: {} });

  const availabilityDirty = useMemo(() => {
    return JSON.stringify(availabilityDraft) !== JSON.stringify(availabilitySaved);
  }, [availabilityDraft, availabilitySaved]);

  useEffect(() => {
    if (!academyId) return;
    void Promise.all([loadCategories(), loadAvailability()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academyId]);

  const loadCategories = async () => {
    setCategoriesLoading(true);
    try {
      const res = await fetch(`/api/consultation-categories?academyId=${academyId}`);
      const data = await res.json();
      if (res.ok) setCategories(data.data || []);
    } catch {
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const applyPreset = async () => {
    setPresetLoading(true);
    try {
      const res = await fetch(`/api/consultation-categories/preset?academyId=${academyId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "적용 실패");
      await loadCategories();
      alert("프리셋이 적용되었습니다. (입시반 30분, 오디션반 30분, 전문반 30분, 일반 상담 10분)");
    } catch (e: any) {
      alert(e.message || "적용 실패");
    } finally {
      setPresetLoading(false);
    }
  };

  const addCategory = async () => {
    if (!categoryName.trim()) return;
    setCategoryLoading(true);
    try {
      const res = await fetch("/api/consultation-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academy_id: academyId,
          name: categoryName.trim(),
          duration_minutes: categoryMinutes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "추가 실패");
      setCategoryName("");
      setCategoryMinutes(30);
      await loadCategories();
    } catch (e: any) {
      alert(e.message || "추가 실패");
    } finally {
      setCategoryLoading(false);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("이 카테고리를 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/consultation-categories/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      await loadCategories();
    } catch (e: any) {
      alert(e.message || "삭제 실패");
    }
  };

  const loadAvailability = async () => {
    setAvailabilityLoading(true);
    try {
      const res = await fetch(`/api/academies/${academyId}/consultation-availability`);
      const data = await res.json();
      if (res.ok) {
        const normalized = normalizeAvailability(data.data);
        setAvailabilitySaved(normalized);
        setAvailabilityDraft(normalized);
      }
    } catch {
      // ignore
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const saveAvailability = async () => {
    setSavingAvailability(true);
    try {
      const res = await fetch(`/api/academies/${academyId}/consultation-availability`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(availabilityDraft),
      });
      if (!res.ok) throw new Error("저장 실패");
      setAvailabilitySaved(availabilityDraft);
      alert("상담 가능 시간이 저장되었습니다.");
    } catch (e: any) {
      alert(e.message || "저장 실패");
    } finally {
      setSavingAvailability(false);
    }
  };

  const setDayEnabled = (type: "phone" | "visit", dayKey: string, enabled: boolean) => {
    setAvailabilityDraft((prev) => {
      const next: ConsultationAvailability = {
        phone: { ...prev.phone },
        visit: { ...prev.visit },
      };
      if (enabled) {
        next[type][dayKey] = next[type][dayKey]?.length ? next[type][dayKey] : [{ ...DEFAULT_SLOT }];
      } else {
        delete next[type][dayKey];
      }
      return next;
    });
  };

  const updateDayTime = (
    type: "phone" | "visit",
    dayKey: string,
    field: "start" | "end",
    value: string
  ) => {
    setAvailabilityDraft((prev) => {
      const next: ConsultationAvailability = {
        phone: { ...prev.phone },
        visit: { ...prev.visit },
      };
      const current = getFirstSlot(next[type][dayKey]);
      next[type][dayKey] = [{ ...current, [field]: value }];
      return next;
    });
  };

  const subTabs: { id: SettingsSubTab; label: string; icon: any }[] = [
    { id: "availability", label: "가능 시간", icon: Clock },
    { id: "category", label: "카테고리", icon: Tag },
  ];

  return (
    <div className="h-full overflow-y-auto pb-8">
      <div className="max-w-5xl">
        {/* 헤더 + 서브탭 */}
        <div className="mb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Settings2 size={18} />
                상담 설정
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                카테고리 및 상담 가능 시간을 설정합니다.
              </p>
            </div>

            {subTab === "availability" && (
              <div className="hidden sm:flex items-center gap-2">
                {availabilityDirty && (
                  <span className="text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2.5 py-1 rounded-full border border-orange-200 dark:border-orange-900/30">
                    저장되지 않은 변경
                  </span>
                )}
                <button
                  type="button"
                  onClick={saveAvailability}
                  disabled={savingAvailability || availabilityLoading || !availabilityDirty}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {savingAvailability ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  저장
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-1 p-1 bg-gray-100 dark:bg-neutral-800 rounded-xl overflow-x-auto">
            {subTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  subTab === t.id
                    ? "bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <t.icon size={16} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* 가능 시간 */}
        {subTab === "availability" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 전화 */}
              <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">전화 상담</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">요일별 전화 상담 가능 시간</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  {availabilityLoading ? (
                    <div className="flex justify-center py-10">
                      <Loader2 size={24} className="animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {DAYS.map((d) => {
                        const enabled = !!availabilityDraft.phone[d.key]?.length;
                        const slot = getFirstSlot(availabilityDraft.phone[d.key]);
                        return (
                          <div
                            key={d.key}
                            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-100 dark:border-neutral-700"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-7 text-sm font-semibold text-gray-900 dark:text-white">{d.label}</span>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="sr-only peer"
                                  checked={enabled}
                                  onChange={(e) => setDayEnabled("phone", d.key, e.target.checked)}
                                />
                                <div className="w-11 h-6 bg-gray-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
                                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                              </label>
                            </div>

                            <div className="flex items-center gap-2">
                              {!enabled ? (
                                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-200 dark:bg-neutral-700 text-gray-600 dark:text-gray-300">
                                  휴무
                                </span>
                              ) : (
                                <>
                                  <input
                                    type="time"
                                    value={slot.start}
                                    onChange={(e) => updateDayTime("phone", d.key, "start", e.target.value)}
                                    className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-600 text-sm bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                                  />
                                  <span className="text-gray-400">~</span>
                                  <input
                                    type="time"
                                    value={slot.end}
                                    onChange={(e) => updateDayTime("phone", d.key, "end", e.target.value)}
                                    className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-600 text-sm bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                                  />
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* 방문 */}
              <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">방문 상담</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">요일별 방문 상담 가능 시간</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  {availabilityLoading ? (
                    <div className="flex justify-center py-10">
                      <Loader2 size={24} className="animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {DAYS.map((d) => {
                        const enabled = !!availabilityDraft.visit[d.key]?.length;
                        const slot = getFirstSlot(availabilityDraft.visit[d.key]);
                        return (
                          <div
                            key={d.key}
                            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-100 dark:border-neutral-700"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-7 text-sm font-semibold text-gray-900 dark:text-white">{d.label}</span>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="sr-only peer"
                                  checked={enabled}
                                  onChange={(e) => setDayEnabled("visit", d.key, e.target.checked)}
                                />
                                <div className="w-11 h-6 bg-gray-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:bg-purple-600 transition-colors"></div>
                                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                              </label>
                            </div>

                            <div className="flex items-center gap-2">
                              {!enabled ? (
                                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-200 dark:bg-neutral-700 text-gray-600 dark:text-gray-300">
                                  휴무
                                </span>
                              ) : (
                                <>
                                  <input
                                    type="time"
                                    value={slot.start}
                                    onChange={(e) => updateDayTime("visit", d.key, "start", e.target.value)}
                                    className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-600 text-sm bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                                  />
                                  <span className="text-gray-400">~</span>
                                  <input
                                    type="time"
                                    value={slot.end}
                                    onChange={(e) => updateDayTime("visit", d.key, "end", e.target.value)}
                                    className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-600 text-sm bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                                  />
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 모바일 저장 버튼 */}
            <div className="sm:hidden flex items-center justify-between gap-3 bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 p-4">
              <div className="text-sm">
                {availabilityDirty ? (
                  <span className="font-medium text-orange-600 dark:text-orange-400">저장되지 않은 변경이 있어요</span>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400">변경사항이 없습니다</span>
                )}
              </div>
              <button
                type="button"
                onClick={saveAvailability}
                disabled={savingAvailability || availabilityLoading || !availabilityDirty}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {savingAvailability ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                저장
              </button>
            </div>
          </div>
        )}

        {/* 카테고리 */}
        {subTab === "category" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 목록 */}
            <div className="lg:col-span-2 bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">상담 카테고리</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">상담 신청 시 고객이 선택하는 항목</p>
                </div>
                {categories.length === 0 && (
                  <button
                    type="button"
                    onClick={applyPreset}
                    disabled={presetLoading}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
                  >
                    {presetLoading ? <Loader2 size={16} className="animate-spin" /> : <Tag size={16} />}
                    프리셋 적용
                  </button>
                )}
              </div>

              <div className="p-5">
                {categoriesLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 size={24} className="animate-spin text-gray-400" />
                  </div>
                ) : categories.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 dark:border-neutral-700 p-6 text-center">
                    <Tag className="w-10 h-10 mx-auto text-gray-300 dark:text-neutral-600" />
                    <p className="mt-3 font-medium text-gray-900 dark:text-white">카테고리가 없습니다</p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      우측에서 새 카테고리를 추가하거나 프리셋을 적용해보세요.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {categories.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-100 dark:border-neutral-700"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">{c.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">소요시간 {c.duration_minutes}분</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteCategory(c.id)}
                          className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 추가 */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
                <h3 className="font-semibold text-gray-900 dark:text-white">새 카테고리 추가</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">예: 입시반, 오디션반, 일반 상담</p>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">이름</label>
                  <input
                    type="text"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="카테고리 이름"
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">소요시간(분)</label>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={categoryMinutes}
                    onChange={(e) => setCategoryMinutes(Number(e.target.value) || 30)}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <button
                  type="button"
                  onClick={addCategory}
                  disabled={categoryLoading || !categoryName.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {categoryLoading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  추가
                </button>

                {categories.length > 0 && (
                  <div className="pt-3 border-t border-gray-100 dark:border-neutral-800">
                    <button
                      type="button"
                      onClick={applyPreset}
                      disabled={presetLoading}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-800 dark:text-gray-200 text-sm font-medium disabled:opacity-50 transition-colors"
                    >
                      {presetLoading ? <Loader2 size={16} className="animate-spin" /> : <Tag size={16} />}
                      프리셋 다시 적용
                    </button>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      기존 카테고리에 더해 프리셋이 추가됩니다.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

