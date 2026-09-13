const fs = require('fs');
let content = fs.readFileSync('src/integrations/supabase/types.ts', 'utf8');

if (!content.includes('waitlist_entries: {')) {
  content = content.replace('ticket_types: {', `event_series: {
        Row: {
          id: string
          organizer_id: string
          title: string
          recurrence_rule: string
          created_at: string
        }
        Insert: {
          id?: string
          organizer_id: string
          title: string
          recurrence_rule: string
          created_at?: string
        }
        Update: {
          id?: string
          organizer_id?: string
          title?: string
          recurrence_rule?: string
          created_at?: string
        }
        Relationships: []
      }
      waitlist_entries: {
        Row: {
          id: string
          event_id: string
          ticket_tier_id: string | null
          name: string
          email: string
          status: 'waiting' | 'notified'
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          ticket_tier_id?: string | null
          name: string
          email: string
          status?: 'waiting' | 'notified'
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          ticket_tier_id?: string | null
          name?: string
          email?: string
          status?: 'waiting' | 'notified'
          created_at?: string
        }
        Relationships: []
      }
      ticket_types: {`);
}

if (!content.includes('series_id: string | null')) {
  content = content.replace(/Row: \{\s+address/g, 'Row: {\n          series_id: string | null\n          address');
  content = content.replace(/Insert: \{\s+address/g, 'Insert: {\n          series_id?: string | null\n          address');
  content = content.replace(/Update: \{\s+address/g, 'Update: {\n          series_id?: string | null\n          address');
}

if (!content.includes('quantity_cancelled: number')) {
  content = content.replace(/quantity_available: number/g, 'quantity_available: number\n          quantity_cancelled: number');
  content = content.replace(/quantity_available\?: number/g, 'quantity_available?: number\n          quantity_cancelled?: number');
}

if (!content.includes('create_event_series: {')) {
  content = content.replace('validate_promo_code: {', `create_event_series: {
        Args: {
          p_title: string
          p_recurrence_rule: string
        }
        Returns: string
      }
      validate_promo_code: {`);
}

fs.writeFileSync('src/integrations/supabase/types.ts', content);
console.log('patched');
