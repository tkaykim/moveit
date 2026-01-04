import { createClient } from '@/lib/supabase/server';

export interface RevenueTransaction {
  id: string;
  academy_id: string;
  user_id: string;
  ticket_id?: string | null;
  user_ticket_id?: string | null;
  discount_id?: string | null;
  original_price: number;
  discount_amount: number;
  final_price: number;
  payment_method?: string | null;
  payment_status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  transaction_date: string;
  notes?: string | null;
  created_at: string;
}

export async function getRevenueTransactions(academyId: string, startDate?: string, endDate?: string) {
  const supabase = await createClient() as any;
  let query = supabase
    .from('revenue_transactions')
    .select(`
      *,
      users (
        id,
        name,
        phone
      ),
      tickets (
        id,
        name,
        ticket_type
      ),
      discounts (
        id,
        name
      )
    `)
    .eq('academy_id', academyId)
    .eq('payment_status', 'COMPLETED');

  if (startDate) {
    query = query.gte('transaction_date', startDate);
  }
  if (endDate) {
    query = query.lte('transaction_date', endDate);
  }

  const { data, error } = await query.order('transaction_date', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getRevenueStats(academyId: string, startDate?: string, endDate?: string) {
  const supabase = await createClient() as any;
  let query = supabase
    .from('revenue_transactions')
    .select('final_price, discount_amount, original_price')
    .eq('academy_id', academyId)
    .eq('payment_status', 'COMPLETED');

  if (startDate) {
    query = query.gte('transaction_date', startDate);
  }
  if (endDate) {
    query = query.lte('transaction_date', endDate);
  }

  const { data, error } = await query;

  if (error) throw error;

  const totalRevenue = data.reduce((sum: number, t: any) => sum + (t.final_price || 0), 0);
  const totalDiscount = data.reduce((sum: number, t: any) => sum + (t.discount_amount || 0), 0);
  const totalOriginal = data.reduce((sum: number, t: any) => sum + (t.original_price || 0), 0);

  return {
    totalRevenue,
    totalDiscount,
    totalOriginal,
    transactionCount: data.length,
  };
}

export async function createRevenueTransaction(transaction: Omit<RevenueTransaction, 'id' | 'created_at'>) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('revenue_transactions')
    .insert([transaction])
    .select()
    .single();

  if (error) throw error;
  return data as RevenueTransaction;
}




