mod commands;
mod db;
mod engines;
mod models;

use sqlx::SqlitePool;
use std::sync::{Arc, atomic::AtomicBool};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            app.manage(Arc::new(AtomicBool::new(false)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::ollama::check_ollama,
            commands::ollama::list_models,
            commands::ollama::translate_batch,
            commands::ollama::cancel_batch,
            commands::project::create_project,
            commands::project::open_project,
            commands::project::get_projects,
            commands::extract::extract_strings,
            commands::entries::get_entries,
            commands::entries::update_translation,
            commands::entries::update_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
