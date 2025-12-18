
import { createClient } from '@supabase/supabase-js';

const URL = 'https://twgnpcdnnvjspookgddl.supabase.co';
const KEY = 'sb_publishable_NpwxRnVR_s7xlXf4S6_KAA_qW1aUNqq';

export const supabase = createClient(URL, KEY);

export const disconnectSupabaseConnection = async () => {
    await supabase.auth.signOut();
    window.location.reload();
};
