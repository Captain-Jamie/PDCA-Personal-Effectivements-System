import { createClient } from '@supabase/supabase-js';

// 1. Try environment variables first
const envUrl = import.meta.env?.VITE_SUPABASE_URL;
const envKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

// 2. Try LocalStorage (for runtime configuration without build steps)
const localUrl = localStorage.getItem('pdca_supabase_url');
const localKey = localStorage.getItem('pdca_supabase_key');

const supabaseUrl = envUrl || localUrl || '';
const supabaseAnonKey = envKey || localKey || '';

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

export const isSupabaseConfigured = () => !!supabase;

// Helper to set configuration at runtime
export const setupSupabaseConnection = (url: string, key: string) => {
    localStorage.setItem('pdca_supabase_url', url);
    localStorage.setItem('pdca_supabase_key', key);
    window.location.reload(); // Reload to initialize client
};

export const disconnectSupabaseConnection = () => {
    localStorage.removeItem('pdca_supabase_url');
    localStorage.removeItem('pdca_supabase_key');
    window.location.reload();
};