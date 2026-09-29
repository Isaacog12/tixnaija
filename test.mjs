import { readFileSync } from 'fs';
const envStr = readFileSync('.env.local', 'utf-8');
const env = envStr.split(/\r?\n/).reduce((acc, line) => {
  const i = line.indexOf('=');
  if(i > 0) acc[line.substring(0, i).trim()] = line.substring(i+1).trim().replace(/^["']|["']$/g, '');
  return acc;
}, {});
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: order, error } = await supabase.from('orders').select('id').order('created_at', { ascending: false }).limit(1).single();
  
  const res = await fetch(`${supabaseUrl}/functions/v1/send-ticket-confirmation`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ orderId: order.id })
  });
  console.log('Status:', res.status);
  console.log('Body:', await res.text());
}
test();
