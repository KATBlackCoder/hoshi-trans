use std::sync::Arc;
use tauri::{Emitter, State};
use tokio::sync::Mutex;

pub struct InstallChild(pub Arc<Mutex<Option<tokio::process::Child>>>);

#[derive(serde::Serialize, Clone)]
pub struct ModelfileProgress {
    pub line: String,
}

#[derive(serde::Serialize, Clone)]
pub struct ModelfileFallback {
    pub command: String,
}

#[derive(serde::Serialize)]
pub struct ResourceCheck {
    pub disk_free_gb: f32,
    pub ram_total_gb: f32,
    pub vram_free_gb: Option<f32>,
    pub required_disk_gb: f32,
    pub required_vram_gb: f32,
    pub disk_ok: bool,
    pub vram_ok: Option<bool>,
}

fn model_requirements(model: &str) -> (f32, f32) {
    // (required_disk_gb, required_vram_gb)
    match model {
        "4b" => (5.0, 4.0),
        "abliterated-4b" => (9.0, 8.0),
        "30b" => (21.0, 24.0),
        _ => (5.0, 4.0),
    }
}

fn get_disk_free_gb() -> f32 {
    use sysinfo::Disks;
    let disks = Disks::new_with_refreshed_list();
    let temp = std::env::temp_dir();
    let temp_str = temp.to_string_lossy().to_string();
    // Find the mount point that is a prefix of the temp dir
    let mut best: Option<(usize, u64)> = None;
    for disk in &disks {
        let mount = disk.mount_point().to_string_lossy().to_string();
        if temp_str.starts_with(&mount) && mount.len() > best.map(|(l, _)| l).unwrap_or(0) {
            best = Some((mount.len(), disk.available_space()));
        }
    }
    best.map(|(_, b)| b).unwrap_or_else(|| {
        disks.iter().map(|d| d.available_space()).max().unwrap_or(0)
    }) as f32 / 1_073_741_824.0
}

fn get_vram_free_gb() -> Option<f32> {
    let output = std::process::Command::new("nvidia-smi")
        .args(["--query-gpu=memory.free", "--format=csv,noheader,nounits"])
        .output()
        .ok()?;
    let s = String::from_utf8_lossy(&output.stdout);
    let mib: f32 = s.trim().lines().next()?.trim().parse().ok()?;
    Some(mib / 1024.0)
}

#[tauri::command]
pub async fn check_system_resources(model: String) -> Result<ResourceCheck, String> {
    use sysinfo::System;
    let mut sys = System::new();
    sys.refresh_memory();
    let ram_total_gb = sys.total_memory() as f32 / 1_073_741_824.0;
    let disk_free_gb = get_disk_free_gb();
    let vram_free_gb = get_vram_free_gb();
    let (required_disk_gb, required_vram_gb) = model_requirements(&model);
    let disk_ok = disk_free_gb >= required_disk_gb;
    let vram_ok = vram_free_gb.map(|v| v >= required_vram_gb);
    Ok(ResourceCheck {
        disk_free_gb,
        ram_total_gb,
        vram_free_gb,
        required_disk_gb,
        required_vram_gb,
        disk_ok,
        vram_ok,
    })
}

#[tauri::command]
pub async fn install_modelfile(
    window: tauri::Window,
    install_child: State<'_, InstallChild>,
    model: String,
) -> Result<(), String> {
    use tokio::io::AsyncBufReadExt;

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
    let model_name_str = model_name.to_string();

    let mut child = tokio::process::Command::new("ollama")
        .args(["create", &model_name_str, "-f", &tmp_path_str])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    let stderr = child.stderr.take().ok_or("no stderr")?;

    // Store child so cancel_install can kill it
    *install_child.0.lock().await = Some(child);

    let mut lines = tokio::io::BufReader::new(stderr).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        window
            .emit("modelfile:progress", ModelfileProgress { line })
            .ok();
    }

    // Take child back — if None, cancel_install already killed it
    let maybe_child = install_child.0.lock().await.take();
    match maybe_child {
        Some(mut c) => {
            let _ = c.wait().await;
            window.emit("modelfile:done", model_name_str).ok();
        }
        None => {
            // Cancelled
            window.emit("modelfile:cancelled", ()).ok();
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn cancel_install(
    install_child: State<'_, InstallChild>,
) -> Result<(), String> {
    let mut guard = install_child.0.lock().await;
    if let Some(mut child) = guard.take() {
        child.kill().await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_modelfile(
    window: tauri::Window,
    model: String,
) -> Result<(), String> {
    let model_name = match model.as_str() {
        "4b" => "hoshi-translator-4b",
        "abliterated-4b" => "hoshi-translator-abliterated-4b",
        "30b" => "hoshi-translator-30b",
        _ => return Err(format!("Unknown model: {}", model)),
    };

    let output = tokio::process::Command::new("ollama")
        .args(["rm", model_name])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        window.emit("modelfile:deleted", model_name.to_string()).ok();
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}
