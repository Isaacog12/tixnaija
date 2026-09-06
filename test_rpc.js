const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.split('VITE_SUPABASE_URL=')[1].split('\n')[0].replace(/\"/g, '').trim();
const key = env.split('SUPABASE_SERVICE_ROLE_KEY=')[1].split('\n')[0].replace(/\"/g, '').trim();

const s = createClient(url, key);

async function test() {
  const { data, error } = await s.rpc('issue_comp_tickets', {
    p_event_id: '15d3cdbc-9800-47b2-bd78-b12e3e57f23c', // dummy
    p_ticket_type_id: 'e1d2c67e-4b7f-4c91-9e73-b27bcfb92e54', // dummy
    p_recipients: []
  });
  console.log('Data:', data);
  console.log('Error:', error);
}
test();
