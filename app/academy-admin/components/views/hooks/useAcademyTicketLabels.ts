"use client";

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import {
  DEFAULT_TICKET_LABELS,
  getTicketLabel,
  type TicketCategoryKey,
} from '@/lib/constants/ticket-labels';

export interface AcademyTicketLabels {
  regular: string;
  popup: string;
  workshop: string;
}

export interface RawAcademyLabels {
  ticket_label_regular: string | null;
  ticket_label_popup: string | null;
  ticket_label_workshop: string | null;
}

export function useAcademyTicketLabels(academyId: string | undefined) {
  const [raw, setRaw] = useState<RawAcademyLabels | null>(null);
  const [loading, setLoading] = useState(!!academyId);

  const load = useCallback(async () => {
    if (!academyId) {
      setRaw(null);
      setLoading(false);
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('academies')
        .select('ticket_label_regular, ticket_label_popup, ticket_label_workshop')
        .eq('id', academyId)
        .single();
      if (error) {
        setRaw(null);
        return;
      }
      setRaw({
        ticket_label_regular: data?.ticket_label_regular ?? null,
        ticket_label_popup: data?.ticket_label_popup ?? null,
        ticket_label_workshop: data?.ticket_label_workshop ?? null,
      });
    } catch {
      setRaw(null);
    } finally {
      setLoading(false);
    }
  }, [academyId]);

  useEffect(() => {
    load();
  }, [load]);

  const customLabels = raw ? { regular: raw.ticket_label_regular, popup: raw.ticket_label_popup, workshop: raw.ticket_label_workshop } : null;
  const labels: AcademyTicketLabels = {
    regular: getTicketLabel('regular', customLabels),
    popup: getTicketLabel('popup', customLabels),
    workshop: getTicketLabel('workshop', customLabels),
  };

  const getDisplayLabel = (category: TicketCategoryKey): string => labels[category];

  return {
    labels,
    raw,
    loading,
    refetch: load,
    getDisplayLabel,
    defaults: DEFAULT_TICKET_LABELS,
  };
}
