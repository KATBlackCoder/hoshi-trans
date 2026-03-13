#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct TranslationEntry {
    pub id: String,
    pub project_id: String,
    pub source_text: String,
    pub translation: Option<String>,
    pub status: String, // stored as string in DB; use TranslationStatus for app logic
    pub context: Option<String>,
    pub file_path: String,
    pub order_index: i64, // CRITICAL for injection ordering
}

/// Rust enum for app logic — serialized as snake_case strings for IPC
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TranslationStatus {
    Pending,
    Translated,
    Reviewed,
    Skipped,
    Error(String),
    Warning(String),
}

impl TranslationStatus {
    pub fn as_db_str(&self) -> String {
        match self {
            Self::Pending => "pending".into(),
            Self::Translated => "translated".into(),
            Self::Reviewed => "reviewed".into(),
            Self::Skipped => "skipped".into(),
            Self::Error(msg) => format!("error:{}", msg),
            Self::Warning(msg) => format!("warning:{}", msg),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_status_serializes_to_snake_case() {
        let status = TranslationStatus::Pending;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, r#""pending""#);
    }

    #[test]
    fn test_error_status_serializes_with_data() {
        let status = TranslationStatus::Error("timeout".into());
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, r#"{"error":"timeout"}"#);
    }

    #[test]
    fn test_as_db_str() {
        assert_eq!(TranslationStatus::Pending.as_db_str(), "pending");
        assert_eq!(TranslationStatus::Error("x".into()).as_db_str(), "error:x");
    }
}
