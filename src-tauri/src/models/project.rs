#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProjectFile {
    pub version: String,
    pub project_id: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub game_dir: String,
    pub engine: EngineType,
    pub game_title: String,
    pub target_lang: String,
    pub stats: ProjectStats,
    pub last_model: Option<String>,
    pub output_dir: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default)]
pub struct ProjectStats {
    pub total: u32,
    pub translated: u32,
    pub reviewed: u32,
    pub skipped: u32,
    pub error: u32,
    pub pending: u32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EngineType {
    RpgmakerMvMz,
    WolfRpg,
    Bakin,
}

impl std::fmt::Display for EngineType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::RpgmakerMvMz => write!(f, "rpgmaker_mv_mz"),
            Self::WolfRpg => write!(f, "wolf_rpg"),
            Self::Bakin => write!(f, "bakin"),
        }
    }
}
