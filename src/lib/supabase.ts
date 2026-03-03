import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://kapgabgnezcurmgcrvif.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export interface GrantCall {
  id: string | number;
  source: string;
  source_url: string;
  call_url: string;
  title: string;
  announced_at: string | null;
  deadline_at: string | null;
  provider: string | null;
  call_type: string | null;
  total_allocation: string | null;
  status: string | null;
  closed_at: string | null;
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
  // Default: show only active calls (exclude closed/cancelled)
  const { data, error } = await supabase
    .from('grant_calls_v2')
    .select('*')
    .in('status', ['Otvorená', 'Vyhlásená', 'Plánovaná', 'otvorená', 'vyhlásená', 'plánovaná'])
    .order('announced_at', { ascending: false, nullsFirst: false });
  
  if (error) throw error;
  return data || [];
}

export async function fetchAllCalls(): Promise<GrantCall[]> {
  // For admin view: show all calls including closed
  const { data, error } = await supabase
    .from('grant_calls_v2')
    .select('*')
    .order('announced_at', { ascending: false, nullsFirst: false });
  
  if (error) throw error;
  return data || [];
}

export async function fetchCallById(callId: string | number): Promise<GrantCall | null> {
  const { data, error } = await supabase
    .from('grant_calls_v2')
    .select('*')
    .eq('id', callId)
    .maybeSingle();
  if (error) {
    console.error('[fetchCallById] Error:', error.message);
    return null;
  }
  return data;
}

export async function fetchAttributes(callId: string | number): Promise<GrantAttribute[]> {
  // Try grant_call_attributes first; table may not exist in some deployments
  const { data, error } = await supabase
    .from('grant_call_attributes')
    .select('*')
    .eq('grant_call_id', callId);
  if (error) {
    // Table doesn't exist (PGRST205) or other error — return empty gracefully
    console.warn('[fetchAttributes] Attributes not available:', error.message);
    return [];
  }
  return data || [];
}

export async function fetchAttachments(callId: string | number): Promise<GrantAttachment[]> {
  const { data, error } = await supabase
    .from('grant_call_attachments')
    .select('*')
    .eq('grant_call_id', callId);
  if (error) {
    console.warn('[fetchAttachments] Error fetching attachments:', error.message);
    return [];
  }
  return data || [];
}
