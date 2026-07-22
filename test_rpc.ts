import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function test() {
  const { data, error } = await supabase.rpc('admin_update_job_application', {
    p_id: '00000000-0000-0000-0000-000000000000',
    p_status: 'reviewed',
    p_admin_note: null
  });
  console.log('Error:', error);
}

test();
