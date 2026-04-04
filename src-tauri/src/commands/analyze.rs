use crate::db::queries;
use crate::engines::{rpgmaker_mv_mz::placeholders as rpgmaker_ph, wolf_rpg::placeholders as wolf_ph};
use sqlx::SqlitePool;

/// Re-analyze placeholder counts for all translated/warning entries.
/// Updates status to:
///   - "translated"                       if source count == translation count
///   - "warning:missing_placeholder:X/Y"  if mismatch (X present out of Y expected)
/// Returns the number of entries whose status changed.
#[tauri::command]
pub async fn analyze_placeholders(
    pool: tauri::State<'_, SqlitePool>,
    project_id: String,
) -> Result<u32, String> {
    let engine = queries::get_project_engine_by_id(pool.inner(), &project_id)
        .await
        .map_err(|e| e.to_string())?
        .unwrap_or_default();
    let is_wolf = engine == "wolf_rpg";

    let entries = queries::get_translated_entries_ordered(pool.inner(), &project_id)
        .await
        .map_err(|e| e.to_string())?;

    let mut updated = 0u32;

    for entry in entries {
        let translation = match &entry.translation {
            Some(t) if !t.is_empty() => t.clone(),
            _ => continue,
        };

        let (_, source_map) = if is_wolf {
            wolf_ph::extract_native(&entry.source_text)
        } else {
            rpgmaker_ph::extract_native(&entry.source_text)
        };
        let (_, trans_map) = if is_wolf {
            wolf_ph::extract_native(&translation)
        } else {
            rpgmaker_ph::extract_native(&translation)
        };

        let source_count = source_map.len();
        let trans_count = trans_map.len();

        let new_status = if source_count == trans_count {
            "translated".to_string()
        } else {
            format!("warning:missing_placeholder:{}/{}", trans_count, source_count)
        };

        if entry.status != new_status {
            queries::update_status(pool.inner(), &entry.id, &new_status)
                .await
                .map_err(|e| e.to_string())?;
            updated += 1;
        }
    }

    Ok(updated)
}
