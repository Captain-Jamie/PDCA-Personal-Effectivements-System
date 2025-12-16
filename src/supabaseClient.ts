import { createClient } from '@supabase/supabase-js';

// 1. Try environment variables first
const envUrl = import.meta.env?.VITE_SUPABASE_URL;
const envKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

// 2. Try LocalStorage (for runtime configuration without build steps)
const localUrl = localStorage.getItem('pdca_supabase_url');
const localKey = localStorage.getItem('pdca_supabase_key');

const rawUrl = envUrl || localUrl || '';
const rawKey = envKey || localKey || '';

// 3. Safe Initialization
// Wrap in try-catch to prevent Top-Level Module Error if URL is malformed
let client = null;
try {
    if (rawUrl && rawKey && rawUrl.startsWith('http')) {
        client = createClient(rawUrl, rawKey);
    }
} catch (error) {
    console.error("Supabase client initialization failed:", error);
    // App will treat this as "not configured" allowing user to retry via UI
}

export const supabase = client;

export const isSupabaseConfigured = () => !!supabase;

// Helper to set configuration at runtime
export const setupSupabaseConnection = (url: string, key: string) => {
    if (!url || !url.startsWith('http')) {
        alert("Invalid URL. Please enter a valid Supabase URL starting with http:// or https://");
        return;
    }
    localStorage.setItem('pdca_supabase_url', url);
    localStorage.setItem('pdca_supabase_key', key);
    window.location.reload(); // Reload to initialize client
};

export const disconnectSupabaseConnection = () => {
    localStorage.removeItem('pdca_supabase_url');
    localStorage.removeItem('pdca_supabase_key');
    window.location.reload();
};