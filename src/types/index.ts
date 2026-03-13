// Mirror types for Rust structs — must stay in sync with src-tauri/src/models/

export type EngineType = 'rpgmaker_mv_mz' | 'wolf_rpg' | 'bakin'

export type TranslationStatus =
  | 'pending'
  | 'translated'
  | 'reviewed'
  | 'skipped'
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
}

export interface TranslationEntry {
  id: string
  project_id: string
  source_text: string
  translation: string | null
  status: TranslationStatus
  context: string | null
  file_path: string
  order_index: number
}

// Payload of the "translation:progress" Tauri event
export interface TranslationProgress {
  done: number
  total: number
  entry_id: string
}
