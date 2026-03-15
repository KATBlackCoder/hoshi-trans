use std::path::Path;
use tauri_plugin_shell::ShellExt;

/// Run UberWolfCli to decrypt the game files into output_dir
pub async fn run_uberwolf(
    app: &tauri::AppHandle,
    game_dir: &Path,
    output_dir: &Path,
) -> anyhow::Result<()> {
    let (mut rx, _child) = app
        .shell()
        .sidecar("UberWolfCli")?
        .args([game_dir.to_str().unwrap(), output_dir.to_str().unwrap()])
        .spawn()?;

    while let Some(event) = rx.recv().await {
        use tauri_plugin_shell::process::CommandEvent;
        match event {
            CommandEvent::Stderr(line) => {
                tracing::warn!("UberWolfCli stderr: {}", String::from_utf8_lossy(&line));
            }
            CommandEvent::Error(e) => {
                return Err(anyhow::anyhow!("UberWolfCli error: {}", e));
            }
            CommandEvent::Terminated(status) => {
                if status.code != Some(0) {
                    return Err(anyhow::anyhow!(
                        "UberWolfCli exited with code {:?}",
                        status.code
                    ));
                }
                break;
            }
            _ => {}
        }
    }
    Ok(())
}

/// Run WolfTL to dump game data to JSON files in json_output_dir
pub async fn run_wolftl_dump(
    app: &tauri::AppHandle,
    game_dir: &Path,
    json_output_dir: &Path,
) -> anyhow::Result<()> {
    let (mut rx, _child) = app
        .shell()
        .sidecar("WolfTL")?
        .args([
            "dump",
            game_dir.to_str().unwrap(),
            json_output_dir.to_str().unwrap(),
        ])
        .spawn()?;

    while let Some(event) = rx.recv().await {
        use tauri_plugin_shell::process::CommandEvent;
        if let CommandEvent::Terminated(status) = event {
            if status.code != Some(0) {
                return Err(anyhow::anyhow!(
                    "WolfTL dump failed: code {:?}",
                    status.code
                ));
            }
            break;
        }
    }
    Ok(())
}

/// Run WolfTL to patch translated JSON back into game files
pub async fn run_wolftl_patch(
    app: &tauri::AppHandle,
    game_dir: &Path,
    json_dir: &Path,
    output_dir: &Path,
) -> anyhow::Result<()> {
    let (mut rx, _child) = app
        .shell()
        .sidecar("WolfTL")?
        .args([
            "patch",
            game_dir.to_str().unwrap(),
            json_dir.to_str().unwrap(),
            output_dir.to_str().unwrap(),
        ])
        .spawn()?;

    while let Some(event) = rx.recv().await {
        use tauri_plugin_shell::process::CommandEvent;
        if let CommandEvent::Terminated(status) = event {
            if status.code != Some(0) {
                return Err(anyhow::anyhow!(
                    "WolfTL patch failed: code {:?}",
                    status.code
                ));
            }
            break;
        }
    }
    Ok(())
}
