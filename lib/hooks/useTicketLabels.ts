"use client";

import { useState, useEffect, useCallback } from 'react';
import { DEFAULT_TICKET_LABELS } from '@/lib/constants/ticket-labels';

export interface TicketLabels {
  regular: string;
  popup: string;
  workshop: string;
}

/**
 * 학원별 수강권 유형 표기 (사용자/공개 API 사용).
 * academyId가 없으면 기본값 반환.
 */
export function useTicketLabels(academyId: string | undefined): {
  labels: TicketLabels;
  loading: boolean;
  refetch: () => Promise<void>;
} {
  const [labels, setLabels] = useState<TicketLabels>({
    regular: DEFAULT_TICKET_LABELS.regular,
    popup: DEFAULT_TICKET_LABELS.popup,
    workshop: DEFAULT_TICKET_LABELS.workshop,
  });
  const [loading, setLoading] = useState(!!academyId);

  const fetchLabels = useCallback(async () => {
    if (!academyId) {
      setLabels({
        regular: DEFAULT_TICKET_LABELS.regular,
        popup: DEFAULT_TICKET_LABELS.popup,
        workshop: DEFAULT_TICKET_LABELS.workshop,
      });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/academies/${academyId}/ticket-labels`);
      const data = await res.json();
      setLabels({
        regular: data.regular ?? DEFAULT_TICKET_LABELS.regular,
        popup: data.popup ?? DEFAULT_TICKET_LABELS.popup,
        workshop: data.workshop ?? DEFAULT_TICKET_LABELS.workshop,
      });
    } catch {
      setLabels({
        regular: DEFAULT_TICKET_LABELS.regular,
        popup: DEFAULT_TICKET_LABELS.popup,
        workshop: DEFAULT_TICKET_LABELS.workshop,
      });
    } finally {
      setLoading(false);
    }
  }, [academyId]);

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  return { labels, loading, refetch: fetchLabels };
}

/** 여러 학원의 수강권 라벨 맵 (예: 내 수강권에서 학원별 표기) */
export function useTicketLabelsMap(academyIds: string[]): {
  labelsMap: Record<string, TicketLabels>;
  loading: boolean;
} {
  const [labelsMap, setLabelsMap] = useState<Record<string, TicketLabels>>({});
  const [loading, setLoading] = useState(true);
  const uniqueIds = [...new Set(academyIds.filter(Boolean))];

  useEffect(() => {
    if (uniqueIds.length === 0) {
      setLabelsMap({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all(
      uniqueIds.map(async (id) => {
        try {
          const res = await fetch(`/api/academies/${id}/ticket-labels`);
          const data = await res.json();
          return { id, labels: { regular: data.regular ?? DEFAULT_TICKET_LABELS.regular, popup: data.popup ?? DEFAULT_TICKET_LABELS.popup, workshop: data.workshop ?? DEFAULT_TICKET_LABELS.workshop } as TicketLabels };
        } catch {
          return { id, labels: { ...DEFAULT_TICKET_LABELS } as TicketLabels };
        }
      })
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, TicketLabels> = {};
      results.forEach(({ id, labels }) => { map[id] = labels; });
      setLabelsMap(map);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [uniqueIds.join(',')]);

  return { labelsMap, loading };
}
