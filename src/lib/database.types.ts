
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "atividades": {
                  Row: {
                    "atualizado_em": string,"carga_horaria_minutos": number,"criado_em": string,"descricao": string | null,"evento_id": string,"fim": string,"id": string,"inicio": string,"local": string | null,"palestrantes": string | null,"preco_centavos": number,"tipo": string,"titulo": string,"vagas": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"carga_horaria_minutos": number,"criado_em"?: string,"descricao"?: string | null,"evento_id": string,"fim": string,"id"?: string,"inicio": string,"local"?: string | null,"palestrantes"?: string | null,"preco_centavos"?: number,"tipo"?: string,"titulo": string,"vagas"?: number | null
                  }
                  Update: {
                    "atualizado_em"?: string,"carga_horaria_minutos"?: number,"criado_em"?: string,"descricao"?: string | null,"evento_id"?: string,"fim"?: string,"id"?: string,"inicio"?: string,"local"?: string | null,"palestrantes"?: string | null,"preco_centavos"?: number,"tipo"?: string,"titulo"?: string,"vagas"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "atividades_evento_id_fkey"
      columns: ["evento_id"]
isOneToOne: false
      referencedRelation: "eventos"
      referencedColumns: ["id"]
    }
                  ]
                },"auditoria": {
                  Row: {
                    "acao": string,"criado_em": string,"detalhes": NonNullable<Json>,"id": number,"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "acao": string,"criado_em"?: string,"detalhes"?: NonNullable<Json>,"id"?: never,"usuario_id"?: string | null
                  }
                  Update: {
                    "acao"?: string,"criado_em"?: string,"detalhes"?: NonNullable<Json>,"id"?: never,"usuario_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"eventos": {
                  Row: {
                    "atualizado_em": string,"capa_url": string | null,"criado_em": string,"criado_por": string | null,"data_fim": string,"data_inicio": string,"descricao": string | null,"id": string,"inscricoes_abertas": boolean,"inscricoes_ate": string | null,"local": string | null,"resumo": string | null,"slug": string,"status": string,"titulo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"capa_url"?: string | null,"criado_em"?: string,"criado_por"?: string | null,"data_fim": string,"data_inicio": string,"descricao"?: string | null,"id"?: string,"inscricoes_abertas"?: boolean,"inscricoes_ate"?: string | null,"local"?: string | null,"resumo"?: string | null,"slug": string,"status"?: string,"titulo": string
                  }
                  Update: {
                    "atualizado_em"?: string,"capa_url"?: string | null,"criado_em"?: string,"criado_por"?: string | null,"data_fim"?: string,"data_inicio"?: string,"descricao"?: string | null,"id"?: string,"inscricoes_abertas"?: boolean,"inscricoes_ate"?: string | null,"local"?: string | null,"resumo"?: string | null,"slug"?: string,"status"?: string,"titulo"?: string
                  }
                  Relationships: [
                    
                  ]
                },"inscricoes": {
                  Row: {
                    "cancelada_em": string | null,"codigo": string,"criado_em": string,"evento_id": string,"id": string,"status": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelada_em"?: string | null,"codigo"?: string,"criado_em"?: string,"evento_id": string,"id"?: string,"status"?: string,"usuario_id": string
                  }
                  Update: {
                    "cancelada_em"?: string | null,"codigo"?: string,"criado_em"?: string,"evento_id"?: string,"id"?: string,"status"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inscricoes_evento_id_fkey"
      columns: ["evento_id"]
isOneToOne: false
      referencedRelation: "eventos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inscricoes_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    }
                  ]
                },"inscricoes_atividades": {
                  Row: {
                    "atividade_id": string,"criado_em": string,"inscricao_id": string,"presenca_registrada_por": string | null,"presente_em": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "atividade_id": string,"criado_em"?: string,"inscricao_id": string,"presenca_registrada_por"?: string | null,"presente_em"?: string | null,"status"?: string
                  }
                  Update: {
                    "atividade_id"?: string,"criado_em"?: string,"inscricao_id"?: string,"presenca_registrada_por"?: string | null,"presente_em"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inscricoes_atividades_atividade_id_fkey"
      columns: ["atividade_id"]
isOneToOne: false
      referencedRelation: "atividades"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inscricoes_atividades_inscricao_id_fkey"
      columns: ["inscricao_id"]
isOneToOne: false
      referencedRelation: "inscricoes"
      referencedColumns: ["id"]
    }
                  ]
                },"organizadores": {
                  Row: {
                    "ativo": boolean,"criado_em": string,"email": string,"nome": string | null,"papel": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo"?: boolean,"criado_em"?: string,"email": string,"nome"?: string | null,"papel"?: string
                  }
                  Update: {
                    "ativo"?: boolean,"criado_em"?: string,"email"?: string,"nome"?: string | null,"papel"?: string
                  }
                  Relationships: [
                    
                  ]
                },"perfis": {
                  Row: {
                    "atualizado_em": string,"criado_em": string,"curso": string | null,"email": string,"id": string,"nome_completo": string,"rga": string | null,"telefone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"criado_em"?: string,"curso"?: string | null,"email": string,"id": string,"nome_completo": string,"rga"?: string | null,"telefone"?: string | null
                  }
                  Update: {
                    "atualizado_em"?: string,"criado_em"?: string,"curso"?: string | null,"email"?: string,"id"?: string,"nome_completo"?: string,"rga"?: string | null,"telefone"?: string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "_adicionar_atividades":
{ Args: { "p_atividades": (string)[],"p_evento_id": string,"p_inscricao_id": string }; Returns: undefined
                           },
"cancelar_inscricao":
{ Args: { "p_evento_id": string }; Returns: undefined
                           },
"eh_organizador":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"inscrever_em_evento":
{ Args: { "p_atividades"?: (string)[],"p_evento_id": string }; Returns: string
                           },
"marcar_presenca_manual":
{ Args: { "p_atividade_id": string,"p_inscricao_id": string,"p_presente": boolean }; Returns: string
                           },
"meu_papel":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"registrar_auditoria":
{ Args: { "p_acao": string,"p_detalhes"?: Json }; Returns: undefined
                           },
"registrar_presenca":
{ Args: { "p_atividade_id": string,"p_codigo": string,"p_incluir"?: boolean }; Returns: {
              "inscricao_id": string,"nome": string,"presente_em": string,"resultado": string,"rga": string
            }[]
                           },
"remover_atividade":
{ Args: { "p_atividade_id": string }; Returns: undefined
                           },
"vagas_por_atividade":
{ Args: { "p_evento_id": string }; Returns: {
              "atividade_id": string,"ocupadas": number,"vagas": number
            }[]
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
