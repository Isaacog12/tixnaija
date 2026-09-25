import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Database } from './types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  const missing = [
    ...(!supabaseUrl ? ['EXPO_PUBLIC_SUPABASE_URL'] : []),
    ...(!supabaseAnonKey ? ['EXPO_PUBLIC_SUPABASE_ANON_KEY'] : []),
  ];
  const message = `Missing Supabase environment variable(s): ${missing.join(', ')}.`;
  console.error(`[Supabase] ${message}`);
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
