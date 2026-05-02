mod commands;
mod db;
mod engines;
mod models;

pub use commands::install::InstallChild;
pub use commands::ollama::BatchRunning;
pub use commands::ollama::PromptLog;
pub use commands::ollama::RefineRunning;
use sqlx::SqlitePool;
use std::sync::{atomic::AtomicBool, Arc, Mutex};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(tauri_plugin_log::log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = app.get_webview_window("main").map(|w| w.set_focus());
        }))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?.to_string_lossy().to_string();
            let pool: SqlitePool = tauri::async_runtime::block_on(db::init_pool(&app_data_dir))?;
            app.manage(pool);
            app.manage(Arc::new(AtomicBool::new(false))); // cancel flag
            app.manage(BatchRunning(Arc::new(AtomicBool::new(false)))); // batch running flag
            app.manage(RefineRunning(Arc::new(AtomicBool::new(false)))); // refine running flag
            app.manage(PromptLog(Arc::new(Mutex::new(Vec::new())))); // prompt debug buffer
            app.manage(InstallChild(Arc::new(tokio::sync::Mutex::new(None)))); // install process handle
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::analyze::analyze_placeholders,
            commands::debug_export::export_debug_json,
            commands::debug_export::export_debug_review_json,
            commands::debug_export::export_debug_warning_json,
            commands::debug_export::export_debug_prompts_json,
            commands::ollama::check_ollama,
            commands::ollama::list_models,
            commands::ollama::translate_batch,
            commands::ollama::cancel_batch,
            commands::ollama::is_batch_running,
            commands::ollama::refine_batch,
            commands::ollama::is_refine_running,
            commands::ollama::cancel_refine,
            commands::entries::update_refined_manual,
            commands::project::create_project,
            commands::project::open_project,
            commands::project::get_projects,
            commands::project::get_projects_with_stats,
            commands::project::delete_project,
            commands::project::update_wolf_rpg_font,
            commands::extract::extract_strings,
            commands::entries::get_entries,
            commands::entries::get_file_stats,
            commands::entries::update_translation,
            commands::entries::update_status,
            commands::entries::reset_empty_translations,
            commands::entries::get_inconsistent_source_texts,
            commands::inject::inject_translations,
            commands::glossary::get_all_glossary_terms,
            commands::glossary::upsert_glossary_term,
            commands::glossary::delete_glossary_term,
            commands::glossary::delete_glossary_terms,
            commands::glossary::export_glossary,
            commands::glossary::import_glossary,
            commands::install::check_system_resources,
            commands::install::install_modelfile,
            commands::install::cancel_install,
            commands::install::delete_modelfile,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
