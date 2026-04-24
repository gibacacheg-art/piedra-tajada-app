export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          email: string | null;
          company_name: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          phone?: string | null;
          email?: string | null;
          company_name?: string | null;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
        Relationships: [];
      };
      event_requests: {
        Row: {
          id: string;
          client_id: string;
          event_type: string;
          tentative_date: string;
          start_time: string;
          end_time: string;
          guest_count: number;
          requested_space_id: string | null;
          estimated_budget: number | null;
          lead_source: string | null;
          special_requirements: string | null;
          status: string;
          is_archived: boolean;
          archived_at: string | null;
          trashed_at: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          event_type: string;
          tentative_date: string;
          start_time: string;
          end_time: string;
          guest_count: number;
          requested_space_id?: string | null;
          estimated_budget?: number | null;
          lead_source?: string | null;
          special_requirements?: string | null;
          status?: string;
          is_archived?: boolean;
          archived_at?: string | null;
          trashed_at?: string | null;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["event_requests"]["Insert"]>;
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          request_id: string | null;
          client_id: string;
          event_name: string;
          event_type: string;
          event_date: string;
          start_time: string;
          end_time: string;
          guest_count: number;
          status: string;
          is_archived: boolean;
          archived_at: string | null;
          trashed_at: string | null;
          main_responsible_id: string | null;
          commercial_responsible_id: string | null;
          operations_responsible_id: string | null;
          contracted_services: string | null;
          menu_details: string | null;
          technical_requirements: string | null;
          logistics_requirements: string | null;
          internal_notes: string | null;
          client_notes: string | null;
          total_amount: number;
          deposit_amount: number;
          balance_amount: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          request_id?: string | null;
          client_id: string;
          event_name: string;
          event_type: string;
          event_date: string;
          start_time: string;
          end_time: string;
          guest_count: number;
          status?: string;
          is_archived?: boolean;
          archived_at?: string | null;
          trashed_at?: string | null;
          main_responsible_id?: string | null;
          commercial_responsible_id?: string | null;
          operations_responsible_id?: string | null;
          contracted_services?: string | null;
          menu_details?: string | null;
          technical_requirements?: string | null;
          logistics_requirements?: string | null;
          internal_notes?: string | null;
          client_notes?: string | null;
          total_amount?: number;
          deposit_amount?: number;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["events"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          phone?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      roles: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["roles"]["Insert"]>;
        Relationships: [];
      };
      user_roles: {
        Row: {
          user_id: string;
          role_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          role_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Insert"]>;
        Relationships: [];
      };
      departments: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["departments"]["Insert"]>;
        Relationships: [];
      };
      venues_spaces: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          capacity: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          capacity: number;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["venues_spaces"]["Insert"]>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          event_id: string;
          amount: number;
          payment_type: string;
          due_date: string | null;
          paid_at: string | null;
          status: string;
          reference: string | null;
          is_invoiced: boolean;
          invoice_number: string | null;
          invoice_issued_at: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          amount: number;
          payment_type?: string;
          due_date?: string | null;
          paid_at?: string | null;
          status?: string;
          reference?: string | null;
          is_invoiced?: boolean;
          invoice_number?: string | null;
          invoice_issued_at?: string | null;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [];
      };
      quote_items: {
        Row: {
          id: string;
          request_id: string | null;
          event_id: string | null;
          service_name: string;
          description: string | null;
          quantity: number;
          unit_price: number;
          total_amount: number;
          sort_order: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          request_id?: string | null;
          event_id?: string | null;
          service_name: string;
          description?: string | null;
          quantity?: number;
          unit_price?: number;
          sort_order?: number;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["quote_items"]["Insert"]>;
        Relationships: [];
      };
      event_space_reservations: {
        Row: {
          id: string;
          event_id: string;
          space_id: string;
          start_at: string;
          end_at: string;
          status: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          space_id: string;
          start_at: string;
          end_at: string;
          status?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["event_space_reservations"]["Insert"]>;
        Relationships: [];
      };
      event_responsibles: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          department_id: string | null;
          scope: "main" | "commercial" | "operations" | "department";
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          department_id?: string | null;
          scope?: "main" | "commercial" | "operations" | "department";
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["event_responsibles"]["Insert"]>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          event_id: string;
          title: string;
          description: string | null;
          assigned_to: string | null;
          department_id: string | null;
          due_date: string | null;
          priority: "low" | "normal" | "high" | "urgent";
          status: string;
          requires_acknowledgement: boolean;
          acknowledged_at: string | null;
          completed_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          title: string;
          description?: string | null;
          assigned_to?: string | null;
          department_id?: string | null;
          due_date?: string | null;
          priority?: "low" | "normal" | "high" | "urgent";
          status?: string;
          requires_acknowledgement?: boolean;
          acknowledged_at?: string | null;
          completed_at?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
        Relationships: [];
      };
      checklists: {
        Row: {
          id: string;
          event_id: string;
          department_id: string | null;
          title: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          department_id?: string | null;
          title: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["checklists"]["Insert"]>;
        Relationships: [];
      };
      checklist_items: {
        Row: {
          id: string;
          checklist_id: string;
          title: string;
          description: string | null;
          assigned_to: string | null;
          is_done: boolean;
          done_at: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          checklist_id: string;
          title: string;
          description?: string | null;
          assigned_to?: string | null;
          is_done?: boolean;
          done_at?: string | null;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["checklist_items"]["Insert"]>;
        Relationships: [];
      };
      comments: {
        Row: {
          id: string;
          related_type: "event_request" | "event" | "client" | "task" | "payment" | "document";
          related_id: string;
          author_id: string | null;
          body: string;
          is_internal: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          related_type: "event_request" | "event" | "client" | "task" | "payment" | "document";
          related_id: string;
          author_id?: string | null;
          body: string;
          is_internal?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["comments"]["Insert"]>;
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          related_type: "event_request" | "event" | "client" | "task" | "payment" | "document";
          related_id: string;
          file_name: string;
          file_path: string;
          mime_type: string | null;
          file_size: number | null;
          uploaded_by: string | null;
          trashed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          related_type: "event_request" | "event" | "client" | "task" | "payment" | "document";
          related_id: string;
          file_name: string;
          file_path: string;
          mime_type?: string | null;
          file_size?: number | null;
          uploaded_by?: string | null;
          trashed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      related_entity_type: "event_request" | "event" | "client" | "task" | "payment" | "document";
      responsible_scope: "main" | "commercial" | "operations" | "department";
      payment_type: "deposit" | "installment" | "balance" | "refund" | "other";
      task_priority: "low" | "normal" | "high" | "urgent";
    };
  };
};

export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type EventRequest = Database["public"]["Tables"]["event_requests"]["Row"] & {
  clients?: Pick<Client, "full_name" | "phone" | "email" | "company_name"> | null;
  venues_spaces?: Pick<Database["public"]["Tables"]["venues_spaces"]["Row"], "name"> | null;
};
export type Event = Database["public"]["Tables"]["events"]["Row"] & {
  clients?: Pick<Client, "full_name" | "phone" | "email" | "company_name"> | null;
};
export type QuoteItem = Database["public"]["Tables"]["quote_items"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Role = Database["public"]["Tables"]["roles"]["Row"];
export type UserRole = Database["public"]["Tables"]["user_roles"]["Row"] & {
  roles?: Pick<Role, "id" | "code" | "name"> | null;
};
export type Department = Database["public"]["Tables"]["departments"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"] & {
  profiles?: Pick<Profile, "full_name"> | null;
  departments?: Pick<Department, "name"> | null;
};
export type EventResponsible = Database["public"]["Tables"]["event_responsibles"]["Row"] & {
  profiles?: Pick<Profile, "full_name"> | null;
  departments?: Pick<Department, "name"> | null;
};
export type ChecklistItem = Database["public"]["Tables"]["checklist_items"]["Row"];
export type Checklist = Database["public"]["Tables"]["checklists"]["Row"] & {
  departments?: Pick<Department, "name"> | null;
  checklist_items?: ChecklistItem[];
};
export type Comment = Database["public"]["Tables"]["comments"]["Row"] & {
  profiles?: Pick<Profile, "full_name"> | null;
};
export type Document = Database["public"]["Tables"]["documents"]["Row"];
