"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RotateCcw, Save, Settings2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/utils/supabase-client";

interface ExtensionPolicySettingsCardProps {
  academyId: string;
}

export function ExtensionPolicySettingsCard({ academyId }: ExtensionPolicySettingsCardProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedValue, setSavedValue] = useState<number | null>(null);
  const [draftValue, setDraftValue] = useState<string>("");

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academyId]);

  const load = async () => {
    const supabase = getSupabaseClient();
    if (!supabase || !academyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("academies")
        .select("max_extension_days")
        .eq("id", academyId)
        .single();
      if (error) throw error;

      const value = (data as any)?.max_extension_days ?? null;
      setSavedValue(value);
      setDraftValue(value == null ? "" : String(value));
    } catch (e) {
      console.error("Failed to load max_extension_days:", e);
    } finally {
      setLoading(false);
    }
  };

  const parsed = useMemo(() => {
    if (draftValue === "") return { value: null as number | null, valid: true, reason: "" };
    const n = Number(draftValue);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return { value: null as number | null, valid: false, reason: "정수로 입력해주세요." };
    }
    if (n < 0) return { value: null as number | null, valid: false, reason: "0 이상의 숫자만 가능합니다." };
    return { value: n, valid: true, reason: "" };
  }, [draftValue]);

  const dirty = useMemo(() => {
    if (!parsed.valid) return true;
    return parsed.value !== savedValue;
  }, [parsed, savedValue]);

  const unlimited = draftValue === "";

  const save = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      alert("데이터베이스 연결에 실패했습니다.");
      return;
    }

    if (!parsed.valid) {
      alert(parsed.reason || "입력값을 확인해주세요.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("academies")
        .update({ max_extension_days: parsed.value })
        .eq("id", academyId);
      if (error) throw error;
      setSavedValue(parsed.value);
      alert("연장/일시정지 정책이 저장되었습니다.");
    } catch (e: any) {
      console.error("Failed to save max_extension_days:", e);
      alert(`저장에 실패했습니다: ${e?.message || "알 수 없는 오류"}`);
    } finally {
      setSaving(false);
    }
  };

  const revert = () => {
    setDraftValue(savedValue == null ? "" : String(savedValue));
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Settings2 size={16} />
            연장/일시정지 설정
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            회원이 연장/일시정지를 신청할 때 허용할 최대 일수를 설정합니다.
          </p>
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 size={16} className="animate-spin" />
            불러오는 중...
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                수강권 연장/일시정지 신청 최대 일수
              </label>
              {dirty && (
                <span className="text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2.5 py-1 rounded-full border border-orange-200 dark:border-orange-900/30">
                  저장되지 않은 변경
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex items-center gap-3 flex-1">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={unlimited}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      if (checked) setDraftValue("");
                      else setDraftValue(savedValue == null ? "0" : String(savedValue));
                    }}
                    className="h-4 w-4 rounded border-gray-300 dark:border-neutral-600"
                  />
                  제한 없음
                </label>

                <input
                  type="number"
                  min={0}
                  step={1}
                  disabled={unlimited}
                  className="w-full max-w-sm border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white disabled:opacity-60"
                  value={draftValue}
                  onChange={(e) => setDraftValue(e.target.value)}
                  placeholder="예: 10"
                  inputMode="numeric"
                />
              </div>

              <div className="flex items-center gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={revert}
                  disabled={saving || !dirty}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-800 dark:text-gray-200 disabled:opacity-50"
                >
                  <RotateCcw size={16} />
                  되돌리기
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || !dirty || !parsed.valid}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  저장
                </button>
              </div>
            </div>

            {!parsed.valid && draftValue !== "" && (
              <p className="text-xs text-red-600 dark:text-red-400">{parsed.reason}</p>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400">
              현재 값: {savedValue == null ? "제한 없음" : `${savedValue}일`}
              {savedValue != null && " (0이면 연장/일시정지 자체를 막는 의미는 아니고, 최대치가 0이 됩니다)"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

