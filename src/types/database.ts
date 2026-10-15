export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'STUDENT' | 'OWNER' | 'ADMIN';
export type PropertyGenderType = 'Boys' | 'Girls' | 'Co-ed';
export type BookingStatus = 'Pending' | 'Confirmed' | 'Declined' | 'Rescheduled' | 'Completed' | 'Cancelled';
export type VerificationStatus = 'Pending' | 'Approved' | 'Rejected';
export type ReportTargetType = 'Property' | 'Review' | 'User';
export type ReportStatus = 'Open' | 'Resolved' | 'Dismissed';
export type SubscriptionTier = 'Monthly' | 'Yearly';
export type PaymentStatus = 'Pending' | 'Success' | 'Failed' | 'Refunded';
export type NotificationType =
  | 'booking_request'
  | 'booking_confirmed'
  | 'booking_declined'
  | 'verification_approved'
  | 'verification_rejected'
  | 'report_update'
  | 'system_alert';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          phone: string | null;
          role: UserRole;
          avatar_url: string | null;
          college_name: string | null;
          student_id_doc_url: string | null;
          is_verified: boolean;
          student_id_rejection_reason: string | null;
          bio: string | null;
          emergency_contact: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          phone?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
          college_name?: string | null;
          student_id_doc_url?: string | null;
          is_verified?: boolean;
          student_id_rejection_reason?: string | null;
          bio?: string | null;
          emergency_contact?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          phone?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
          college_name?: string | null;
          student_id_doc_url?: string | null;
          is_verified?: boolean;
          student_id_rejection_reason?: string | null;
          bio?: string | null;
          emergency_contact?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      properties: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          slug: string;
          description: string;
          location_name: string;
          city: string;
          state: string;
          pincode: string | null;
          address: string;
          latitude: number | null;
          longitude: number | null;
          distance_text: string;
          distance_km: number;
          base_price: number;
          gender_type: PropertyGenderType;
          is_premium: boolean;
          is_verified: boolean;
          is_active: boolean;
          rejection_reason: string | null;
          house_rules: string[];
          contact_phone: string | null;
          contact_email: string | null;
          rating: number;
          reviews_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          title: string;
          slug: string;
          description: string;
          location_name: string;
          city?: string;
          state?: string;
          pincode?: string | null;
          address: string;
          latitude?: number | null;
          longitude?: number | null;
          distance_text: string;
          distance_km?: number;
          base_price: number;
          gender_type: PropertyGenderType;
          is_premium?: boolean;
          is_verified?: boolean;
          is_active?: boolean;
          rejection_reason?: string | null;
          house_rules?: string[];
          contact_phone?: string | null;
          contact_email?: string | null;
          rating?: number;
          reviews_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          title?: string;
          slug?: string;
          description?: string;
          location_name?: string;
          city?: string;
          state?: string;
          pincode?: string | null;
          address?: string;
          latitude?: number | null;
          longitude?: number | null;
          distance_text?: string;
          distance_km?: number;
          base_price?: number;
          gender_type?: PropertyGenderType;
          is_premium?: boolean;
          is_verified?: boolean;
          is_active?: boolean;
          rejection_reason?: string | null;
          house_rules?: string[];
          contact_phone?: string | null;
          contact_email?: string | null;
          rating?: number;
          reviews_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'properties_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      rooms: {
        Row: {
          id: string;
          property_id: string;
          name: string;
          price: number;
          total_beds: number;
          available_beds: number;
          is_available: boolean;
          deposit_amount: number;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          name: string;
          price: number;
          total_beds?: number;
          available_beds?: number;
          is_available?: boolean;
          deposit_amount?: number;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          name?: string;
          price?: number;
          total_beds?: number;
          available_beds?: number;
          is_available?: boolean;
          deposit_amount?: number;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'rooms_property_id_fkey';
            columns: ['property_id'];
            isOneToOne: false;
            referencedRelation: 'properties';
            referencedColumns: ['id'];
          }
        ];
      };
      property_images: {
        Row: {
          id: string;
          property_id: string;
          image_url: string;
          caption: string | null;
          display_order: number;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          image_url: string;
          caption?: string | null;
          display_order?: number;
          is_primary?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          image_url?: string;
          caption?: string | null;
          display_order?: number;
          is_primary?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'property_images_property_id_fkey';
            columns: ['property_id'];
            isOneToOne: false;
            referencedRelation: 'properties';
            referencedColumns: ['id'];
          }
        ];
      };
      amenities: {
        Row: {
          id: string;
          name: string;
          icon: string;
          category: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          icon: string;
          category?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          icon?: string;
          category?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      property_amenities: {
        Row: {
          property_id: string;
          amenity_id: string;
          created_at: string;
        };
        Insert: {
          property_id: string;
          amenity_id: string;
          created_at?: string;
        };
        Update: {
          property_id?: string;
          amenity_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'property_amenities_property_id_fkey';
            columns: ['property_id'];
            isOneToOne: false;
            referencedRelation: 'properties';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'property_amenities_amenity_id_fkey';
            columns: ['amenity_id'];
            isOneToOne: false;
            referencedRelation: 'amenities';
            referencedColumns: ['id'];
          }
        ];
      };
      owner_tour_availability: {
        Row: {
          id: string;
          owner_id: string;
          property_id: string | null;
          morning_slot_open: boolean;
          afternoon_slot_open: boolean;
          evening_slot_open: boolean;
          max_tours_per_day: number;
          blackout_dates: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          property_id?: string | null;
          morning_slot_open?: boolean;
          afternoon_slot_open?: boolean;
          evening_slot_open?: boolean;
          max_tours_per_day?: number;
          blackout_dates?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          property_id?: string | null;
          morning_slot_open?: boolean;
          afternoon_slot_open?: boolean;
          evening_slot_open?: boolean;
          max_tours_per_day?: number;
          blackout_dates?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'owner_tour_availability_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'owner_tour_availability_property_id_fkey';
            columns: ['property_id'];
            isOneToOne: false;
            referencedRelation: 'properties';
            referencedColumns: ['id'];
          }
        ];
      };
      bookings_visits: {
        Row: {
          id: string;
          property_id: string;
          student_id: string;
          owner_id: string;
          visit_date: string;
          time_slot: string;
          status: BookingStatus;
          notes: string | null;
          student_name: string;
          student_email: string | null;
          student_phone: string | null;
          cancellation_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          student_id: string;
          owner_id: string;
          visit_date: string;
          time_slot: string;
          status?: BookingStatus;
          notes?: string | null;
          student_name?: string;
          student_email?: string | null;
          student_phone?: string | null;
          cancellation_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          student_id?: string;
          owner_id?: string;
          visit_date?: string;
          time_slot?: string;
          status?: BookingStatus;
          notes?: string | null;
          student_name?: string;
          student_email?: string | null;
          student_phone?: string | null;
          cancellation_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bookings_visits_property_id_fkey';
            columns: ['property_id'];
            isOneToOne: false;
            referencedRelation: 'properties';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_visits_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_visits_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      shortlists: {
        Row: {
          student_id: string;
          property_id: string;
          created_at: string;
        };
        Insert: {
          student_id: string;
          property_id: string;
          created_at?: string;
        };
        Update: {
          student_id?: string;
          property_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'shortlists_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'shortlists_property_id_fkey';
            columns: ['property_id'];
            isOneToOne: false;
            referencedRelation: 'properties';
            referencedColumns: ['id'];
          }
        ];
      };
      reviews: {
        Row: {
          id: string;
          property_id: string;
          student_id: string;
          rating: number;
          comment: string;
          is_verified_resident: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          student_id: string;
          rating: number;
          comment: string;
          is_verified_resident?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          student_id?: string;
          rating?: number;
          comment?: string;
          is_verified_resident?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reviews_property_id_fkey';
            columns: ['property_id'];
            isOneToOne: false;
            referencedRelation: 'properties';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reviews_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      verification_documents: {
        Row: {
          id: string;
          property_id: string | null;
          owner_id: string;
          document_type: string;
          document_name: string;
          file_url: string;
          status: VerificationStatus;
          rejection_reason: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_id?: string | null;
          owner_id: string;
          document_type: string;
          document_name: string;
          file_url: string;
          status?: VerificationStatus;
          rejection_reason?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string | null;
          owner_id?: string;
          document_type?: string;
          document_name?: string;
          file_url?: string;
          status?: VerificationStatus;
          rejection_reason?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'verification_documents_property_id_fkey';
            columns: ['property_id'];
            isOneToOne: false;
            referencedRelation: 'properties';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'verification_documents_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'verification_documents_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      reports_flags: {
        Row: {
          id: string;
          reporter_id: string;
          target_type: ReportTargetType;
          target_id: string;
          target_name: string;
          reason: string;
          status: ReportStatus;
          admin_notes: string | null;
          resolved_by: string | null;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          target_type: ReportTargetType;
          target_id: string;
          target_name: string;
          reason: string;
          status?: ReportStatus;
          admin_notes?: string | null;
          resolved_by?: string | null;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reporter_id?: string;
          target_type?: ReportTargetType;
          target_id?: string;
          target_name?: string;
          reason?: string;
          status?: ReportStatus;
          admin_notes?: string | null;
          resolved_by?: string | null;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reports_flags_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_flags_resolved_by_fkey';
            columns: ['resolved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      support_tickets: {
        Row: {
          id: string;
          ticket_number: string;
          user_id: string | null;
          full_name: string;
          email: string;
          subject: string;
          message: string;
          status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          ticket_number: string;
          user_id?: string | null;
          full_name: string;
          email: string;
          subject: string;
          message: string;
          status?: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          ticket_number?: string;
          user_id?: string | null;
          full_name?: string;
          email?: string;
          subject?: string;
          message?: string;
          status?: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'support_tickets_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string;
          type: NotificationType;
          link_url: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          message: string;
          type?: NotificationType;
          link_url?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          message?: string;
          type?: NotificationType;
          link_url?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      premium_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          tier: SubscriptionTier;
          amount: number;
          currency: string;
          order_id: string;
          payment_gateway: string;
          gateway_payment_id: string | null;
          payment_method: string;
          status: PaymentStatus;
          valid_from: string | null;
          valid_until: string | null;
          invoice_url: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tier: SubscriptionTier;
          amount: number;
          currency?: string;
          order_id: string;
          payment_gateway?: string;
          gateway_payment_id?: string | null;
          payment_method: string;
          status?: PaymentStatus;
          valid_from?: string | null;
          valid_until?: string | null;
          invoice_url?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          tier?: SubscriptionTier;
          amount?: number;
          currency?: string;
          order_id?: string;
          payment_gateway?: string;
          gateway_payment_id?: string | null;
          payment_method?: string;
          status?: PaymentStatus;
          valid_from?: string | null;
          valid_until?: string | null;
          invoice_url?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'premium_subscriptions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      payment_transactions: {
        Row: {
          id: string;
          user_id: string;
          subscription_id: string | null;
          amount: number;
          currency: string;
          payment_gateway: string;
          gateway_order_id: string | null;
          gateway_payment_id: string | null;
          gateway_signature: string | null;
          status: PaymentStatus;
          error_code: string | null;
          error_description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subscription_id?: string | null;
          amount: number;
          currency?: string;
          payment_gateway: string;
          gateway_order_id?: string | null;
          gateway_payment_id?: string | null;
          gateway_signature?: string | null;
          status?: PaymentStatus;
          error_code?: string | null;
          error_description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subscription_id?: string | null;
          amount?: number;
          currency?: string;
          payment_gateway?: string;
          gateway_order_id?: string | null;
          gateway_payment_id?: string | null;
          gateway_signature?: string | null;
          status?: PaymentStatus;
          error_code?: string | null;
          error_description?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_transactions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payment_transactions_subscription_id_fkey';
            columns: ['subscription_id'];
            isOneToOne: false;
            referencedRelation: 'premium_subscriptions';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      notify_tour_students_property_deleted: {
        Args: {
          p_property_id: string;
          p_property_title: string;
        };
        Returns: number;
      };
    };
    Enums: {
      user_role: UserRole;
      property_gender_type: PropertyGenderType;
      booking_status: BookingStatus;
      verification_status: VerificationStatus;
      report_target_type: ReportTargetType;
      report_status: ReportStatus;
      subscription_tier: SubscriptionTier;
      payment_status: PaymentStatus;
      notification_type: NotificationType;
    };
  };
}
