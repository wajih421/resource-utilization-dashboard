// Generated from the live Supabase schema via PostgREST's OpenAPI introspection
// (GET /rest/v1/ with Accept: application/openapi+json). Regenerate by re-running
// that introspection whenever the schema changes — see docs/DATABASE.md.
//
// Note: every table needs a `Relationships` array and the schema needs
// `Views`/`Functions` (even empty) to satisfy @supabase/postgrest-js's
// `GenericSchema` constraint — without them the typed client silently
// resolves every row type to `never`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          role: "manager" | "resource";
          resource_id: string | null;
          created_at: string;
          has_custom_password: boolean;
        };
        Insert: {
          id: string;
          email: string;
          role?: "manager" | "resource";
          resource_id?: string | null;
          created_at?: string;
          has_custom_password?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "profiles_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          }
        ];
      };
      resources: {
        Row: {
          id: string;
          name: string;
          employee_id: string | null;
          working_days: string | null;
          shift_start: string | null;
          shift_end: string | null;
          workshop_joining_date: string | null;
          huawei_joining_date: string | null;
          active: boolean | null;
          created_at: string | null;
          resource_category: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          employee_id?: string | null;
          working_days?: string | null;
          shift_start?: string | null;
          shift_end?: string | null;
          workshop_joining_date?: string | null;
          huawei_joining_date?: string | null;
          active?: boolean | null;
          created_at?: string | null;
          resource_category?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["resources"]["Insert"]>;
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          name: string;
          active: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          active?: boolean | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
        Relationships: [];
      };
      resource_projects: {
        Row: {
          id: string;
          resource_id: string;
          project_id: string;
          assigned_at: string | null;
          active: boolean | null;
        };
        Insert: {
          id?: string;
          resource_id: string;
          project_id: string;
          assigned_at?: string | null;
          active?: boolean | null;
        };
        Update: Partial<Database["public"]["Tables"]["resource_projects"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "resource_projects_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resource_projects_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
      task_categories: {
        Row: {
          id: string;
          name: string;
        };
        Insert: {
          id?: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["task_categories"]["Insert"]>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
          task_category_id: string;
          name: string;
          ne_batch: string | null;
          default_hours: number;
          active: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          task_category_id: string;
          name: string;
          ne_batch?: string | null;
          default_hours?: number;
          active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_task_category_id_fkey";
            columns: ["task_category_id"];
            isOneToOne: false;
            referencedRelation: "task_categories";
            referencedColumns: ["id"];
          }
        ];
      };
      work_logs: {
        Row: {
          id: string;
          resource_id: string;
          project_id: string;
          task_id: string;
          work_date: string;
          work_day_type: "regular" | "weekend";
          units_completed: number;
          applied_task_hours: number;
          total_hours: number;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          resource_id: string;
          project_id: string;
          task_id: string;
          work_date: string;
          work_day_type?: "regular" | "weekend";
          units_completed: number;
          applied_task_hours: number;
          total_hours: number;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["work_logs"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "work_logs_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "work_logs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "work_logs_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          }
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          manager_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          old_value: Json | null;
          new_value: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          manager_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          old_value?: Json | null;
          new_value?: Json | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "audit_logs_manager_id_fkey";
            columns: ["manager_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      utilization_settings: {
        Row: {
          id: number;
          daily_capacity_hours: number;
          less_utilized_max: number;
          fully_utilized_max: number;
          highly_utilized_max: number;
        };
        Insert: {
          id?: number;
          daily_capacity_hours?: number;
          less_utilized_max?: number;
          fully_utilized_max?: number;
          highly_utilized_max?: number;
        };
        Update: Partial<Database["public"]["Tables"]["utilization_settings"]["Insert"]>;
        Relationships: [];
      };
      attendance_logs: {
        Row: {
          id: string;
          resource_id: string;
          work_date: string;
          sign_in_time: string | null;
          sign_out_time: string | null;
          status: AttendanceStatus | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          resource_id: string;
          work_date: string;
          sign_in_time?: string | null;
          sign_out_time?: string | null;
          status?: AttendanceStatus | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["attendance_logs"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "attendance_logs_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}

export type AttendanceStatus = "present" | "late" | "left_early" | "absent" | "on_leave" | "pending";

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
