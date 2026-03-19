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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      approval_tokens: {
        Row: {
          action: string
          created_at: string
          expires_at: string
          id: string
          token: string
          tuckshop_id: string
          used: boolean
        }
        Insert: {
          action: string
          created_at?: string
          expires_at: string
          id?: string
          token?: string
          tuckshop_id: string
          used?: boolean
        }
        Update: {
          action?: string
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          tuckshop_id?: string
          used?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "approval_tokens_tuckshop_id_fkey"
            columns: ["tuckshop_id"]
            isOneToOne: false
            referencedRelation: "tuckshops"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string | null
          tuckshop_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          tuckshop_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          tuckshop_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tuckshop_id_fkey"
            columns: ["tuckshop_id"]
            isOneToOne: false
            referencedRelation: "tuckshops"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sessions: {
        Row: {
          airtel_money: number
          cash_at_hand: number
          cash_outs: number
          created_at: string
          duration_minutes: number | null
          employee_id: string
          id: string
          login_time: string
          logout_time: string | null
          national_bank: number
          session_notes: string | null
          tnm_mpamba: number
          tuckshop_id: string
        }
        Insert: {
          airtel_money?: number
          cash_at_hand?: number
          cash_outs?: number
          created_at?: string
          duration_minutes?: number | null
          employee_id: string
          id?: string
          login_time?: string
          logout_time?: string | null
          national_bank?: number
          session_notes?: string | null
          tnm_mpamba?: number
          tuckshop_id: string
        }
        Update: {
          airtel_money?: number
          cash_at_hand?: number
          cash_outs?: number
          created_at?: string
          duration_minutes?: number | null
          employee_id?: string
          id?: string
          login_time?: string
          logout_time?: string | null
          national_bank?: number
          session_notes?: string | null
          tnm_mpamba?: number
          tuckshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_sessions_tuckshop_id_fkey"
            columns: ["tuckshop_id"]
            isOneToOne: false
            referencedRelation: "tuckshops"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          id: string
          invite_token: string | null
          permissions: Json
          tuckshop_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invite_token?: string | null
          permissions?: Json
          tuckshop_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invite_token?: string | null
          permissions?: Json
          tuckshop_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_tuckshop_id_fkey"
            columns: ["tuckshop_id"]
            isOneToOne: false
            referencedRelation: "tuckshops"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          method_type: string
          name: string
          tuckshop_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          method_type?: string
          name: string
          tuckshop_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          method_type?: string
          name?: string
          tuckshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_tuckshop_id_fkey"
            columns: ["tuckshop_id"]
            isOneToOne: false
            referencedRelation: "tuckshops"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list: {
        Row: {
          commodity_name: string
          created_at: string
          id: string
          tuckshop_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          commodity_name: string
          created_at?: string
          id?: string
          tuckshop_id: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          commodity_name?: string
          created_at?: string
          id?: string
          tuckshop_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_tuckshop_id_fkey"
            columns: ["tuckshop_id"]
            isOneToOne: false
            referencedRelation: "tuckshops"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      session_participants: {
        Row: {
          exit_time: string | null
          id: string
          join_time: string
          session_id: string
          tuckshop_id: string
          user_id: string
        }
        Insert: {
          exit_time?: string | null
          id?: string
          join_time?: string
          session_id: string
          tuckshop_id: string
          user_id: string
        }
        Update: {
          exit_time?: string | null
          id?: string
          join_time?: string
          session_id?: string
          tuckshop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "daily_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_tuckshop_id_fkey"
            columns: ["tuckshop_id"]
            isOneToOne: false
            referencedRelation: "tuckshops"
            referencedColumns: ["id"]
          },
        ]
      }
      session_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_method_id: string
          session_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          payment_method_id: string
          session_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_method_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "daily_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_goods: {
        Row: {
          commodity_name: string
          created_at: string
          id: string
          supplier_id: string
          tuckshop_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          commodity_name: string
          created_at?: string
          id?: string
          supplier_id: string
          tuckshop_id: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          commodity_name?: string
          created_at?: string
          id?: string
          supplier_id?: string
          tuckshop_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_goods_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_goods_tuckshop_id_fkey"
            columns: ["tuckshop_id"]
            isOneToOne: false
            referencedRelation: "tuckshops"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_sales: {
        Row: {
          commodity_name: string
          created_at: string
          created_by: string | null
          id: string
          is_paid: boolean
          outstanding_balance: number
          payment_confirmed_at: string | null
          payment_confirmed_by: string | null
          payment_locked: boolean
          quantity_sold: number
          quantity_supplied: number
          sale_date: string
          signature_data: string | null
          supplier_id: string | null
          supplier_name: string
          supply_time: string
          tuckshop_id: string
          unit_price: number
        }
        Insert: {
          commodity_name: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_paid?: boolean
          outstanding_balance?: number
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_locked?: boolean
          quantity_sold?: number
          quantity_supplied?: number
          sale_date?: string
          signature_data?: string | null
          supplier_id?: string | null
          supplier_name: string
          supply_time?: string
          tuckshop_id: string
          unit_price?: number
        }
        Update: {
          commodity_name?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_paid?: boolean
          outstanding_balance?: number
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_locked?: boolean
          quantity_sold?: number
          quantity_supplied?: number
          sale_date?: string
          signature_data?: string | null
          supplier_id?: string | null
          supplier_name?: string
          supply_time?: string
          tuckshop_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_sales_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_sales_tuckshop_id_fkey"
            columns: ["tuckshop_id"]
            isOneToOne: false
            referencedRelation: "tuckshops"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string
          id: string
          supplier_name: string
          tuckshop_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          supplier_name: string
          tuckshop_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          supplier_name?: string
          tuckshop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tuckshop_id_fkey"
            columns: ["tuckshop_id"]
            isOneToOne: false
            referencedRelation: "tuckshops"
            referencedColumns: ["id"]
          },
        ]
      }
      tuckshop_notes: {
        Row: {
          created_at: string
          id: string
          note: string
          tuckshop_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note: string
          tuckshop_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string
          tuckshop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tuckshop_notes_tuckshop_id_fkey"
            columns: ["tuckshop_id"]
            isOneToOne: false
            referencedRelation: "tuckshops"
            referencedColumns: ["id"]
          },
        ]
      }
      tuckshops: {
        Row: {
          brand_color: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          status: Database["public"]["Enums"]["tuckshop_status"]
        }
        Insert: {
          brand_color?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          status?: Database["public"]["Enums"]["tuckshop_status"]
        }
        Update: {
          brand_color?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          status?: Database["public"]["Enums"]["tuckshop_status"]
        }
        Relationships: [
          {
            foreignKeyName: "tuckshops_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      get_active_tuckshop_session: {
        Args: { _tuckshop_id: string }
        Returns: string
      }
      get_user_tuckshop_id: { Args: { _user_id: string }; Returns: string }
      has_employee_permission: {
        Args: { _perm_key: string; _tuckshop_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_tuckshop_member: {
        Args: { _tuckshop_id: string; _user_id: string }
        Returns: boolean
      }
      is_tuckshop_owner: {
        Args: { _tuckshop_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "tuckshop_admin" | "employee"
      tuckshop_status: "pending" | "approved" | "rejected"
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
      app_role: ["super_admin", "tuckshop_admin", "employee"],
      tuckshop_status: ["pending", "approved", "rejected"],
    },
  },
} as const
