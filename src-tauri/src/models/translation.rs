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
    // Refine-pass fields (all nullable — None before refine is run)
    pub refined_text: Option<String>,
    pub refined_status: Option<String>,
    pub ph_count_source: Option<i64>,
    pub ph_count_draft: Option<i64>,
    pub ph_count_refined: Option<i64>,
    pub text_type: Option<String>,
    pub refined_at: Option<i64>,
    pub translated_at: Option<i64>,
    pub prompt_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct FileStats {
    pub file_path: String,
    pub total: i64,
    pub translated: i64,
    pub warning: i64,
    pub pending: i64,
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

/// Status of the refine pass for an entry.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RefinedStatus {
    /// Thinking model changed at least one character.
    Reviewed,
    /// Thinking model returned identical text — draft was already correct.
    Unchanged,
    /// User manually edited the refined_text.
    Manual,
}

impl RefinedStatus {
    pub fn as_db_str(&self) -> &'static str {
        match self {
            Self::Reviewed  => "reviewed",
            Self::Unchanged => "unchanged",
            Self::Manual    => "manual",
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

    #[test]
    fn test_refined_status_reviewed_str() {
        assert_eq!(RefinedStatus::Reviewed.as_db_str(), "reviewed");
    }

    #[test]
    fn test_refined_status_unchanged_str() {
        assert_eq!(RefinedStatus::Unchanged.as_db_str(), "unchanged");
    }

    #[test]
    fn test_refined_status_manual_str() {
        assert_eq!(RefinedStatus::Manual.as_db_str(), "manual");
    }
}
