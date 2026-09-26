import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bjijftxksykbjknbleul.supabase.co';
const supabaseKey = 'sb_publishable_RfXOHwPhaVxfcVhVX-UzvA_2GoeqbfZ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log('Fetching events...');
  const { data: events, error: evtErr } = await supabase.from('events').select('id').limit(2);
  if (evtErr || !events || events.length < 2) {
    console.error('Error or not enough events:', evtErr);
    return;
  }
  
  let event1 = events[0].id;
  let event2 = events[1].id;

  console.log('Fetching any promoter link...');
  let { data: anyLinks, error: anyLinkErr } = await supabase.from('promoter_links').select('id, event_id').limit(1);
  let promoterLinkId;
  
  if (!anyLinks || anyLinks.length === 0) {
      console.log('No promoter link found, creating a test promoter (user) and link for event 1...');
      
      // Need a promoter user id, can just use any user or create one...
      // Or we can just insert directly into promoter_links without a promoter_id if it's not required, 
      // wait, promoter_id is usually a uuid. Let's get any user.
      const { data: users } = await supabase.from('profiles').select('id').limit(1);
      const promoterId = users && users.length > 0 ? users[0].id : null;
      
      const { data: insertedLinks, error: insertErr } = await supabase.from('promoter_links').insert([
          { event_id: event1, promoter_id: promoterId, unique_code: 'TESTCODE123', active: true }
      ]).select('id, event_id');
      
      if (insertErr) {
          console.error('Failed to create promoter link:', insertErr);
          return;
      }
      promoterLinkId = insertedLinks[0].id;
      event1 = insertedLinks[0].event_id;
  } else {
      promoterLinkId = anyLinks[0].id;
      event1 = anyLinks[0].event_id;
      const { data: otherEvents } = await supabase.from('events').select('id').neq('id', event1).limit(1);
      if (!otherEvents || otherEvents.length === 0) {
          console.log('No other events found to act as mismatched event.');
          return;
      }
      event2 = otherEvents[0].id;
  }
  
  console.log(`Using promoter_link_id: ${promoterLinkId} (belongs to event ${event1}) and mismatched event_id: ${event2}`);

  console.log('Fetching a ticket type for mismatched event...');
  const { data: ticketTypes, error: ttErr } = await supabase.from('ticket_types').select('*').eq('event_id', event2).limit(1);
  
  let ticketTypeId = null;
  let price = 0;
  if (ticketTypes && ticketTypes.length > 0) {
    ticketTypeId = ticketTypes[0].id;
    price = ticketTypes[0].price_kobo;
  } else {
    console.log('No ticket types found for event 2.');
    return;
  }

  console.log('Calling process_checkout with mismatched promoter_link_id...');
  const { data: orderId, error: rpcErr } = await supabase.rpc('process_checkout', {
    p_event_id: event2,
    p_user_id: null,
    p_buyer_name: 'Test Buyer',
    p_buyer_email: 'test@example.com',
    p_buyer_phone: '1234567890',
    p_tickets: [{ ticketTypeId, count: 1 }],
    p_amount_paid: price,
    p_payment_reference: 'test_ref_' + Date.now(),
    p_promoter_link_id: promoterLinkId
  });

  if (rpcErr) {
    console.error('RPC Error:', rpcErr);
    return;
  }

  console.log(`Order created: ${orderId}`);
  console.log('Fetching order to verify promoter_link_id...');
  
  const { data: order, error: orderErr } = await supabase.from('orders').select('id, promoter_link_id').eq('id', orderId).single();
  
  if (orderErr) {
    console.error('Error fetching order:', orderErr);
    return;
  }
  
  console.log('Order Data:', order);
  if (order.promoter_link_id === null) {
      console.log('SUCCESS: promoter_link_id was correctly set to NULL due to mismatch validation.');
  } else {
      console.log('FAILURE: promoter_link_id was NOT set to NULL.');
  }
}

verify();
