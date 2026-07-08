pub mod grpc;

use std::process::Command;
use std::sync::Mutex;
use tauri::Manager;
use grpc::GrpcState;

struct BackendProcess(Mutex<Option<std::process::Child>>);

fn find_player(player: &str) -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        let candidates = match player.to_lowercase().as_str() {
            "vlc" => vec![r"C:\Program Files\VideoLAN\VLC\vlc.exe", r"C:\Program Files (x86)\VideoLAN\VLC\vlc.exe"],
            "potplayer" => vec![r"C:\Program Files\DAUM\PotPlayer\PotPlayerMini64.exe", r"C:\Program Files (x86)\DAUM\PotPlayer\PotPlayerMini64.exe"],
            "mpc-hc" => vec![r"C:\Program Files\MPC-HC\mpc-hc64.exe", r"C:\Program Files (x86)\MPC-HC\mpc-hc64.exe"],
            "mpv" => vec![r"C:\Program Files\mpv\mpv.exe", r"C:\Program Files (x86)\mpv\mpv.exe"],
            _ => vec![],
        };
        for path in candidates { if std::path::Path::new(path).exists() { return Some(path.to_string()); } }
        if let Ok(p) = which::which(player) { return Some(p.to_string_lossy().to_string()); }
    }
    #[cfg(not(target_os = "windows"))]
    { if let Ok(p) = which::which(player) { return Some(p.to_string_lossy().to_string()); } }
    None
}

#[tauri::command]
fn launch_player(player: String, url: String) -> Result<String, String> {
    let exe = find_player(&player).ok_or_else(|| format!("未找到播放器: {}", player))?;
    Command::new(&exe).arg(&url).spawn().map_err(|e| format!("启动失败: {}", e))?;
    Ok(format!("已启动 {}", player))
}

#[tauri::command]
fn check_available_players() -> Vec<String> {
    ["vlc", "potplayer", "mpc-hc", "mpv"].iter().filter_map(|p| find_player(p).map(|_| p.to_string())).collect()
}

#[tauri::command]
fn open_in_system(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    { Command::new("cmd").args(["/C", "start", "", &url]).spawn().map_err(|e| format!("{}", e))?; }
    #[cfg(target_os = "macos")]
    { Command::new("open").arg(&url).spawn().map_err(|e| format!("{}", e))?; }
    #[cfg(target_os = "linux")]
    { Command::new("xdg-open").arg(&url).spawn().map_err(|e| format!("{}", e))?; }
    Ok(())
}

#[tauri::command]
fn get_platform() -> String { std::env::consts::OS.to_string() }

#[tauri::command]
fn read_clipboard() -> Result<String, String> {
    let mut cb = arboard::Clipboard::new().map_err(|e| format!("无法访问剪贴板: {}", e))?;
    cb.get_text().or_else(|_| Ok(String::new()))
}

// ===== gRPC Commands (using tokio::sync::Mutex for async safety) =====

#[tauri::command]
async fn grpc_set_config(url: String, token: Option<String>, state: tauri::State<'_, tokio::sync::Mutex<GrpcState>>) -> Result<(), String> {
    let s = state.lock().await;
    s.set_config(&url, token.as_deref());
    Ok(())
}

#[tauri::command]
async fn grpc_set_token(token: String, state: tauri::State<'_, tokio::sync::Mutex<GrpcState>>) -> Result<(), String> {
    let s = state.lock().await;
    s.set_token(&token);
    Ok(())
}

#[tauri::command]
async fn grpc_get_token(state: tauri::State<'_, tokio::sync::Mutex<GrpcState>>) -> Result<Option<String>, String> {
    let s = state.lock().await;
    Ok(s.get_token())
}

#[tauri::command]
async fn grpc_health(state: tauri::State<'_, tokio::sync::Mutex<GrpcState>>) -> Result<serde_json::Value, String> {
    let s = state.lock().await;
    Ok(serde_json::json!({"status":"ok","connected":s.is_connected()}))
}

#[tauri::command]
async fn grpc_call(method: String, params: serde_json::Value, state: tauri::State<'_, tokio::sync::Mutex<GrpcState>>) -> Result<serde_json::Value, String> {
    let s = state.lock().await;
    s.call(&method, params).await
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .manage(BackendProcess(Mutex::new(None)))
        .manage(tokio::sync::Mutex::new(GrpcState::new()))
        .invoke_handler(tauri::generate_handler![
            launch_player, check_available_players, open_in_system, get_platform, read_clipboard,
            grpc_set_config, grpc_set_token, grpc_get_token, grpc_health, grpc_call,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let state: tauri::State<BackendProcess> = window.state();
                let mut guard = state.0.lock().unwrap();
                if let Some(mut child) = guard.take() { let _ = child.kill(); }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
