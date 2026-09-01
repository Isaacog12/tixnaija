export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          city: string | null;
          is_organizer: boolean;
          bank_name: string | null;
          bank_account_number: string | null;
          bank_account_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: any;
        Update: any;
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: any;
        Update: any;
      };
      events: {
        Row: {
          id: string;
          organizer_id: string;
          title: string;
          slug: string;
          description: string | null;
          category: string;
          cover_image_url: string | null;
          venue_name: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          start_datetime: string;
          end_datetime: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: any;
        Update: any;
      };
      ticket_types: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          description: string | null;
          price_kobo: number;
          quantity_available: number;
          quantity_sold: number;
          sales_start_at: string | null;
          sales_end_at: string | null;
          max_per_order: number;
          sort_order: number;
          created_at: string;
        };
        Insert: any;
        Update: any;
      };
      promo_codes: {
        Row: {
          id: string;
          event_id: string;
          code: string;
          discount_type: string;
          discount_value: number;
          max_uses: number | null;
          times_used: number;
          expires_at: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: any;
        Update: any;
      };
      orders: {
        Row: {
          id: string;
          event_id: string;
          user_id: string | null;
          buyer_name: string;
          buyer_email: string;
          buyer_phone: string | null;
          subtotal_kobo: number;
          discount_kobo: number;
          total_kobo: number;
          promo_code_id: string | null;
          status: string;
          payment_reference: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: any;
        Update: any;
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          ticket_type_id: string;
          quantity: number;
          unit_price_kobo: number;
          created_at: string;
        };
        Insert: any;
        Update: any;
      };
      tickets: {
        Row: {
          id: string;
          order_item_id: string;
          ticket_code: string;
          attendee_name: string | null;
          attendee_email: string | null;
          status: string;
          checked_in_at: string | null;
          checked_in_by: string | null;
          created_at: string;
        };
        Insert: any;
        Update: any;
      };
      messages: {
        Row: {
          id: string;
          recipient_id: string | null;
          recipient_email: string | null;
          type: string;
          title: string;
          body: string;
          related_order_id: string | null;
          related_ticket_ids: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: any;
        Update: any;
      };
      rate_limit_log: {
        Row: {
          id: string;
          ip_address: string;
          endpoint: string;
          created_at: string;
        };
        Insert: any;
        Update: any;
      };
      contact_messages: {
        Row: {
          id: string;
          name: string;
          email: string;
          phone: string;
          topic: string | null;
          message: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: any;
        Update: any;
      };
      organizer_applications: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          phone_number: string;
          email: string;
          social_media_link: string | null;
          reason: string;
          id_photo_url: string;
          status: string;
          admin_note: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: any;
        Update: any;
      };
      sponsored_banners: {
        Row: {
          id: string;
          title: string;
          image_url: string;
          link_url: string | null;
          starts_at: string | null;
          ends_at: string | null;
          is_active: boolean | null;
          display_order: number | null;
          click_count: number | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: any;
        Update: any;
      };
      refund_requests: {
        Row: {
          id: string;
          ticket_id: string | null;
          event_id: string | null;
          buyer_email: string;
          buyer_name: string | null;
          reason: string;
          other_reason: string | null;
          status: string;
          admin_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: any;
        Update: any;
      };
      job_applications: {
        Row: {
          id: string;
          role_applied_for: string;
          full_name: string;
          email: string;
          phone_number: string;
          cover_message: string | null;
          cv_url: string;
          status: string;
          admin_note: string | null;
          created_at: string;
        };
        Insert: any;
        Update: any;
      };
      organizer_revocations: {
        Row: {
          id: string;
          user_id: string;
          revoked_by: string;
          reason: string | null;
          created_at: string;
        };
        Insert: any;
        Update: any;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
