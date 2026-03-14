use sqlx::SqlitePool;
use uuid::Uuid;
use crate::db::queries;
use crate::engines::rpgmaker_mv_mz;
use crate::models::{ProjectFile, ProjectStats, EngineType};

fn build_project_file(
    project_id: &str,
    game_dir: &str,
    engine: EngineType,
    game_title: &str,
    target_lang: &str,
) -> ProjectFile {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    ProjectFile {
        version: "1".into(),
        project_id: project_id.into(),
        created_at: now,
        updated_at: now,
        game_dir: game_dir.into(),
        engine,
        game_title: game_title.into(),
        target_lang: target_lang.into(),
        stats: ProjectStats::default(),
        last_model: None,
        output_dir: format!("{}/hoshi-trans-output", game_dir),
    }
}

fn write_project_file(project: &ProjectFile, game_dir: &str, app_data_dir: &str) -> anyhow::Result<Option<String>> {
    let json = serde_json::to_string_pretty(project)?;
    let local_path = std::path::Path::new(game_dir).join("hoshi-trans.json");
    match std::fs::write(&local_path, &json) {
        Ok(_) => Ok(None),
        Err(_) => {
            let fallback_dir = std::path::Path::new(app_data_dir).join("projects");
            std::fs::create_dir_all(&fallback_dir)?;
            let fallback_path = fallback_dir.join(format!("{}.json", project.project_id));
            std::fs::write(&fallback_path, &json)?;
            Ok(Some(fallback_path.to_string_lossy().to_string()))
        }
    }
}

#[tauri::command]
pub async fn create_project(
    pool: tauri::State<'_, SqlitePool>,
    app: tauri::AppHandle,
    game_dir: String,
    target_lang: String,
) -> Result<ProjectFile, String> {
    use tauri::Manager;
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();

    let game_path = std::path::Path::new(&game_dir);

    let (engine_type, engine_str, game_title) = if rpgmaker_mv_mz::detect(game_path) {
        let title = rpgmaker_mv_mz::get_game_title(game_path)
            .unwrap_or_else(|_| "Unknown".into());
        (EngineType::RpgmakerMvMz, "rpgmaker_mv_mz", title)
    } else {
        return Err("Unsupported game engine — no recognized game files found".into());
    };

    let project_id = Uuid::new_v4().to_string();
    let project = build_project_file(&project_id, &game_dir, engine_type, &game_title, &target_lang);

    let json_path = write_project_file(&project, &game_dir, &app_data_dir)
        .map_err(|e| e.to_string())?;

    queries::create_project(
        &pool,
        &project_id,
        &game_dir,
        &engine_str,
        &game_title,
        &target_lang,
        json_path.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(project)
}

#[tauri::command]
pub async fn open_project(
    pool: tauri::State<'_, SqlitePool>,
    app: tauri::AppHandle,
    game_dir: String,
) -> Result<ProjectFile, String> {
    let local_json = std::path::Path::new(&game_dir).join("hoshi-trans.json");
    if local_json.exists() {
        let content = std::fs::read_to_string(&local_json).map_err(|e| e.to_string())?;
        let project: ProjectFile = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        return Ok(project);
    }

    create_project(pool, app, game_dir, "en".into()).await
}

#[tauri::command]
pub async fn delete_project(
    pool: tauri::State<'_, SqlitePool>,
    project_id: String,
    game_dir: String,
) -> Result<(), String> {
    queries::delete_project(&pool, &project_id)
        .await
        .map_err(|e| e.to_string())?;

    // Best-effort: remove hoshi-trans.json from game dir if it exists
    let json_path = std::path::Path::new(&game_dir).join("hoshi-trans.json");
    let _ = std::fs::remove_file(json_path);

    Ok(())
}

#[tauri::command]
pub async fn get_projects(
    pool: tauri::State<'_, SqlitePool>,
) -> Result<Vec<serde_json::Value>, String> {
    let rows = queries::get_projects(&pool)
        .await
        .map_err(|e| e.to_string())?;
    let result = rows
        .into_iter()
        .map(|(id, game_dir, engine, game_title, target_lang, json_path)| {
            serde_json::json!({
                "id": id,
                "game_dir": game_dir,
                "engine": engine,
                "game_title": game_title,
                "target_lang": target_lang,
                "json_path": json_path,
            })
        })
        .collect();
    Ok(result)
}
