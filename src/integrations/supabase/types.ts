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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
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
      events: {
        Row: {
          address: string | null
          admin_cancelled: boolean
          cancelled_at: string | null
          category: Database["public"]["Enums"]["event_category"]
          city: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          end_datetime: string
          id: string
          organizer_id: string
          organizer_note: string | null
          postponed_at: string | null
          slug: string
          start_datetime: string
          state: string | null
          status: Database["public"]["Enums"]["event_status"]
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
          description?: string | null
          end_datetime: string
          id?: string
          organizer_id: string
          organizer_note?: string | null
          postponed_at?: string | null
          slug: string
          start_datetime: string
          state?: string | null
          status?: Database["public"]["Enums"]["event_status"]
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
          description?: string | null
          end_datetime?: string
          id?: string
          organizer_id?: string
          organizer_note?: string | null
          postponed_at?: string | null
          slug?: string
          start_datetime?: string
          state?: string | null
          status?: Database["public"]["Enums"]["event_status"]
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
          created_at: string
          discount_kobo: number
          event_id: string
          gift_message: string | null
          id: string
          is_gift: boolean
          payment_reference: string | null
          promo_code_id: string | null
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
          created_at?: string
          discount_kobo?: number
          event_id: string
          gift_message?: string | null
          id?: string
          is_gift?: boolean
          payment_reference?: string | null
          promo_code_id?: string | null
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
          created_at?: string
          discount_kobo?: number
          event_id?: string
          gift_message?: string | null
          id?: string
          is_gift?: boolean
          payment_reference?: string | null
          promo_code_id?: string | null
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
            foreignKeyName: "organizer_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "organizer_revocations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          city: string | null
          created_at: string
          full_name: string | null
          id: string
          is_admin?: boolean | null
          is_organizer?: boolean
          is_verified_organizer?: boolean | null
          paystack_subaccount_code?: string | null
          phone: string | null
          subaccount_created_at: string | null
          suspended: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          is_admin?: boolean | null
          is_organizer?: boolean
          paystack_subaccount_code?: string | null
          phone?: string | null
          subaccount_created_at?: string | null
          suspended?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          is_organizer?: boolean
          paystack_subaccount_code?: string | null
          phone?: string | null
          subaccount_created_at?: string | null
          suspended?: boolean
          updated_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_cancel_event: {
        Args: { p_event_id: string; p_note: string }
        Returns: undefined
      }
      admin_delete_job_application: {
        Args: { p_id: string }
        Returns: undefined
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
      admin_revoke_organizer: {
        Args: { p_reason: string; p_user_id: string }
        Returns: undefined
      }
      admin_revoke_organizer_by_email: {
        Args: { p_email: string; p_reason?: string }
        Returns: undefined
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
      approve_organizer_application: {
        Args: { p_application_id: string; p_note?: string }
        Returns: undefined
      }
      cancel_event: {
        Args: { p_event_id: string; p_note: string }
        Returns: undefined
      }
      cancel_ticket: { Args: { p_ticket_id: string }; Returns: undefined }
      claim_guest_messages: { Args: never; Returns: undefined }
      get_guest_order_full: {
        Args: { p_email: string; p_order_id: string }
        Returns: Json
      }
      get_guest_orders: {
        Args: { p_email: string }
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
          p_event_id: string
          p_gift_message?: string
          p_is_gift?: boolean
          p_payment_reference: string
          p_promo_code_id?: string
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
      test_has_role: { Args: never; Returns: boolean }
      update_ticket_attendee: {
        Args: {
          p_attendee_email: string
          p_attendee_name: string
          p_ticket_id: string
        }
        Returns: undefined
      }
      validate_promo_code: {
        Args: { p_code: string; p_event_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "attendee" | "organizer" | "admin"
      application_status: "pending" | "approved" | "rejected"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["attendee", "organizer", "admin"],
      application_status: ["pending", "approved", "rejected"],
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
      ticket_status: ["valid", "checked_in", "cancelled"],
    },
  },
} as const
