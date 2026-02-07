export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          type: 'video' | 'article'
          icon: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          type: 'video' | 'article'
          icon?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          type?: 'video' | 'article'
          icon?: string | null
          sort_order?: number
          created_at?: string
        }
      }
      posts: {
        Row: {
          id: string
          title: string
          slug: string
          excerpt: string | null
          content: string | null
          cover_image: string | null
          category_id: string | null
          type: 'video' | 'article'
          video_url: string | null
          external_link: string | null
          status: 'published' | 'draft'
          view_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          excerpt?: string | null
          content?: string | null
          cover_image?: string | null
          category_id?: string | null
          type: 'video' | 'article'
          video_url?: string | null
          external_link?: string | null
          status?: 'published' | 'draft'
          view_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          slug?: string
          excerpt?: string | null
          content?: string | null
          cover_image?: string | null
          category_id?: string | null
          type?: 'video' | 'article'
          video_url?: string | null
          external_link?: string | null
          status?: 'published' | 'draft'
          view_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      tags: {
        Row: {
          id: string
          name: string
          slug: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          created_at?: string
        }
      }
      post_tags: {
        Row: {
          post_id: string
          tag_id: string
        }
        Insert: {
          post_id: string
          tag_id: string
        }
        Update: {
          post_id?: string
          tag_id?: string
        }
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
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]
