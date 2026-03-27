import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Ini adalah "jembatan" yang akan kita pakai di seluruh aplikasi
export const supabase = createClient(supabaseUrl, supabaseKey);