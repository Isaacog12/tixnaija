export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_version: {
        Row: {
          apk_url: string
          created_at: string
          id: string
          release_notes: string | null
          version: string
        }
        Insert: {
          apk_url: string
          created_at?: string
          id?: string
          release_notes?: string | null
          version: string
        }
        Update: {
          apk_url?: string
          created_at?: string
          id?: string
          release_notes?: string | null
          version?: string
        }
        Relationships: []
      }
      checkout_questions: {
        Row: {
          created_at: string
          event_id: string
          id: string
          options: Json | null
          position: number
          question_text: string
          required: boolean
          type: Database["public"]["Enums"]["checkout_question_type"]
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          options?: Json | null
          position?: number
          question_text: string
          required?: boolean
          type?: Database["public"]["Enums"]["checkout_question_type"]
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          options?: Json | null
          position?: number
          question_text?: string
          required?: boolean
          type?: Database["public"]["Enums"]["checkout_question_type"]
        }
        Relationships: [
          {
            foreignKeyName: "checkout_questions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          is_read: boolean
          message: string
          name: string
          phone: string
          topic: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_read?: boolean
          message: string
          name: string
          phone: string
          topic?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_read?: boolean
          message?: string
          name?: string
          phone?: string
          topic?: string | null
        }
        Relationships: []
      }
      email_outbox: {
        Row: {
          case_id: string | null
          claimed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          idempotency_key: string | null
          order_id: string | null
          payload: Json
          recipient_email: string
          retry_count: number
          sent_at: string | null
          status: string
          template: string
        }
        Insert: {
          case_id?: string | null
          claimed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          order_id?: string | null
          payload?: Json
          recipient_email: string
          retry_count?: number
          sent_at?: string | null
          status?: string
          template: string
        }
        Update: {
          case_id?: string | null
          claimed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          order_id?: string | null
          payload?: Json
          recipient_email?: string
          retry_count?: number
          sent_at?: string | null
          status?: string
          template?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "support_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_outbox_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      email_delivery_log: {
        Row: {
          claimed_at: string
          delivery_key: string
          last_error: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          claimed_at?: string
          delivery_key: string
          last_error?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          claimed_at?: string
          delivery_key?: string
          last_error?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: []
      }
      event_broadcasts: {
        Row: {
          created_at: string
          event_id: string
          id: string
          message: string
          organizer_id: string
          recipient_count: number | null
          subject: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          message: string
          organizer_id: string
          recipient_count?: number | null
          subject: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          message?: string
          organizer_id?: string
          recipient_count?: number | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_broadcasts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_broadcasts_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_broadcasts_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "public_organizer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_page_views: {
        Row: {
          created_at: string
          event_id: string
          id: string
          viewer_ip: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          viewer_ip?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          viewer_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_page_views_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reminders_log: {
        Row: {
          event_id: string
          id: string
          recipient_email: string
          reminder_type: string
          sent_at: string
        }
        Insert: {
          event_id: string
          id?: string
          recipient_email: string
          reminder_type: string
          sent_at?: string
        }
        Update: {
          event_id?: string
          id?: string
          recipient_email?: string
          reminder_type?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reminders_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_series: {
        Row: {
          created_at: string
          id: string
          organizer_id: string
          recurrence_rule: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          organizer_id: string
          recurrence_rule: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          organizer_id?: string
          recurrence_rule?: string
          title?: string
        }
        Relationships: []
      }
      event_staff: {
        Row: {
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_staff_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address: string | null
          admin_cancelled: boolean
          cancelled_at: string | null
          category: Database["public"]["Enums"]["event_category"]
          city: string | null
          cover_image_url: string | null
          created_at: string
          custom_order_confirmation: string | null
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          description: string | null
          end_datetime: string
          id: string
          organizer_id: string
          organizer_note: string | null
          postponed_at: string | null
          series_id: string | null
          slug: string
          start_datetime: string
          state: string | null
          status: Database["public"]["Enums"]["event_status"]
          tags: string[] | null
          theme_color: string | null
          title: string
          updated_at: string
          venue_name: string | null
        }
        Insert: {
          address?: string | null
          admin_cancelled?: boolean
          cancelled_at?: string | null
          category?: Database["public"]["Enums"]["event_category"]
          city?: string | null
          cover_image_url?: string | null
          created_at?: string
          custom_order_confirmation?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          description?: string | null
          end_datetime: string
          id?: string
          organizer_id: string
          organizer_note?: string | null
          postponed_at?: string | null
          series_id?: string | null
          slug: string
          start_datetime: string
          state?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          tags?: string[] | null
          theme_color?: string | null
          title: string
          updated_at?: string
          venue_name?: string | null
        }
        Update: {
          address?: string | null
          admin_cancelled?: boolean
          cancelled_at?: string | null
          category?: Database["public"]["Enums"]["event_category"]
          city?: string | null
          cover_image_url?: string | null
          created_at?: string
          custom_order_confirmation?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          description?: string | null
          end_datetime?: string
          id?: string
          organizer_id?: string
          organizer_note?: string | null
          postponed_at?: string | null
          series_id?: string | null
          slug?: string
          start_datetime?: string
          state?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          tags?: string[] | null
          theme_color?: string | null
          title?: string
          updated_at?: string
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "public_organizer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "event_series"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          admin_note: string | null
          cover_message: string | null
          created_at: string
          cv_url: string
          email: string
          full_name: string
          id: string
          phone_number: string
          role_applied_for: string
          status: Database["public"]["Enums"]["job_application_status"]
        }
        Insert: {
          admin_note?: string | null
          cover_message?: string | null
          created_at?: string
          cv_url: string
          email: string
          full_name: string
          id?: string
          phone_number: string
          role_applied_for: string
          status?: Database["public"]["Enums"]["job_application_status"]
        }
        Update: {
          admin_note?: string | null
          cover_message?: string | null
          created_at?: string
          cv_url?: string
          email?: string
          full_name?: string
          id?: string
          phone_number?: string
          role_applied_for?: string
          status?: Database["public"]["Enums"]["job_application_status"]
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          is_read: boolean
          recipient_email: string | null
          recipient_id: string | null
          related_order_id: string | null
          related_ticket_ids: string[] | null
          title: string
          type: Database["public"]["Enums"]["message_type"]
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_email?: string | null
          recipient_id?: string | null
          related_order_id?: string | null
          related_ticket_ids?: string[] | null
          title: string
          type: Database["public"]["Enums"]["message_type"]
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_email?: string | null
          recipient_id?: string | null
          related_order_id?: string | null
          related_ticket_ids?: string[] | null
          title?: string
          type?: Database["public"]["Enums"]["message_type"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          quantity: number
          ticket_type_id: string
          unit_price_kobo: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          quantity: number
          ticket_type_id: string
          unit_price_kobo: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          quantity?: number
          ticket_type_id?: string
          unit_price_kobo?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          access_code: string | null
          buyer_email: string
          buyer_name: string
          buyer_phone: string | null
          checkout_answers: Json | null
          created_at: string
          discount_kobo: number
          event_id: string
          gift_message: string | null
          id: string
          is_gift: boolean
          payment_reference: string | null
          promo_code_id: string | null
          promoter_link_id: string | null
          recipient_email: string | null
          recipient_name: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal_kobo: number
          total_kobo: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_code?: string | null
          buyer_email: string
          buyer_name: string
          buyer_phone?: string | null
          checkout_answers?: Json | null
          created_at?: string
          discount_kobo?: number
          event_id: string
          gift_message?: string | null
          id?: string
          is_gift?: boolean
          payment_reference?: string | null
          promo_code_id?: string | null
          promoter_link_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_kobo?: number
          total_kobo?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_code?: string | null
          buyer_email?: string
          buyer_name?: string
          buyer_phone?: string | null
          checkout_answers?: Json | null
          created_at?: string
          discount_kobo?: number
          event_id?: string
          gift_message?: string | null
          id?: string
          is_gift?: boolean
          payment_reference?: string | null
          promo_code_id?: string | null
          promoter_link_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_kobo?: number
          total_kobo?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_promoter_link_id_fkey"
            columns: ["promoter_link_id"]
            isOneToOne: false
            referencedRelation: "promoter_links"
            referencedColumns: ["id"]
          },
        ]
      }
      organizer_applications: {
        Row: {
          admin_note: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          id_photo_url: string
          phone_number: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          social_media_link: string | null
          status: Database["public"]["Enums"]["application_status"]
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          id_photo_url: string
          phone_number: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_media_link?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          id_photo_url?: string
          phone_number?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_media_link?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizer_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_organizer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_organizer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizer_revocations: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          revoked_by: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          revoked_by: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          revoked_by?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizer_revocations_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_revocations_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "public_organizer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_revocations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_revocations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_organizer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          amount_kobo: number
          channel: string | null
          created_at: string
          customer_email: string | null
          event_type: string
          id: string
          matched_order_id: string | null
          metadata: Json | null
          raw_payload: Json | null
          reference: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          amount_kobo: number
          channel?: string | null
          created_at?: string
          customer_email?: string | null
          event_type: string
          id?: string
          matched_order_id?: string | null
          metadata?: Json | null
          raw_payload?: Json | null
          reference: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status: string
        }
        Update: {
          amount_kobo?: number
          channel?: string | null
          created_at?: string
          customer_email?: string | null
          event_type?: string
          id?: string
          matched_order_id?: string | null
          metadata?: Json | null
          raw_payload?: Json | null
          reference?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_matched_order_id_fkey"
            columns: ["matched_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          banner_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          expo_push_token: string | null
          full_name: string | null
          id: string
          is_admin: boolean | null
          is_organizer: boolean
          is_public: boolean | null
          is_verified_organizer: boolean | null
          notification_preferences: Json | null
          organizer_slug: string | null
          paystack_subaccount_code: string | null
          phone: string | null
          subaccount_created_at: string | null
          suspended: boolean
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          expo_push_token?: string | null
          full_name?: string | null
          id: string
          is_admin?: boolean | null
          is_organizer?: boolean
          is_public?: boolean | null
          is_verified_organizer?: boolean | null
          notification_preferences?: Json | null
          organizer_slug?: string | null
          paystack_subaccount_code?: string | null
          phone?: string | null
          subaccount_created_at?: string | null
          suspended?: boolean
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          expo_push_token?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          is_organizer?: boolean
          is_public?: boolean | null
          is_verified_organizer?: boolean | null
          notification_preferences?: Json | null
          organizer_slug?: string | null
          paystack_subaccount_code?: string | null
          phone?: string | null
          subaccount_created_at?: string | null
          suspended?: boolean
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          event_id: string
          expires_at: string | null
          id: string
          max_uses: number | null
          times_used: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          event_id: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          times_used?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          event_id?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          times_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "promo_codes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      promoter_links: {
        Row: {
          active: boolean
          created_at: string
          event_id: string
          id: string
          promoter_id: string
          ticket_type_id: string | null
          unique_code: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          event_id: string
          id?: string
          promoter_id: string
          ticket_type_id?: string | null
          unique_code: string
        }
        Update: {
          active?: boolean
          created_at?: string
          event_id?: string
          id?: string
          promoter_id?: string
          ticket_type_id?: string | null
          unique_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "promoter_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promoter_links_promoter_id_fkey"
            columns: ["promoter_id"]
            isOneToOne: false
            referencedRelation: "promoters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promoter_links_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      promoters: {
        Row: {
          contact_info: string | null
          created_at: string
          event_id: string
          id: string
          name: string
        }
        Insert: {
          contact_info?: string | null
          created_at?: string
          event_id: string
          id?: string
          name: string
        }
        Update: {
          contact_info?: string | null
          created_at?: string
          event_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "promoters_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_log: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          ip_address: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          ip_address: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          ip_address?: string
        }
        Relationships: []
      }
      refund_requests: {
        Row: {
          admin_note: string | null
          buyer_email: string
          buyer_name: string | null
          created_at: string
          event_id: string | null
          id: string
          other_reason: string | null
          reason: string
          status: string
          ticket_id: string | null
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          buyer_email: string
          buyer_name?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          other_reason?: string | null
          reason: string
          status?: string
          ticket_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          buyer_email?: string
          buyer_name?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          other_reason?: string | null
          reason?: string
          status?: string
          ticket_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_requests_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsored_banners: {
        Row: {
          click_count: number | null
          created_at: string | null
          display_order: number | null
          ends_at: string | null
          id: string
          image_url: string
          is_active: boolean | null
          link_url: string | null
          starts_at: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          click_count?: number | null
          created_at?: string | null
          display_order?: number | null
          ends_at?: string | null
          id?: string
          image_url: string
          is_active?: boolean | null
          link_url?: string | null
          starts_at?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          click_count?: number | null
          created_at?: string | null
          display_order?: number | null
          ends_at?: string | null
          id?: string
          image_url?: string
          is_active?: boolean | null
          link_url?: string | null
          starts_at?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      support_audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      support_bot_queries: {
        Row: {
          created_at: string
          escalated: boolean
          id: string
          matched_intent: string | null
          message: string
          session_id: string
        }
        Insert: {
          created_at?: string
          escalated?: boolean
          id?: string
          matched_intent?: string | null
          message: string
          session_id: string
        }
        Update: {
          created_at?: string
          escalated?: boolean
          id?: string
          matched_intent?: string | null
          message?: string
          session_id?: string
        }
        Relationships: []
      }
      support_case_messages: {
        Row: {
          case_id: string
          content: string
          created_at: string
          id: string
          is_internal: boolean
          sender_id: string
        }
        Insert: {
          case_id: string
          content: string
          created_at?: string
          id?: string
          is_internal?: boolean
          sender_id: string
        }
        Update: {
          case_id?: string
          content?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_case_messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "support_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      support_cases: {
        Row: {
          assigned_to: string | null
          case_number: string
          category: Database["public"]["Enums"]["support_case_category"]
          created_at: string
          csat_comment: string | null
          csat_rating: number | null
          csat_submitted_at: string | null
          csat_token: string
          customer_id: string | null
          due_at: string | null
          escalated_at: string | null
          escalated_reason: string | null
          first_response_at: string | null
          guest_email: string | null
          guest_message: string | null
          id: string
          is_escalated: boolean
          order_id: string | null
          priority: Database["public"]["Enums"]["support_case_priority"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["support_case_status"]
          subject: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          case_number?: string
          category?: Database["public"]["Enums"]["support_case_category"]
          created_at?: string
          csat_comment?: string | null
          csat_rating?: number | null
          csat_submitted_at?: string | null
          csat_token?: string
          customer_id?: string | null
          due_at?: string | null
          escalated_at?: string | null
          escalated_reason?: string | null
          first_response_at?: string | null
          guest_email?: string | null
          guest_message?: string | null
          id?: string
          is_escalated?: boolean
          order_id?: string | null
          priority?: Database["public"]["Enums"]["support_case_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_case_status"]
          subject: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          case_number?: string
          category?: Database["public"]["Enums"]["support_case_category"]
          created_at?: string
          csat_comment?: string | null
          csat_rating?: number | null
          csat_submitted_at?: string | null
          csat_token?: string
          customer_id?: string | null
          due_at?: string | null
          escalated_at?: string | null
          escalated_reason?: string | null
          first_response_at?: string | null
          guest_email?: string | null
          guest_message?: string | null
          id?: string
          is_escalated?: boolean
          order_id?: string | null
          priority?: Database["public"]["Enums"]["support_case_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_case_status"]
          subject?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_cases_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      support_email_change_requests: {
        Row: {
          created_at: string
          id: string
          new_email: string
          old_email: string
          order_id: string
          reason: string
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          new_email: string
          old_email: string
          order_id: string
          reason: string
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          new_email?: string
          old_email?: string
          order_id?: string
          reason?: string
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_email_change_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      support_macros: {
        Row: {
          category: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          title: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      support_notes: {
        Row: {
          author_id: string
          created_at: string
          id: string
          note: string
          target_id: string
          target_type: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          note: string
          target_id: string
          target_type: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          note?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      ticket_types: {
        Row: {
          created_at: string
          description: string | null
          event_id: string
          id: string
          max_per_order: number
          name: string
          price_kobo: number
          quantity_available: number
          quantity_cancelled: number
          quantity_sold: number
          sales_end_at: string | null
          sales_start_at: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          max_per_order?: number
          name: string
          price_kobo?: number
          quantity_available: number
          quantity_cancelled?: number
          quantity_sold?: number
          sales_end_at?: string | null
          sales_start_at?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          max_per_order?: number
          name?: string
          price_kobo?: number
          quantity_available?: number
          quantity_cancelled?: number
          quantity_sold?: number
          sales_end_at?: string | null
          sales_start_at?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "ticket_types_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          attendee_email: string | null
          attendee_name: string | null
          checked_in_at: string | null
          checked_in_by: string | null
          checkout_answers: Json | null
          created_at: string
          id: string
          order_item_id: string
          status: Database["public"]["Enums"]["ticket_status"]
          ticket_code: string
        }
        Insert: {
          attendee_email?: string | null
          attendee_name?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          checkout_answers?: Json | null
          created_at?: string
          id?: string
          order_item_id: string
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_code?: string
        }
        Update: {
          attendee_email?: string | null
          attendee_name?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          checkout_answers?: Json | null
          created_at?: string
          id?: string
          order_item_id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_contacts: {
        Row: {
          created_at: string
          email: string
          phone_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          phone_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          phone_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waitlist_entries: {
        Row: {
          created_at: string
          email: string
          event_id: string
          id: string
          name: string
          notified_at: string | null
          status: string
          ticket_tier_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          event_id: string
          id?: string
          name: string
          notified_at?: string | null
          status?: string
          ticket_tier_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          event_id?: string
          id?: string
          name?: string
          notified_at?: string | null
          status?: string
          ticket_tier_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_ticket_tier_id_fkey"
            columns: ["ticket_tier_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_organizer_profiles: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          full_name: string | null
          id: string | null
          is_verified_organizer: boolean | null
          organizer_slug: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          full_name?: string | null
          id?: string | null
          is_verified_organizer?: boolean | null
          organizer_slug?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          full_name?: string | null
          id?: string | null
          is_verified_organizer?: boolean | null
          organizer_slug?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_approve_recipient_change: {
        Args: { p_request_id: string }
        Returns: Json
      }
      admin_cancel_event: {
        Args: { p_event_id: string; p_note: string }
        Returns: undefined
      }
      admin_delete_event: {
        Args: { p_event_id: string; p_mode: string; p_note?: string }
        Returns: Json
      }
      admin_delete_job_application: {
        Args: { p_id: string }
        Returns: undefined
      }
      admin_event_deletion_preview: {
        Args: { p_event_id: string }
        Returns: Json
      }
      admin_get_job_applications: {
        Args: never
        Returns: {
          admin_note: string
          cover_message: string
          created_at: string
          cv_url: string
          email: string
          full_name: string
          id: string
          is_registered_user: boolean
          phone_number: string
          role_applied_for: string
          status: Database["public"]["Enums"]["job_application_status"]
        }[]
      }
      admin_manage_macro: {
        Args: {
          p_action: string
          p_category?: string
          p_content?: string
          p_id?: string
          p_title?: string
        }
        Returns: Json
      }
      admin_resolve_payment: {
        Args: {
          p_matched_order_id?: string
          p_payment_event_id: string
          p_resolution_note?: string
        }
        Returns: Json
      }
      admin_review_email_change: {
        Args: { p_approve: boolean; p_request_id: string }
        Returns: Json
      }
      admin_revoke_organizer: {
        Args: { p_reason: string; p_user_id: string }
        Returns: undefined
      }
      admin_revoke_organizer_by_email: {
        Args: { p_email: string; p_reason?: string }
        Returns: undefined
      }
      admin_set_customer_care_role: {
        Args: { p_grant: boolean; p_user_id: string }
        Returns: Json
      }
      admin_suspend_user: {
        Args: { p_suspended: boolean; p_user_id: string }
        Returns: undefined
      }
      admin_undo_cancel_event: {
        Args: { p_event_id: string; p_note: string }
        Returns: undefined
      }
      admin_update_job_application: {
        Args: { p_admin_note: string; p_id: string; p_status: string }
        Returns: undefined
      }
      admin_verify_organizer: {
        Args: { p_user_id: string; p_verified: boolean }
        Returns: undefined
      }
      anonymize_deleted_user_profile: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      approve_organizer_application: {
        Args: { p_application_id: string; p_note?: string }
        Returns: undefined
      }
      bulk_sync_offline_checkins: {
        Args: { p_event_id: string; p_scans: Json }
        Returns: Json
      }
      cancel_event: {
        Args: { p_event_id: string; p_note: string }
        Returns: undefined
      }
      cancel_ticket: { Args: { p_ticket_id: string }; Returns: undefined }
      check_in_ticket:
        | { Args: { p_event_id: string; p_ticket_code: string }; Returns: Json }
        | { Args: { p_event_id: string; p_ticket_code: string }; Returns: Json }
      check_user_notification_pref: {
        Args: { p_email: string; p_pref_key: string }
        Returns: boolean
      }
      claim_email_outbox_batch: {
        Args: { p_batch_size?: number }
        Returns: {
          case_id: string | null
          claimed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          idempotency_key: string | null
          order_id: string | null
          payload: Json
          recipient_email: string
          retry_count: number
          sent_at: string | null
          status: string
          template: string
        }[]
        SetofOptions: {
          from: "*"
          to: "email_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_email_delivery: {
        Args: { p_delivery_key: string }
        Returns: string
      }
      claim_guest_messages: { Args: never; Returns: undefined }
      complete_email_delivery: {
        Args: { p_delivery_key: string; p_error?: string; p_success: boolean }
        Returns: undefined
      }
      create_event_series: {
        Args: { p_recurrence_rule: string; p_title: string }
        Returns: string
      }
      current_user_is_active: { Args: never; Returns: boolean }
      delete_user_account: { Args: never; Returns: undefined }
      get_event_attendees: { Args: { p_event_id: string }; Returns: Json }
      get_expired_id_photos_for_cleanup: {
        Args: { p_retention_days?: number }
        Returns: {
          application_id: string
          id_photo_path: string
        }[]
      }
      get_guest_order_full: {
        Args: { p_email: string; p_order_id: string }
        Returns: Json
      }
      get_guest_orders: {
        Args: { p_access_code: string; p_email: string }
        Returns: {
          buyer_email: string
          buyer_name: string
          created_at: string
          event_city: string
          event_cover: string
          event_id: string
          event_slug: string
          event_start: string
          event_title: string
          id: string
          status: string
          total_kobo: number
        }[]
      }
      get_guest_tickets:
        | {
            Args: { p_email: string; p_order_id: string }
            Returns: {
              attendee_name: string
              id: string
              status: string
              ticket_type_name: string
              ticket_type_price: number
            }[]
          }
        | {
            Args: { p_access_code: string; p_email: string; p_order_id: string }
            Returns: {
              attendee_email: string
              attendee_name: string
              id: string
              price_kobo: number
              status: string
              ticket_code: string
              ticket_type: string
            }[]
          }
      get_ticket_by_code: { Args: { p_ticket_code: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_banner_click: {
        Args: { banner_id: string }
        Returns: undefined
      }
      issue_comp_tickets: {
        Args: {
          p_event_id: string
          p_recipients: Json[]
          p_ticket_type_id: string
        }
        Returns: string
      }
      mark_id_photos_deleted: {
        Args: { p_application_ids: string[] }
        Returns: undefined
      }
      open_support_case: {
        Args: {
          p_category: Database["public"]["Enums"]["support_case_category"]
          p_description: string
          p_order_id?: string
          p_subject: string
        }
        Returns: Json
      }
      postpone_event: {
        Args: {
          p_event_id: string
          p_new_end: string
          p_new_start: string
          p_note: string
        }
        Returns: undefined
      }
      process_checkout: {
        Args: {
          p_access_code?: string
          p_amount_paid: number
          p_buyer_email: string
          p_buyer_name: string
          p_buyer_phone: string
          p_checkout_answers?: Json
          p_event_id: string
          p_gift_message?: string
          p_is_gift?: boolean
          p_payment_reference: string
          p_promo_code_id?: string
          p_promoter_link_id?: string
          p_recipient_email?: string
          p_recipient_name?: string
          p_tickets: Json
          p_user_id: string
        }
        Returns: string
      }
      process_free_checkout: {
        Args: {
          p_access_code?: string
          p_buyer_email: string
          p_buyer_name: string
          p_buyer_phone: string
          p_checkout_answers?: Json
          p_event_id: string
          p_gift_message?: string
          p_is_gift?: boolean
          p_promo_code_id?: string
          p_promoter_link_id?: string
          p_recipient_email?: string
          p_recipient_name?: string
          p_tickets: Json
          p_user_id: string
        }
        Returns: string
      }
      reject_organizer_application: {
        Args: { p_application_id: string; p_note?: string }
        Returns: undefined
      }
      set_organizer_status: { Args: { is_org: boolean }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      support_add_order_note: {
        Args: { p_note: string; p_order_id: string }
        Returns: Json
      }
      support_create_case: {
        Args: {
          p_category?: Database["public"]["Enums"]["support_case_category"]
          p_customer_email?: string
          p_customer_id?: string
          p_initial_message?: string
          p_order_id?: string
          p_priority?: Database["public"]["Enums"]["support_case_priority"]
          p_subject?: string
        }
        Returns: Json
      }
      support_escalate_case: {
        Args: { p_case_id: string; p_reason: string }
        Returns: Json
      }
      support_flag_payment: {
        Args: { p_note: string; p_payment_event_id: string }
        Returns: Json
      }
      support_get_csat_case: { Args: { p_token: string }; Returns: Json }
      support_get_events_list: { Args: { p_search?: string }; Returns: Json }
      support_get_macros: { Args: never; Returns: Json }
      support_get_order_details: { Args: { p_order_id: string }; Returns: Json }
      support_get_orders_list: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_status?: Database["public"]["Enums"]["order_status"]
        }
        Returns: Json
      }
      support_get_overview_stats: { Args: never; Returns: Json }
      support_get_refund_requests: {
        Args: { p_status?: string }
        Returns: Json
      }
      support_get_unmatched_payments: { Args: never; Returns: Json }
      support_lookup_customer: { Args: { p_query: string }; Returns: Json }
      support_recommend_refund: {
        Args: {
          p_new_status: string
          p_note: string
          p_refund_request_id: string
        }
        Returns: Json
      }
      support_reply_case: {
        Args: { p_case_id: string; p_content: string; p_is_internal?: boolean }
        Returns: Json
      }
      support_request_email_change: {
        Args: { p_new_email: string; p_order_id: string; p_reason: string }
        Returns: Json
      }
      queue_email_outbox: {
        Args: {
          p_idempotency_key?: string
          p_order_id?: string
          p_payload?: Json
          p_recipient_email?: string
          p_template?: string
        }
        Returns: string
      }
      support_resend_ticket_email: {
        Args: { p_order_id: string; p_request_id?: string }
        Returns: Json
      }
      support_submit_csat: {
        Args: { p_comment?: string; p_rating: number; p_token: string }
        Returns: Json
      }
      support_update_case: {
        Args: {
          p_assigned_to: string
          p_case_id: string
          p_internal_note?: string
          p_priority: Database["public"]["Enums"]["support_case_priority"]
          p_status: Database["public"]["Enums"]["support_case_status"]
        }
        Returns: Json
      }
      support_view_case: { Args: { p_case_id: string }; Returns: Json }
      test_has_role: { Args: never; Returns: boolean }
      transfer_ticket: {
        Args: { p_new_email: string; p_new_name: string; p_ticket_code: string }
        Returns: undefined
      }
      update_ticket_attendee: {
        Args: {
          p_attendee_email: string
          p_attendee_name: string
          p_ticket_id: string
        }
        Returns: boolean
      }
      validate_promo_code: {
        Args: { p_code: string; p_event_id: string }
        Returns: Json
      }
      validate_promoter_code: {
        Args: { p_code: string; p_event_id: string }
        Returns: {
          link_id: string
          ticket_type_id: string
        }[]
      }
    }
    Enums: {
      app_role: "attendee" | "organizer" | "admin" | "customer_care"
      application_status: "pending" | "approved" | "rejected"
      checkout_question_type: "text" | "long_text" | "select" | "checkbox"
      discount_type: "percent" | "fixed"
      event_category:
        | "music"
        | "comedy"
        | "conference"
        | "church"
        | "campus"
        | "party"
        | "sport"
        | "other"
      event_status: "draft" | "published" | "cancelled" | "completed"
      job_application_status: "new" | "reviewed" | "rejected" | "hired"
      message_type: "ticket_delivery" | "system" | "event_update"
      order_status: "pending" | "paid" | "failed" | "refunded" | "comp"
      support_case_category:
        | "payment"
        | "missing_ticket"
        | "refund"
        | "event_inquiry"
        | "account"
        | "other"
      support_case_priority: "low" | "medium" | "high" | "urgent"
      support_case_status: "open" | "pending" | "resolved" | "closed"
      ticket_status: "valid" | "checked_in" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["attendee", "organizer", "admin", "customer_care"],
      application_status: ["pending", "approved", "rejected"],
      checkout_question_type: ["text", "long_text", "select", "checkbox"],
      discount_type: ["percent", "fixed"],
      event_category: [
        "music",
        "comedy",
        "conference",
        "church",
        "campus",
        "party",
        "sport",
        "other",
      ],
      event_status: ["draft", "published", "cancelled", "completed"],
      job_application_status: ["new", "reviewed", "rejected", "hired"],
      message_type: ["ticket_delivery", "system", "event_update"],
      order_status: ["pending", "paid", "failed", "refunded", "comp"],
      support_case_category: [
        "payment",
        "missing_ticket",
        "refund",
        "event_inquiry",
        "account",
        "other",
      ],
      support_case_priority: ["low", "medium", "high", "urgent"],
      support_case_status: ["open", "pending", "resolved", "closed"],
      ticket_status: ["valid", "checked_in", "cancelled"],
    },
  },
} as const
