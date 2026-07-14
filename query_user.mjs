import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bjijftxksykbjknbleul.supabase.co';
const supabaseKey = 'sb_publishable_RfXOHwPhaVxfcVhVX-UzvA_2GoeqbfZ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, is_admin');
    
  console.log(JSON.stringify(data, null, 2));
  if (error) console.log('Error:', error);
}

checkUsers();
