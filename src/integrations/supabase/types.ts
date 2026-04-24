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
      areas: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      cobranca_outbox: {
        Row: {
          attempt_count: number
          condicao: number
          created_at: string
          dedup_key: string | null
          evolution_message_id: string | null
          external_id: string | null
          id: string
          last_error: string | null
          linha_digitavel: string | null
          link_boleto: string | null
          max_attempts: number
          message: string
          nome_fantasia: string | null
          phone: string | null
          phone_raw: string | null
          raw_payload: Json | null
          razao_social: string | null
          scheduled_at: string
          sent_at: string | null
          status: string
          updated_at: string
          valor_titulo: number | null
          vencimento: string | null
          worker_id: string | null
        }
        Insert: {
          attempt_count?: number
          condicao: number
          created_at?: string
          dedup_key?: string | null
          evolution_message_id?: string | null
          external_id?: string | null
          id?: string
          last_error?: string | null
          linha_digitavel?: string | null
          link_boleto?: string | null
          max_attempts?: number
          message: string
          nome_fantasia?: string | null
          phone?: string | null
          phone_raw?: string | null
          raw_payload?: Json | null
          razao_social?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          valor_titulo?: number | null
          vencimento?: string | null
          worker_id?: string | null
        }
        Update: {
          attempt_count?: number
          condicao?: number
          created_at?: string
          dedup_key?: string | null
          evolution_message_id?: string | null
          external_id?: string | null
          id?: string
          last_error?: string | null
          linha_digitavel?: string | null
          link_boleto?: string | null
          max_attempts?: number
          message?: string
          nome_fantasia?: string | null
          phone?: string | null
          phone_raw?: string | null
          raw_payload?: Json | null
          razao_social?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          valor_titulo?: number | null
          vencimento?: string | null
          worker_id?: string | null
        }
        Relationships: []
      }
      demanda_anexos: {
        Row: {
          autor_id: string
          created_at: string
          demanda_id: string
          id: string
          mime_type: string
          nome_arquivo: string
          storage_path: string
          tamanho_bytes: number
        }
        Insert: {
          autor_id: string
          created_at?: string
          demanda_id: string
          id?: string
          mime_type: string
          nome_arquivo: string
          storage_path: string
          tamanho_bytes: number
        }
        Update: {
          autor_id?: string
          created_at?: string
          demanda_id?: string
          id?: string
          mime_type?: string
          nome_arquivo?: string
          storage_path?: string
          tamanho_bytes?: number
        }
        Relationships: [
          {
            foreignKeyName: "demanda_anexos_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demanda_anexos_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demanda_anexos_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "vw_demandas_lista"
            referencedColumns: ["id"]
          },
        ]
      }
      demanda_comentarios: {
        Row: {
          autor_id: string
          conteudo: string
          created_at: string
          demanda_id: string
          edited_at: string | null
          id: string
        }
        Insert: {
          autor_id: string
          conteudo: string
          created_at?: string
          demanda_id: string
          edited_at?: string | null
          id?: string
        }
        Update: {
          autor_id?: string
          conteudo?: string
          created_at?: string
          demanda_id?: string
          edited_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demanda_comentarios_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demanda_comentarios_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demanda_comentarios_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "vw_demandas_lista"
            referencedColumns: ["id"]
          },
        ]
      }
      demanda_historico: {
        Row: {
          autor_id: string | null
          campo: string
          created_at: string
          demanda_id: string
          id: string
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          autor_id?: string | null
          campo: string
          created_at?: string
          demanda_id: string
          id?: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          autor_id?: string | null
          campo?: string
          created_at?: string
          demanda_id?: string
          id?: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demanda_historico_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demanda_historico_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demanda_historico_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "vw_demandas_lista"
            referencedColumns: ["id"]
          },
        ]
      }
      demanda_vinculos: {
        Row: {
          created_at: string
          created_by: string
          demanda_destino_id: string
          demanda_origem_id: string
          id: string
          tipo_vinculo: Database["public"]["Enums"]["tipo_vinculo"]
        }
        Insert: {
          created_at?: string
          created_by: string
          demanda_destino_id: string
          demanda_origem_id: string
          id?: string
          tipo_vinculo: Database["public"]["Enums"]["tipo_vinculo"]
        }
        Update: {
          created_at?: string
          created_by?: string
          demanda_destino_id?: string
          demanda_origem_id?: string
          id?: string
          tipo_vinculo?: Database["public"]["Enums"]["tipo_vinculo"]
        }
        Relationships: [
          {
            foreignKeyName: "demanda_vinculos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demanda_vinculos_demanda_destino_id_fkey"
            columns: ["demanda_destino_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demanda_vinculos_demanda_destino_id_fkey"
            columns: ["demanda_destino_id"]
            isOneToOne: false
            referencedRelation: "vw_demandas_lista"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demanda_vinculos_demanda_origem_id_fkey"
            columns: ["demanda_origem_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demanda_vinculos_demanda_origem_id_fkey"
            columns: ["demanda_origem_id"]
            isOneToOne: false
            referencedRelation: "vw_demandas_lista"
            referencedColumns: ["id"]
          },
        ]
      }
      demandas: {
        Row: {
          area_id: string
          closed_at: string | null
          codigo: string | null
          created_at: string
          deadline: string | null
          delivered_at: string | null
          descricao: string
          estimativa_horas: number | null
          id: string
          modulo_id: string
          prioridade: number
          reopen_deadline: string | null
          responsavel_id: string | null
          solicitante_id: string
          status: Database["public"]["Enums"]["status_demanda"]
          submodulo_id: string
          tipo: Database["public"]["Enums"]["tipo_demanda"]
          titulo: string
          updated_at: string
        }
        Insert: {
          area_id: string
          closed_at?: string | null
          codigo?: string | null
          created_at?: string
          deadline?: string | null
          delivered_at?: string | null
          descricao: string
          estimativa_horas?: number | null
          id?: string
          modulo_id: string
          prioridade: number
          reopen_deadline?: string | null
          responsavel_id?: string | null
          solicitante_id: string
          status?: Database["public"]["Enums"]["status_demanda"]
          submodulo_id: string
          tipo: Database["public"]["Enums"]["tipo_demanda"]
          titulo: string
          updated_at?: string
        }
        Update: {
          area_id?: string
          closed_at?: string | null
          codigo?: string | null
          created_at?: string
          deadline?: string | null
          delivered_at?: string | null
          descricao?: string
          estimativa_horas?: number | null
          id?: string
          modulo_id?: string
          prioridade?: number
          reopen_deadline?: string | null
          responsavel_id?: string | null
          solicitante_id?: string
          status?: Database["public"]["Enums"]["status_demanda"]
          submodulo_id?: string
          tipo?: Database["public"]["Enums"]["tipo_demanda"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demandas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_submodulo_id_fkey"
            columns: ["submodulo_id"]
            isOneToOne: false
            referencedRelation: "submodulos"
            referencedColumns: ["id"]
          },
        ]
      }
      modulos: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      perfis_acesso: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          permissoes: Database["public"]["Enums"]["app_permissao"][]
          sistema: boolean
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          permissoes?: Database["public"]["Enums"]["app_permissao"][]
          sistema?: boolean
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          permissoes?: Database["public"]["Enums"]["app_permissao"][]
          sistema?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          created_at: string
          id: string
          nome: string
          perfil_acesso_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          id: string
          nome: string
          perfil_acesso_id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          id?: string
          nome?: string
          perfil_acesso_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_perfil_acesso_id_fkey"
            columns: ["perfil_acesso_id"]
            isOneToOne: false
            referencedRelation: "perfis_acesso"
            referencedColumns: ["id"]
          },
        ]
      }
      submodulos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          modulo_id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          modulo_id: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          modulo_id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submodulos_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      cobranca_outbox_stats: {
        Row: {
          condicao: number | null
          dia: string | null
          status: string | null
          total: number | null
          valor_total: number | null
        }
        Relationships: []
      }
      vw_demandas_lista: {
        Row: {
          area_id: string | null
          area_nome: string | null
          closed_at: string | null
          codigo: string | null
          created_at: string | null
          deadline: string | null
          delivered_at: string | null
          descricao: string | null
          estimativa_horas: number | null
          id: string | null
          modulo_cor: string | null
          modulo_id: string | null
          modulo_nome: string | null
          prioridade: number | null
          reopen_deadline: string | null
          responsavel_avatar: string | null
          responsavel_id: string | null
          responsavel_nome: string | null
          solicitante_avatar: string | null
          solicitante_id: string | null
          solicitante_nome: string | null
          status: Database["public"]["Enums"]["status_demanda"] | null
          submodulo_id: string | null
          submodulo_nome: string | null
          tipo: Database["public"]["Enums"]["tipo_demanda"] | null
          titulo: string | null
          total_anexos: number | null
          total_comentarios: number | null
          total_vinculos: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demandas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_submodulo_id_fkey"
            columns: ["submodulo_id"]
            isOneToOne: false
            referencedRelation: "submodulos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      claim_next_cobranca_batch: {
        Args: { p_limit?: number; p_worker_id?: string }
        Returns: {
          attempt_count: number
          condicao: number
          id: string
          linha_digitavel: string
          link_boleto: string
          message: string
          nome_fantasia: string
          phone: string
          razao_social: string
          valor_titulo: number
          vencimento: string
        }[]
      }
      close_expired_demands: { Args: never; Returns: number }
      dashboard_metrics: { Args: never; Returns: Json }
      demanda_visivel: { Args: { p_demanda_id: string }; Returns: boolean }
      enqueue_cobranca: {
        Args: {
          p_condicao: number
          p_external_id: string
          p_linha_digitavel: string
          p_link_boleto: string
          p_message: string
          p_nome_fantasia: string
          p_phone: string
          p_phone_raw: string
          p_raw_payload?: Json
          p_razao_social: string
          p_valor_titulo: number
          p_vencimento: string
        }
        Returns: {
          id: string
          is_new: boolean
          status: string
        }[]
      }
      is_dev_gestor: { Args: never; Returns: boolean }
      list_usuarios_admin: {
        Args: never
        Returns: {
          ativo: boolean
          avatar_url: string
          created_at: string
          email: string
          id: string
          last_sign_in_at: string
          nome: string
          perfil_acesso_id: string
          perfil_acesso_nome: string
          permissoes: Database["public"]["Enums"]["app_permissao"][]
          updated_at: string
        }[]
      }
      mark_cobranca_failed: {
        Args: { p_error: string; p_id: string }
        Returns: undefined
      }
      mark_cobranca_sent: {
        Args: { p_evolution_message_id?: string; p_id: string }
        Returns: undefined
      }
      mark_cobranca_skipped: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      reabrir_demanda: {
        Args: { p_demanda_id: string; p_motivo: string }
        Returns: {
          area_id: string
          closed_at: string | null
          codigo: string | null
          created_at: string
          deadline: string | null
          delivered_at: string | null
          descricao: string
          estimativa_horas: number | null
          id: string
          modulo_id: string
          prioridade: number
          reopen_deadline: string | null
          responsavel_id: string | null
          solicitante_id: string
          status: Database["public"]["Enums"]["status_demanda"]
          submodulo_id: string
          tipo: Database["public"]["Enums"]["tipo_demanda"]
          titulo: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "demandas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      tem_permissao: {
        Args: { p_permissao: Database["public"]["Enums"]["app_permissao"] }
        Returns: boolean
      }
    }
    Enums: {
      app_permissao:
        | "criar_demanda"
        | "ver_todas_demandas"
        | "editar_qualquer_demanda"
        | "deletar_demanda"
        | "gerenciar_modulos"
        | "gerenciar_submodulos"
        | "gerenciar_areas"
        | "gerenciar_usuarios"
        | "gerenciar_perfis_acesso"
        | "ver_dashboard_metricas"
      app_role: "solicitante" | "dev_gestor"
      status_demanda:
        | "triagem"
        | "analise"
        | "desenvolvimento"
        | "teste"
        | "entregue"
        | "reaberta"
        | "encerrada"
        | "cancelada"
      tipo_demanda:
        | "erro"
        | "melhoria"
        | "nova_funcionalidade"
        | "duvida"
        | "tarefa"
      tipo_vinculo: "depende_de" | "bloqueia" | "relacionada" | "duplicada"
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
      app_permissao: [
        "criar_demanda",
        "ver_todas_demandas",
        "editar_qualquer_demanda",
        "deletar_demanda",
        "gerenciar_modulos",
        "gerenciar_submodulos",
        "gerenciar_areas",
        "gerenciar_usuarios",
        "gerenciar_perfis_acesso",
        "ver_dashboard_metricas",
      ],
      app_role: ["solicitante", "dev_gestor"],
      status_demanda: [
        "triagem",
        "analise",
        "desenvolvimento",
        "teste",
        "entregue",
        "reaberta",
        "encerrada",
        "cancelada",
      ],
      tipo_demanda: [
        "erro",
        "melhoria",
        "nova_funcionalidade",
        "duvida",
        "tarefa",
      ],
      tipo_vinculo: ["depende_de", "bloqueia", "relacionada", "duplicada"],
    },
  },
} as const
