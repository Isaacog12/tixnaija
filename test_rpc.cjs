const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bjijftxksykbjknbleul.supabase.co';
const supabaseKey = 'sb_publishable_RfXOHwPhaVxfcVhVX-UzvA_2GoeqbfZ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testRpc() {
  console.log("Calling get_ticket_by_code...");
  const { data, error } = await supabase.rpc('get_ticket_by_code', { p_ticket_code: '01e8d69c-d0fe-4660-b824-1ed666ba13df' });
  console.log("Data:", data);
  console.log("Error:", error);
}

testRpc();
