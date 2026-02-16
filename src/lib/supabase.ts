import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://kapgabgnezcurmgcrvif.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export interface GrantCall {
  id: string;
  source: string;
  source_url: string;
  call_url: string;
  title: string;
  announced_at: string | null;
  deadline_at: string | null;
  provider: string | null;
  call_type: string | null;
  total_allocation: number | null;
  eligible_applicants: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

export interface GrantAttribute {
  id: string;
  grant_call_id: string;
  key: string;
  value: string;
  value_type: string;
}

export interface GrantAttachment {
  id: string;
  grant_call_id: string;
  name: string;
  url: string;
  file_type: string | null;
}

export async function fetchCalls(): Promise<GrantCall[]> {
  const { data, error } = await supabase
    .from('grant_calls_v2')
    .select('*')
    .order('announced_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data || [];
}

export async function fetchAttributes(callId: string): Promise<GrantAttribute[]> {
  const { data, error } = await supabase
    .from('grant_call_attributes')
    .select('*')
    .eq('grant_call_id', callId);
  if (error) throw error;
  return data || [];
}

export async function fetchAttachments(callId: string): Promise<GrantAttachment[]> {
  const { data, error } = await supabase
    .from('grant_call_attachments')
    .select('*')
    .eq('grant_call_id', callId);
  if (error) throw error;
  return data || [];
}
