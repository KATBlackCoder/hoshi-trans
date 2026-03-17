#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct GlossaryTerm {
    pub id: String,
    pub project_id: Option<String>,
    pub source_term: String,
    pub target_term: String,
    pub target_lang: String,
}
