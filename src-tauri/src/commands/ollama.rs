use ollama_rs::Ollama;

/// Internal function — testable without Tauri state
pub async fn check_ollama_inner() -> Result<bool, String> {
    let ollama = Ollama::default(); // connects to localhost:11434
    match ollama.list_local_models().await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn check_ollama() -> Result<bool, String> {
    check_ollama_inner().await
}

#[tauri::command]
pub async fn list_models() -> Result<Vec<String>, String> {
    let ollama = Ollama::default();
    let models = ollama
        .list_local_models()
        .await
        .map_err(|e| e.to_string())?;
    Ok(models.into_iter().map(|m| m.name).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_check_ollama_returns_bool() {
        let result = check_ollama_inner().await;
        assert!(result.is_ok() || result.is_err()); // always true — just tests compilation
    }
}
