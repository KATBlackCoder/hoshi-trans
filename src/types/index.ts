// Mirror types for Rust structs — must stay in sync with src-tauri/src/models/

export type EngineType = 'rpgmaker_mv_mz' | 'wolf_rpg' | 'bakin'

export type TranslationStatus =
  | 'pending'
  | 'translated'
  | 'reviewed'
  | 'skipped'
  | string  // covers "warning:missing_placeholder:X/Y", "error:...", etc.
  | { error: string }
  | { warning: string }

export interface ProjectStats {
  total: number
  translated: number
  reviewed: number
  skipped: number
  error: number
  pending: number
}

export interface ProjectFile {
  version: string
  project_id: string
  created_at: number
  updated_at: number
  game_dir: string
  engine: EngineType
  game_title: string
  target_lang: string
  stats: ProjectStats
  last_model: string | null
  output_dir: string
  wolf_rpg_font_size?: number | null
}

export type RefinedStatus = 'reviewed' | 'unchanged' | 'manual'

export interface TranslationEntry {
  id: string
  project_id: string
  source_text: string
  translation: string | null
  status: TranslationStatus
  context: string | null
  file_path: string
  order_index: number
  // Refine-pass fields — null before refine is run
  refined_text: string | null
  refined_status: RefinedStatus | null
  ph_count_source: number | null
  ph_count_draft: number | null
  ph_count_refined: number | null
  text_type: string | null
  refined_at: number | null
  translated_at: number | null
  prompt_tokens: number | null
  output_tokens: number | null
}

// Payload of the "translation:progress" Tauri event
export interface TranslationProgress {
  done: number
  total: number
  entry_id: string
}

export interface GlossaryTerm {
  id: string
  project_id: string | null  // null = global
  source_term: string
  target_term: string
  target_lang: string
}
