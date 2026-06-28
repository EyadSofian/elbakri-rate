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
      hotel_groups: {
        Row: {
          brand_name: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          brand_name?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          brand_name?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      hotel_rates: {
        Row: {
          adult_price: number
          booking_notes: string | null
          cancellation_policy: string | null
          category: string | null
          child_age_from: number | null
          child_age_to: number | null
          child_policy: string | null
          child_price: number | null
          created_at: string
          created_by: string | null
          currency: string
          date_from: string
          date_to: string
          days: number | null
          hotel_group: string | null
          hotel_group_id_fk: string | null
          hotel_id: string | null
          hotel_name: string
          id: string
          last_updated: string
          meal_plan: string
          nights: number | null
          occupancy: string | null
          offer_name: string | null
          package_id: string | null
          package_name: string | null
          pricing_basis: string
          record_id: string | null
          region: string
          room_type: string
          season_name: string | null
          source_cell: string | null
          source_sheet: string | null
          status: Database["public"]["Enums"]["rate_status"]
          sub_region: string | null
          transfer_details: string | null
          transfer_included: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          adult_price: number
          booking_notes?: string | null
          cancellation_policy?: string | null
          category?: string | null
          child_age_from?: number | null
          child_age_to?: number | null
          child_policy?: string | null
          child_price?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          date_from: string
          date_to: string
          days?: number | null
          hotel_group?: string | null
          hotel_group_id_fk?: string | null
          hotel_id?: string | null
          hotel_name: string
          id?: string
          last_updated?: string
          meal_plan: string
          nights?: number | null
          occupancy?: string | null
          offer_name?: string | null
          package_id?: string | null
          package_name?: string | null
          pricing_basis: string
          record_id?: string | null
          region: string
          room_type: string
          season_name?: string | null
          source_cell?: string | null
          source_sheet?: string | null
          status?: Database["public"]["Enums"]["rate_status"]
          sub_region?: string | null
          transfer_details?: string | null
          transfer_included?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          adult_price?: number
          booking_notes?: string | null
          cancellation_policy?: string | null
          category?: string | null
          child_age_from?: number | null
          child_age_to?: number | null
          child_policy?: string | null
          child_price?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          date_from?: string
          date_to?: string
          days?: number | null
          hotel_group?: string | null
          hotel_group_id_fk?: string | null
          hotel_id?: string | null
          hotel_name?: string
          id?: string
          last_updated?: string
          meal_plan?: string
          nights?: number | null
          occupancy?: string | null
          offer_name?: string | null
          package_id?: string | null
          package_name?: string | null
          pricing_basis?: string
          record_id?: string | null
          region?: string
          room_type?: string
          season_name?: string | null
          source_cell?: string | null
          source_sheet?: string | null
          status?: Database["public"]["Enums"]["rate_status"]
          sub_region?: string | null
          transfer_details?: string | null
          transfer_included?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_rates_hotel_group_id_fk_fkey"
            columns: ["hotel_group_id_fk"]
            isOneToOne: false
            referencedRelation: "hotel_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_rates_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_rates_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels: {
        Row: {
          address: string | null
          child_policy_default: string | null
          created_at: string
          description: string | null
          facilities: string | null
          hotel_group_id: string | null
          hotel_name: string
          id: string
          region: string
          star_rating: number | null
          status: string
          sub_region: string | null
          transfer_notes_default: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          child_policy_default?: string | null
          created_at?: string
          description?: string | null
          facilities?: string | null
          hotel_group_id?: string | null
          hotel_name: string
          id?: string
          region: string
          star_rating?: number | null
          status?: string
          sub_region?: string | null
          transfer_notes_default?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          child_policy_default?: string | null
          created_at?: string
          description?: string | null
          facilities?: string | null
          hotel_group_id?: string | null
          hotel_name?: string
          id?: string
          region?: string
          star_rating?: number | null
          status?: string
          sub_region?: string | null
          transfer_notes_default?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotels_hotel_group_id_fkey"
            columns: ["hotel_group_id"]
            isOneToOne: false
            referencedRelation: "hotel_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      package_hotels: {
        Row: {
          created_at: string
          hotel_id: string
          id: string
          package_id: string
        }
        Insert: {
          created_at?: string
          hotel_id: string
          id?: string
          package_id: string
        }
        Update: {
          created_at?: string
          hotel_id?: string
          id?: string
          package_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_hotels_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_hotels_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          created_at: string
          default_meal_plan: string | null
          default_pricing_basis: string | null
          description: string | null
          hotel_group_id: string | null
          id: string
          package_name: string
          package_type: string | null
          region: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_meal_plan?: string | null
          default_pricing_basis?: string | null
          description?: string | null
          hotel_group_id?: string | null
          id?: string
          package_name: string
          package_type?: string | null
          region?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_meal_plan?: string | null
          default_pricing_basis?: string | null
          description?: string | null
          hotel_group_id?: string | null
          id?: string
          package_name?: string
          package_type?: string | null
          region?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packages_hotel_group_id_fkey"
            columns: ["hotel_group_id"]
            isOneToOne: false
            referencedRelation: "hotel_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          created_at: string
          custom_note: string | null
          hotel_rate_id: string
          id: string
          quote_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          custom_note?: string | null
          hotel_rate_id: string
          id?: string
          quote_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          custom_note?: string | null
          hotel_rate_id?: string
          id?: string
          quote_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_hotel_rate_id_fkey"
            columns: ["hotel_rate_id"]
            isOneToOne: false
            referencedRelation: "hotel_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          client_name: string | null
          client_notes: string | null
          client_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          quote_number: string
          status: Database["public"]["Enums"]["quote_status"]
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          client_notes?: string | null
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          quote_number?: string
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          client_notes?: string | null
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          quote_number?: string
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
        }
        Relationships: []
      }
      saved_quotes: {
        Row: {
          client_name: string
          client_phone: string | null
          created_at: string
          created_by: string
          id: string
          notes: string | null
          quote_number: string
          selected_rate_ids: string[]
        }
        Insert: {
          client_name: string
          client_phone?: string | null
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          quote_number?: string
          selected_rate_ids?: string[]
        }
        Update: {
          client_name?: string
          client_phone?: string | null
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          quote_number?: string
          selected_rate_ids?: string[]
        }
        Relationships: []
      }
      user_access_rules: {
        Row: {
          can_edit: boolean
          can_export: boolean
          can_view: boolean
          created_at: string
          id: string
          scope_id: string | null
          scope_type: string
          user_id: string
        }
        Insert: {
          can_edit?: boolean
          can_export?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          scope_id?: string | null
          scope_type: string
          user_id: string
        }
        Update: {
          can_edit?: boolean
          can_export?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          scope_id?: string | null
          scope_type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_role_name: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      user_has_rate_access: {
        Args: {
          _hotel_group_id: string
          _hotel_id: string
          _need: string
          _package_id: string
          _region: string
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "operations" | "sales" | "viewer"
      quote_status: "draft" | "ready" | "sent" | "archived"
      rate_status: "Draft" | "Ready" | "Archived"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "operations", "sales", "viewer"],
      quote_status: ["draft", "ready", "sent", "archived"],
      rate_status: ["Draft", "Ready", "Archived"],
    },
  },
} as const
