/// Infer the text type of an entry from its file path.
///
/// Add new engine path patterns here when a new engine is integrated.
/// `db/queries.rs` and `commands/ollama.rs` both use this to decide
/// whether an entry is dialogue (context-dependent) or a standalone term.
pub fn infer_text_type(file_path: &str) -> &'static str {
    let lower = file_path.to_lowercase();
    let item_keywords = [
        "item", "weapon", "armor", "skill", "actor", "class", "enemy",
        "troop", "state", "アイテム", "武器", "防具", "スキル",
    ];
    let ui_keywords = ["system", "game.json"];
    let dialogue_keywords = ["mps/", "common/", "map"];

    // Dialogue path patterns are checked first — common/ and mps/ are always
    // dialogue regardless of filename content (e.g. アイテム増減 common event).
    if dialogue_keywords.iter().any(|k| lower.contains(k)) {
        "dialogue"
    } else if item_keywords.iter().any(|k| lower.contains(k)) {
        "item"
    } else if ui_keywords.iter().any(|k| lower.contains(k)) {
        "ui"
    } else {
        "general"
    }
}
