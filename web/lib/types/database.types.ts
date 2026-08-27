/**
 * Hand-maintained Supabase schema types aligned with migrations 0001–0008
 * (plus bootstrap_household from 0009). Regenerate from a live project when
 * convenient:
 *
 *   supabase gen types typescript --project-id <ref> > lib/types/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type HouseholdRole = "OWNER" | "MEMBER";
export type PriorityLevel = "LOW" | "MEDIUM" | "HIGH";
export type ReceiptStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ToBuyStatus = "OPEN" | "PARTIAL" | "FULFILLED" | "CANCELLED";

export type Database = {
  public: {
    Tables: {
      households: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      household_members: {
        Row: {
          household_id: string;
          user_id: string;
          role: HouseholdRole;
          joined_at: string;
        };
        Insert: {
          household_id: string;
          user_id: string;
          role?: HouseholdRole;
          joined_at?: string;
        };
        Update: {
          household_id?: string;
          user_id?: string;
          role?: HouseholdRole;
          joined_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_items: {
        Row: {
          id: string;
          household_id: string;
          standardized_name: string;
          quantity: number;
          unit_type: string;
          category: string | null;
          priority_tag: PriorityLevel;
          min_threshold: number;
          expiration_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          standardized_name: string;
          quantity?: number;
          unit_type: string;
          category?: string | null;
          priority_tag?: PriorityLevel;
          min_threshold?: number;
          expiration_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          standardized_name?: string;
          quantity?: number;
          unit_type?: string;
          category?: string | null;
          priority_tag?: PriorityLevel;
          min_threshold?: number;
          expiration_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_items_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      product_mapping: {
        Row: {
          id: string;
          household_id: string;
          raw_ocr_string: string;
          standardized_item_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          raw_ocr_string: string;
          standardized_item_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          raw_ocr_string?: string;
          standardized_item_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_mapping_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_mapping_standardized_item_id_fkey";
            columns: ["standardized_item_id"];
            isOneToOne: false;
            referencedRelation: "inventory_items";
            referencedColumns: ["id"];
          },
        ];
      };
      price_history: {
        Row: {
          id: string;
          household_id: string;
          item_id: string;
          price: number;
          store_name: string;
          date_purchased: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          item_id: string;
          price: number;
          store_name: string;
          date_purchased: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          item_id?: string;
          price?: number;
          store_name?: string;
          date_purchased?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "price_history_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_history_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "inventory_items";
            referencedColumns: ["id"];
          },
        ];
      };
      pending_receipt: {
        Row: {
          id: string;
          household_id: string;
          store_name: string | null;
          parsed_json: Json | null;
          status: ReceiptStatus;
          raw_image_url: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          store_name?: string | null;
          parsed_json?: Json | null;
          status?: ReceiptStatus;
          raw_image_url: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          store_name?: string | null;
          parsed_json?: Json | null;
          status?: ReceiptStatus;
          raw_image_url?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pending_receipt_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      to_buy_list: {
        Row: {
          id: string;
          household_id: string;
          item_id: string;
          quantity_requested: number;
          quantity_remaining: number;
          status: ToBuyStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          item_id: string;
          quantity_requested: number;
          quantity_remaining: number;
          status?: ToBuyStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          item_id?: string;
          quantity_requested?: number;
          quantity_remaining?: number;
          status?: ToBuyStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "to_buy_list_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "to_buy_list_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "inventory_items";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      bootstrap_household: {
        Args: { p_household_name?: string };
        Returns: string;
      };
    };
    Enums: {
      household_role: HouseholdRole;
      priority_level: PriorityLevel;
      receipt_status: ReceiptStatus;
      to_buy_status: ToBuyStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];

export type InventoryItem = Tables<"inventory_items">;
export type ToBuyListEntry = Tables<"to_buy_list">;

export type ToBuyListEntryWithItem = ToBuyListEntry & {
  inventory_items: Pick<InventoryItem, "standardized_name" | "unit_type"> | null;
};
