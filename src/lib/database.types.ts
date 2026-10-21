
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
                    "areas_tematicas": (string)[],"atualizado_em": string,"capa_url": string | null,"criado_em": string,"criado_por": string | null,"data_fim": string,"data_inicio": string,"descricao": string | null,"id": string,"inscricoes_abertas": boolean,"inscricoes_ate": string | null,"local": string | null,"resumo": string | null,"slug": string,"status": string,"submissao_instrucoes": string | null,"submissoes_abertas": boolean,"submissoes_ate": string | null,"titulo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "areas_tematicas"?: (string)[],"atualizado_em"?: string,"capa_url"?: string | null,"criado_em"?: string,"criado_por"?: string | null,"data_fim": string,"data_inicio": string,"descricao"?: string | null,"id"?: string,"inscricoes_abertas"?: boolean,"inscricoes_ate"?: string | null,"local"?: string | null,"resumo"?: string | null,"slug": string,"status"?: string,"submissao_instrucoes"?: string | null,"submissoes_abertas"?: boolean,"submissoes_ate"?: string | null,"titulo": string
                  }
                  Update: {
                    "areas_tematicas"?: (string)[],"atualizado_em"?: string,"capa_url"?: string | null,"criado_em"?: string,"criado_por"?: string | null,"data_fim"?: string,"data_inicio"?: string,"descricao"?: string | null,"id"?: string,"inscricoes_abertas"?: boolean,"inscricoes_ate"?: string | null,"local"?: string | null,"resumo"?: string | null,"slug"?: string,"status"?: string,"submissao_instrucoes"?: string | null,"submissoes_abertas"?: boolean,"submissoes_ate"?: string | null,"titulo"?: string
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
                    "atividade_id": string,"criado_em": string,"entrou_fila_em": string | null,"inscricao_id": string,"presenca_registrada_por": string | null,"presente_em": string | null,"promovida_em": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "atividade_id": string,"criado_em"?: string,"entrou_fila_em"?: string | null,"inscricao_id": string,"presenca_registrada_por"?: string | null,"presente_em"?: string | null,"promovida_em"?: string | null,"status"?: string
                  }
                  Update: {
                    "atividade_id"?: string,"criado_em"?: string,"entrou_fila_em"?: string | null,"inscricao_id"?: string,"presenca_registrada_por"?: string | null,"presente_em"?: string | null,"promovida_em"?: string | null,"status"?: string
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
                },"notificacoes_email": {
                  Row: {
                    "assunto": string,"corpo": string,"criada_em": string,"enviada_em": string | null,"id": number,"processando_em": string | null,"tentativas": number,"ultimo_erro": string | null,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assunto": string,"corpo": string,"criada_em"?: string,"enviada_em"?: string | null,"id"?: never,"processando_em"?: string | null,"tentativas"?: number,"ultimo_erro"?: string | null,"usuario_id": string
                  }
                  Update: {
                    "assunto"?: string,"corpo"?: string,"criada_em"?: string,"enviada_em"?: string | null,"id"?: never,"processando_em"?: string | null,"tentativas"?: number,"ultimo_erro"?: string | null,"usuario_id"?: string
                  }
                  Relationships: [
                    
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
                },"trabalhos": {
                  Row: {
                    "area": string | null,"arquivo_path": string | null,"atividade_id": string | null,"atualizado_em": string,"autor_id": string,"coautores": NonNullable<Json>,"criado_em": string,"decidido_em": string | null,"decidido_por": string | null,"evento_id": string,"id": string,"modalidade": string,"ordem_apresentacao": number | null,"palavras_chave": string | null,"parecer": string | null,"resumo": string,"status": string,"titulo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area"?: string | null,"arquivo_path"?: string | null,"atividade_id"?: string | null,"atualizado_em"?: string,"autor_id": string,"coautores"?: NonNullable<Json>,"criado_em"?: string,"decidido_em"?: string | null,"decidido_por"?: string | null,"evento_id": string,"id"?: string,"modalidade"?: string,"ordem_apresentacao"?: number | null,"palavras_chave"?: string | null,"parecer"?: string | null,"resumo": string,"status"?: string,"titulo": string
                  }
                  Update: {
                    "area"?: string | null,"arquivo_path"?: string | null,"atividade_id"?: string | null,"atualizado_em"?: string,"autor_id"?: string,"coautores"?: NonNullable<Json>,"criado_em"?: string,"decidido_em"?: string | null,"decidido_por"?: string | null,"evento_id"?: string,"id"?: string,"modalidade"?: string,"ordem_apresentacao"?: number | null,"palavras_chave"?: string | null,"parecer"?: string | null,"resumo"?: string,"status"?: string,"titulo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trabalhos_atividade_id_fkey"
      columns: ["atividade_id"]
isOneToOne: false
      referencedRelation: "atividades"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trabalhos_autor_id_fkey"
      columns: ["autor_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trabalhos_evento_id_fkey"
      columns: ["evento_id"]
isOneToOne: false
      referencedRelation: "eventos"
      referencedColumns: ["id"]
    }
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
"_enfileirar_email":
{ Args: { "p_assunto": string,"p_corpo": string,"p_usuario": string }; Returns: undefined
                           },
"_pode_apagar_arquivo":
{ Args: { "p_nome": string }; Returns: boolean
                           },
"_pode_enviar_arquivo":
{ Args: { "p_nome": string }; Returns: boolean
                           },
"_promover_fila":
{ Args: { "p_atividade_id": string }; Returns: number
                           },
"_submissoes_abertas":
{ Args: { "p_evento_id": string }; Returns: boolean
                           },
"_validar_trabalho":
{ Args: { "p_area": string,"p_coautores": Json,"p_evento_id": string }; Returns: Json
                           },
"caminho_arquivo_trabalho":
{ Args: { "p_trabalho_id": string }; Returns: string
                           },
"cancelar_inscricao":
{ Args: { "p_evento_id": string }; Returns: undefined
                           },
"concluir_email":
{ Args: { "p_erro"?: string,"p_id": number }; Returns: undefined
                           },
"confirmar_arquivo_trabalho":
{ Args: { "p_trabalho_id": string }; Returns: undefined
                           },
"decidir_trabalho":
{ Args: { "p_parecer"?: string,"p_status": string,"p_trabalho_id": string }; Returns: undefined
                           },
"editar_trabalho":
{ Args: { "p_area"?: string,"p_coautores"?: Json,"p_modalidade"?: string,"p_palavras_chave"?: string,"p_resumo": string,"p_titulo": string,"p_trabalho_id": string }; Returns: undefined
                           },
"eh_organizador":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"entrar_lista_espera":
{ Args: { "p_atividade_id": string }; Returns: number
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
"minhas_posicoes_fila":
{ Args: { "p_evento_id": string }; Returns: {
              "atividade_id": string,"posicao": number
            }[]
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
"reservar_emails":
{ Args: { "p_limite"?: number }; Returns: {
              "assunto": string,"corpo": string,"email": string,"id": number,"nome": string
            }[]
                           },
"retirar_trabalho":
{ Args: { "p_trabalho_id": string }; Returns: undefined
                           },
"sair_lista_espera":
{ Args: { "p_atividade_id": string }; Returns: undefined
                           },
"submeter_trabalho":
{ Args: { "p_area"?: string,"p_coautores"?: Json,"p_evento_id": string,"p_modalidade"?: string,"p_palavras_chave"?: string,"p_resumo": string,"p_titulo": string }; Returns: string
                           },
"trabalhos_da_programacao":
{ Args: { "p_evento_id": string }; Returns: {
              "area": string,"atividade_id": string,"autores": string,"modalidade": string,"ordem": number,"titulo": string,"trabalho_id": string
            }[]
                           },
"vagas_por_atividade":
{ Args: { "p_evento_id": string }; Returns: {
              "atividade_id": string,"fila": number,"ocupadas": number,"vagas": number
            }[]
                           },
"vincular_trabalho_sessao":
{ Args: { "p_atividade_id": string,"p_ordem"?: number,"p_trabalho_id": string }; Returns: undefined
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
