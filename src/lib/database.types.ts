export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      eyepieces: {
        Row: {
          afov_deg: number;
          created_at: string;
          focal_length_mm: number;
          id: string;
          name: string;
          user_id: string;
        };
        Insert: {
          afov_deg: number;
          created_at?: string;
          focal_length_mm: number;
          id?: string;
          name: string;
          user_id?: string;
        };
        Update: {
          afov_deg?: number;
          created_at?: string;
          focal_length_mm?: number;
          id?: string;
          name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      observations: {
        Row: {
          created_at: string;
          id: string;
          messier: number | null;
          night: string;
          rating: number;
          site_id: string | null;
          site_name: string;
          target: string;
          telescope_id: string | null;
          telescope_name: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          messier?: number | null;
          night: string;
          rating: number;
          site_id?: string | null;
          site_name: string;
          target: string;
          telescope_id?: string | null;
          telescope_name: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          messier?: number | null;
          night?: string;
          rating?: number;
          site_id?: string | null;
          site_name?: string;
          target?: string;
          telescope_id?: string | null;
          telescope_name?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "observations_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "observations_telescope_id_fkey";
            columns: ["telescope_id"];
            isOneToOne: false;
            referencedRelation: "telescopes";
            referencedColumns: ["id"];
          },
        ];
      };
      sites: {
        Row: {
          bortle: number;
          created_at: string;
          id: string;
          latitude_deg: number;
          longitude_deg: number;
          min_altitude_deg: number;
          name: string;
          time_zone: string;
          time_zone_source: string;
          user_id: string;
        };
        Insert: {
          bortle: number;
          created_at?: string;
          id?: string;
          latitude_deg: number;
          longitude_deg: number;
          min_altitude_deg?: number;
          name: string;
          time_zone: string;
          time_zone_source: string;
          user_id?: string;
        };
        Update: {
          bortle?: number;
          created_at?: string;
          id?: string;
          latitude_deg?: number;
          longitude_deg?: number;
          min_altitude_deg?: number;
          name?: string;
          time_zone?: string;
          time_zone_source?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      sky_checks: {
        Row: {
          answer: string | null;
          answered_at: string | null;
          created_at: string;
          dark_start: string;
          headline: string;
          id: string;
          night: string;
          shown_at: string;
          site_id: string | null;
          site_name: string;
          skipped_at: string | null;
          user_id: string;
        };
        Insert: {
          answer?: string | null;
          answered_at?: string | null;
          created_at?: string;
          dark_start: string;
          headline: string;
          id?: string;
          night: string;
          shown_at?: string;
          site_id?: string | null;
          site_name: string;
          skipped_at?: string | null;
          user_id?: string;
        };
        Update: {
          answer?: string | null;
          answered_at?: string | null;
          created_at?: string;
          dark_start?: string;
          headline?: string;
          id?: string;
          night?: string;
          shown_at?: string;
          site_id?: string | null;
          site_name?: string;
          skipped_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sky_checks_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
      telescopes: {
        Row: {
          aperture_mm: number;
          created_at: string;
          focal_length_mm: number;
          id: string;
          name: string;
          user_id: string;
        };
        Insert: {
          aperture_mm: number;
          created_at?: string;
          focal_length_mm: number;
          id?: string;
          name: string;
          user_id?: string;
        };
        Update: {
          aperture_mm?: number;
          created_at?: string;
          focal_length_mm?: number;
          id?: string;
          name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      complete_onboarding: {
        Args: {
          aperture_mm: number;
          bortle: number;
          eyepieces: Json;
          focal_length_mm: number;
          latitude_deg: number;
          longitude_deg: number;
          min_altitude_deg: number;
          site_name: string;
          telescope_name: string;
          time_zone: string;
          time_zone_source: string;
        };
        Returns: undefined;
      };
      record_sky_verdict: {
        Args: {
          dark_start: string;
          headline: string;
          night: string;
          site_id: string;
        };
        Returns: undefined;
      };
      sky_check_tally: {
        Args: never;
        Returns: {
          answer: string;
          headline: string;
          nights: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
