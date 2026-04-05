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
      agent_difficulty: {
        Row: {
          agent_name: string
          difficulty_level: number
          id: string
          last_score: number | null
          sessions_at_level: number
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_name: string
          difficulty_level?: number
          id?: string
          last_score?: number | null
          sessions_at_level?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_name?: string
          difficulty_level?: number
          id?: string
          last_score?: number | null
          sessions_at_level?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_difficulty_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      caregiver_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          message: string
          resolved_at: string | null
          resolved_by: string | null
          sent_to: string[] | null
          severity: string
          user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          message: string
          resolved_at?: string | null
          resolved_by?: string | null
          sent_to?: string[] | null
          severity: string
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          message?: string
          resolved_at?: string | null
          resolved_by?: string | null
          sent_to?: string[] | null
          severity?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caregiver_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_adherence: {
        Row: {
          confirmed_by: string
          confirmed_taken_at: string | null
          created_at: string
          id: string
          medication_name: string
          scheduled_time: string
          status: string
          user_id: string
        }
        Insert: {
          confirmed_by?: string
          confirmed_taken_at?: string | null
          created_at?: string
          id?: string
          medication_name: string
          scheduled_time: string
          status: string
          user_id: string
        }
        Update: {
          confirmed_by?: string
          confirmed_taken_at?: string | null
          created_at?: string
          id?: string
          medication_name?: string
          scheduled_time?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_adherence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          date_of_birth: string | null
          deployment: string
          full_name: string | null
          id: string
          language: string
          mem0_user_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string
          subscription_tier: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          deployment?: string
          full_name?: string | null
          id: string
          language?: string
          mem0_user_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          subscription_tier?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          deployment?: string
          full_name?: string | null
          id?: string
          language?: string
          mem0_user_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          subscription_tier?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      session_exchanges: {
        Row: {
          agent_used: string | null
          created_at: string
          id: string
          intent_classified: string | null
          intent_confidence: number | null
          message: string
          session_id: string
          speaker: string
          user_id: string
        }
        Insert: {
          agent_used?: string | null
          created_at?: string
          id?: string
          intent_classified?: string | null
          intent_confidence?: number | null
          message: string
          session_id: string
          speaker: string
          user_id: string
        }
        Update: {
          agent_used?: string | null
          created_at?: string
          id?: string
          intent_classified?: string | null
          intent_confidence?: number | null
          message?: string
          session_id?: string
          speaker?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_exchanges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_state: {
        Row: {
          created_at: string
          current_agent: string
          id: string
          last_activity_at: string | null
          last_agent: string | null
          last_intent: string | null
          next_agent_override: string | null
          session_id: string
          turn_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_agent?: string
          id?: string
          last_activity_at?: string | null
          last_agent?: string | null
          last_intent?: string | null
          next_agent_override?: string | null
          session_id: string
          turn_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_agent?: string
          id?: string
          last_activity_at?: string | null
          last_agent?: string | null
          last_intent?: string | null
          next_agent_override?: string | null
          session_id?: string
          turn_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_medications: {
        Row: {
          active: boolean
          added_by: string
          created_at: string
          dosage: string | null
          frequency: string | null
          id: string
          medication_name: string
          scheduled_times: string[] | null
          user_id: string
        }
        Insert: {
          active?: boolean
          added_by?: string
          created_at?: string
          dosage?: string | null
          frequency?: string | null
          id?: string
          medication_name: string
          scheduled_times?: string[] | null
          user_id: string
        }
        Update: {
          active?: boolean
          added_by?: string
          created_at?: string
          dosage?: string | null
          frequency?: string | null
          id?: string
          medication_name?: string
          scheduled_times?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_medications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
