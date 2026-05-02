use tauri::Emitter;

#[derive(serde::Serialize, Clone)]
pub struct ModelfileProgress {
    pub line: String,
}

#[derive(serde::Serialize, Clone)]
pub struct ModelfileFallback {
    pub command: String,
}

#[tauri::command]
pub async fn install_modelfile(
    window: tauri::Window,
    model: String,
) -> Result<(), String> {
    let (content, model_name) = match model.as_str() {
        "4b" => (
            include_str!("../../modelfiles/hoshi-translator-4b.Modelfile"),
            "hoshi-translator-4b",
        ),
        "abliterated-4b" => (
            include_str!("../../modelfiles/hoshi-translator-abliterated-4b.Modelfile"),
            "hoshi-translator-abliterated-4b",
        ),
        "30b" => (
            include_str!("../../modelfiles/hoshi-translator-30b.Modelfile"),
            "hoshi-translator-30b",
        ),
        _ => return Err(format!("Unknown model: {}", model)),
    };

    let tmp_path = std::env::temp_dir().join(format!("hoshi-{}.Modelfile", model));
    std::fs::write(&tmp_path, content).map_err(|e| e.to_string())?;

    // Check if ollama is in PATH
    if std::process::Command::new("ollama").arg("--version").output().is_err() {
        let fallback_cmd = format!(
            "ollama create {} -f {}",
            model_name,
            tmp_path.to_string_lossy()
        );
        window
            .emit("modelfile:fallback", ModelfileFallback { command: fallback_cmd })
            .ok();
        return Ok(());
    }

    let tmp_path_str = tmp_path.to_string_lossy().to_string();
    let model_name_owned = model_name.to_string();
    let window_clone = window.clone();

    let (tx, mut rx) = tokio::sync::mpsc::channel::<Result<String, String>>(64);

    tokio::task::spawn_blocking(move || {
        use std::io::BufRead;
        use std::process::{Command, Stdio};

        let mut child = match Command::new("ollama")
            .args(["create", &model_name_owned, "-f", &tmp_path_str])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(c) => c,
            Err(e) => {
                let _ = tx.blocking_send(Err(e.to_string()));
                return;
            }
        };

        // ollama writes progress to stderr
        if let Some(stderr) = child.stderr.take() {
            for line in std::io::BufReader::new(stderr).lines() {
                match line {
                    Ok(l) => {
                        if tx.blocking_send(Ok(l)).is_err() {
                            break;
                        }
                    }
                    Err(e) => {
                        let _ = tx.blocking_send(Err(e.to_string()));
                        break;
                    }
                }
            }
        }

        let _ = child.wait();
    });

    while let Some(msg) = rx.recv().await {
        match msg {
            Ok(line) => {
                window_clone
                    .emit("modelfile:progress", ModelfileProgress { line })
                    .ok();
            }
            Err(e) => return Err(e),
        }
    }

    window_clone.emit("modelfile:done", model_name.to_string()).ok();
    Ok(())
}
