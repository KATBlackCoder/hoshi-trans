mod commands;
mod db;
mod models;

use sqlx::SqlitePool;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()?
                .to_string_lossy()
                .to_string();
            let pool: SqlitePool = tauri::async_runtime::block_on(
                db::init_pool(&app_data_dir)
            )?;
            app.manage(pool);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::ollama::check_ollama,
            commands::ollama::list_models,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
