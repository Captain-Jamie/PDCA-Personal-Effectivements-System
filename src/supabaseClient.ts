import { createClient } from '@supabase/supabase-js';

// =================================================================
// 数据库配置区域 (如果未使用 .env 文件，请直接在此处填入)
// =================================================================
const MANUAL_URL = 'https://twgnpcdnnvjspookgddl.supabase.co'; // 例如: 'https://xyz.supabase.co'
const MANUAL_KEY = 'sb_publishable_NpwxRnVR_s7xlXf4S6_KAA_qW1aUNqq'; // 例如: 'eyJhbGciOiJIUzI1NiIsIn...'
// =================================================================

// Storage Keys for runtime configuration
const LS_URL_KEY = 'pdca_sb_url';
const LS_ANON_KEY = 'pdca_sb_key';

// 1. Try environment variables first (Vite default)
const envUrl = import.meta.env?.VITE_SUPABASE_URL;
const envKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

// 2. Try Local Storage (Runtime Config)
const localUrl = localStorage.getItem(LS_URL_KEY);
const localKey = localStorage.getItem(LS_ANON_KEY);

// 3. Determine Final Config
const rawUrl = envUrl || MANUAL_URL || localUrl || '';
const rawKey = envKey || MANUAL_KEY || localKey || '';

// 4. Safe Initialization
let client = null;
try {
    if (rawUrl && rawKey && rawUrl.startsWith('http')) {
        client = createClient(rawUrl, rawKey);
        console.log("Supabase client initialized successfully.");
    }
} catch (error) {
    console.error("Supabase client initialization failed:", error);
}

export const supabase = client;

export const isSupabaseConfigured = () => !!supabase;

export const setupSupabaseConnection = (url: string, key: string) => {
    localStorage.setItem(LS_URL_KEY, url);
    localStorage.setItem(LS_ANON_KEY, key);
    window.location.reload();
};

// Helper to disconnect (clears local auth session mostly)
export const disconnectSupabaseConnection = async () => {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem(LS_URL_KEY);
    localStorage.removeItem(LS_ANON_KEY);
    window.location.reload();
};
