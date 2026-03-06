"use client";

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import {
  DEFAULT_TICKET_LABELS,
  DEFAULT_TICKET_DESCRIPTIONS,
  getTicketLabel,
  getTicketDescription,
  type TicketCategoryKey,
} from '@/lib/constants/ticket-labels';

export interface AcademyTicketLabels {
  regular: string;
  popup: string;
  workshop: string;
}

export interface AcademyTicketDescriptions {
  regular: string;
  popup: string;
  workshop: string;
}

export interface RawAcademyLabels {
  ticket_label_regular: string | null;
  ticket_label_popup: string | null;
  ticket_label_workshop: string | null;
  ticket_description_regular?: string | null;
  ticket_description_popup?: string | null;
  ticket_description_workshop?: string | null;
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
        .select('ticket_label_regular, ticket_label_popup, ticket_label_workshop, ticket_description_regular, ticket_description_popup, ticket_description_workshop')
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
        ticket_description_regular: data?.ticket_description_regular ?? null,
        ticket_description_popup: data?.ticket_description_popup ?? null,
        ticket_description_workshop: data?.ticket_description_workshop ?? null,
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
  const customDescriptions = raw
    ? { regular: raw.ticket_description_regular, popup: raw.ticket_description_popup, workshop: raw.ticket_description_workshop }
    : null;
  const descriptions: AcademyTicketDescriptions = {
    regular: customDescriptions?.regular?.trim()
      ? customDescriptions.regular
      : `${labels.regular}. ${getTicketDescription('regular', customDescriptions)}`,
    popup: customDescriptions?.popup?.trim()
      ? customDescriptions.popup
      : `${labels.popup}. ${getTicketDescription('popup', customDescriptions)}`,
    workshop: customDescriptions?.workshop?.trim()
      ? customDescriptions.workshop
      : `${labels.workshop}. ${getTicketDescription('workshop', customDescriptions)}`,
  };

  const getDisplayLabel = (category: TicketCategoryKey): string => labels[category];
  const getDisplayDescription = (category: TicketCategoryKey): string => descriptions[category];

  return {
    labels,
    descriptions,
    raw,
    loading,
    refetch: load,
    getDisplayLabel,
    getDisplayDescription,
    defaults: DEFAULT_TICKET_LABELS,
  };
}
