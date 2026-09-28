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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: number
          payload: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: never
          payload?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: never
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          created_at: string
          player_id: string
          pool_id: string
        }
        Insert: {
          created_at?: string
          player_id: string
          pool_id: string
        }
        Update: {
          created_at?: string
          player_id?: string
          pool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          away_team: string | null
          created_at: string
          external_id: string | null
          home_team: string | null
          id: string
          lock_at: string
          name: string | null
          result: string | null
          round_id: string
          starts_at: string
        }
        Insert: {
          away_team?: string | null
          created_at?: string
          external_id?: string | null
          home_team?: string | null
          id?: string
          lock_at: string
          name?: string | null
          result?: string | null
          round_id: string
          starts_at: string
        }
        Update: {
          away_team?: string | null
          created_at?: string
          external_id?: string | null
          home_team?: string | null
          id?: string
          lock_at?: string
          name?: string | null
          result?: string | null
          round_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      f1_classification: {
        Row: {
          driver_id: string
          event_id: string
          position: number
        }
        Insert: {
          driver_id: string
          event_id: string
          position: number
        }
        Update: {
          driver_id?: string
          event_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "f1_classification_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "f1_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "f1_classification_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      f1_drivers: {
        Row: {
          code: string
          id: string
          name: string
          season: string
          team: string | null
        }
        Insert: {
          code: string
          id?: string
          name: string
          season: string
          team?: string | null
        }
        Update: {
          code?: string
          id?: string
          name?: string
          season?: string
          team?: string | null
        }
        Relationships: []
      }
      f1_picks: {
        Row: {
          driver_id: string
          entered_by: string
          event_id: string
          player_id: string
          position: number
          updated_at: string
        }
        Insert: {
          driver_id: string
          entered_by: string
          event_id: string
          player_id: string
          position: number
          updated_at?: string
        }
        Update: {
          driver_id?: string
          entered_by?: string
          event_id?: string
          player_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "f1_picks_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "f1_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "f1_picks_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "f1_picks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "f1_picks_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      match_picks: {
        Row: {
          entered_by: string
          event_id: string
          player_id: string
          selection: Database["public"]["Enums"]["match_outcome"]
          updated_at: string
        }
        Insert: {
          entered_by: string
          event_id: string
          player_id: string
          selection: Database["public"]["Enums"]["match_outcome"]
          updated_at?: string
        }
        Update: {
          entered_by?: string
          event_id?: string
          player_id?: string
          selection?: Database["public"]["Enums"]["match_outcome"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_picks_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_picks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_picks_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          display_name: string
          email: string | null
          id: string
          is_admin: boolean
          nickname: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          is_admin?: boolean
          nickname?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          is_admin?: boolean
          nickname?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      pool_admins: {
        Row: {
          player_id: string
          pool_id: string
        }
        Insert: {
          player_id: string
          pool_id: string
        }
        Update: {
          player_id?: string
          pool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pool_admins_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_admins_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      pools: {
        Row: {
          created_at: string
          entry_fee_cents: number
          id: string
          jackpot_opening_cents: number
          name: string
          season: string
          sport: Database["public"]["Enums"]["sport"]
          status: Database["public"]["Enums"]["pool_status"]
        }
        Insert: {
          created_at?: string
          entry_fee_cents?: number
          id?: string
          jackpot_opening_cents?: number
          name: string
          season: string
          sport: Database["public"]["Enums"]["sport"]
          status?: Database["public"]["Enums"]["pool_status"]
        }
        Update: {
          created_at?: string
          entry_fee_cents?: number
          id?: string
          jackpot_opening_cents?: number
          name?: string
          season?: string
          sport?: Database["public"]["Enums"]["sport"]
          status?: Database["public"]["Enums"]["pool_status"]
        }
        Relationships: []
      }
      round_results: {
        Row: {
          player_id: string
          points: number
          position: number
          prize_cents: number
          round_id: string
        }
        Insert: {
          player_id: string
          points: number
          position: number
          prize_cents?: number
          round_id: string
        }
        Update: {
          player_id?: string
          points?: number
          position?: number
          prize_cents?: number
          round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_results_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_results_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          created_at: string
          id: string
          jackpot_cents: number | null
          kind: Database["public"]["Enums"]["round_kind"]
          name: string
          ordinal: number
          pool_id: string
          pot_cents: number | null
          settlement_period_id: string | null
          status: Database["public"]["Enums"]["round_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          jackpot_cents?: number | null
          kind: Database["public"]["Enums"]["round_kind"]
          name: string
          ordinal: number
          pool_id: string
          pot_cents?: number | null
          settlement_period_id?: string | null
          status?: Database["public"]["Enums"]["round_status"]
        }
        Update: {
          created_at?: string
          id?: string
          jackpot_cents?: number | null
          kind?: Database["public"]["Enums"]["round_kind"]
          name?: string
          ordinal?: number
          pool_id?: string
          pot_cents?: number | null
          settlement_period_id?: string | null
          status?: Database["public"]["Enums"]["round_status"]
        }
        Relationships: [
          {
            foreignKeyName: "rounds_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_settlement_period_id_fkey"
            columns: ["settlement_period_id"]
            isOneToOne: false
            referencedRelation: "settlement_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_periods: {
        Row: {
          cutoff_at: string
          id: string
          settled_at: string | null
          settled_by: string | null
        }
        Insert: {
          cutoff_at: string
          id?: string
          settled_at?: string | null
          settled_by?: string | null
        }
        Update: {
          cutoff_at?: string
          id?: string
          settled_at?: string | null
          settled_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settlement_periods_settled_by_fkey"
            columns: ["settled_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_read_pick: {
        Args: { p_event_id: string; p_player_id: string }
        Returns: boolean
      }
      can_write_pick: {
        Args: { p_entered_by: string; p_event_id: string; p_player_id: string }
        Returns: boolean
      }
      current_player_id: { Args: never; Returns: string }
      event_is_locked: { Args: { p_event_id: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_any_pool_admin: { Args: never; Returns: boolean }
      is_enrolled: {
        Args: { p_player_id: string; p_pool_id: string }
        Returns: boolean
      }
      is_pool_admin: { Args: { p_pool_id: string }; Returns: boolean }
      pool_of_event: { Args: { p_event_id: string }; Returns: string }
      pool_of_round: { Args: { p_round_id: string }; Returns: string }
    }
    Enums: {
      match_outcome: "home" | "draw" | "away"
      pool_status: "upcoming" | "active" | "finished"
      round_kind: "matchday" | "week" | "gp" | "sprint"
      round_status: "scheduled" | "completed" | "cancelled"
      sport: "liga_mx" | "nfl" | "f1"
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
      match_outcome: ["home", "draw", "away"],
      pool_status: ["upcoming", "active", "finished"],
      round_kind: ["matchday", "week", "gp", "sprint"],
      round_status: ["scheduled", "completed", "cancelled"],
      sport: ["liga_mx", "nfl", "f1"],
    },
  },
} as const
