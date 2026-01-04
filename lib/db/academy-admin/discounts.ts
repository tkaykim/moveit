import { createClient } from '@/lib/supabase/server';

export interface Discount {
  id: string;
  academy_id: string;
  name: string;
  discount_type: 'PERCENT' | 'FIXED';
  discount_value: number;
  is_active: boolean;
  valid_from?: string | null;
  valid_until?: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export async function getDiscounts(academyId: string) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('discounts')
    .select('*')
    .eq('academy_id', academyId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Discount[];
}

export async function createDiscount(discount: Omit<Discount, 'id' | 'created_at' | 'updated_at'>) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('discounts')
    .insert([discount])
    .select()
    .single();

  if (error) throw error;
  return data as Discount;
}

export async function updateDiscount(id: string, updates: Partial<Discount>) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('discounts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Discount;
}

export async function deleteDiscount(id: string) {
  const supabase = await createClient() as any;
  const { error } = await supabase
    .from('discounts')
    .delete()
    .eq('id', id);

  if (error) throw error;
}








