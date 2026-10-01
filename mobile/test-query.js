const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  "https://bjijftxksykbjknbleul.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqaWpmdHhrc3lrYmprbmJsZXVsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzg3MzI1NCwiZXhwIjoyMDk5NDQ5MjU0fQ.McaETXYFLpUf-Fn_1r8QrcpRBHmR1dHa8SyjrYPz8ms"
);

async function run() {
  const { data, error } = await supabase
    .from('tickets')
    .select(`
      id, 
      ticket_code, 
      status, 
      attendee_name, 
      order_items!inner (
        ticket_types!inner (
          name,
          events!inner (
            organizer_id
          )
        )
      )
    `)
    .limit(1);
    
  console.log('Error:', error);
  console.log('Data:', JSON.stringify(data, null, 2));
}

run();
