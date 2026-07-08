use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::Manager;

struct BackendProcess(Mutex<Option<std::process::Child>>);

/// Find the path to a media player executable on the system.
fn find_player(player: &str) -> Option<String> {
    // Common install locations on Windows
    #[cfg(target_os = "windows")]
    {
        let candidates = match player.to_lowercase().as_str() {
            "vlc" => vec![
                r"C:\Program Files\VideoLAN\VLC\vlc.exe",
                r"C:\Program Files (x86)\VideoLAN\VLC\vlc.exe",
            ],
            "potplayer" => vec![
                r"C:\Program Files\DAUM\PotPlayer\PotPlayerMini64.exe",
                r"C:\Program Files (x86)\DAUM\PotPlayer\PotPlayerMini64.exe",
                r"C:\Program Files\PotPlayer\PotPlayerMini64.exe",
            ],
            "mpc-hc" => vec![
                r"C:\Program Files\MPC-HC\mpc-hc64.exe",
                r"C:\Program Files (x86)\MPC-HC\mpc-hc64.exe",
                r"C:\Program Files\MPC-BE\mpc-be64.exe",
            ],
            "mpv" => vec![
                r"C:\Program Files\mpv\mpv.exe",
                r"C:\Program Files (x86)\mpv\mpv.exe",
            ],
            _ => vec![],
        };

        for path in candidates {
            if std::path::Path::new(path).exists() {
                return Some(path.to_string());
            }
        }

        // Also try `which` to find on PATH
        if let Ok(p) = which::which(player) {
            return Some(p.to_string_lossy().to_string());
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(p) = which::which(player) {
            return Some(p.to_string_lossy().to_string());
        }
    }

    None
}

/// Launch an external media player with a given URL/path.
#[tauri::command]
fn launch_player(player: String, url: String) -> Result<String, String> {
    let exe_path = find_player(&player).ok_or_else(|| {
        format!(
            "未找到播放器: {}。请确保已安装并添加到系统PATH，或在默认安装路径中。",
            player
        )
    })?;

    Command::new(&exe_path)
        .arg(&url)
        .spawn()
        .map_err(|e| format!("启动播放器失败: {}", e))?;

    Ok(format!("已启动 {} 播放: {}", player, url))
}

/// Check which media players are available on the system.
#[tauri::command]
fn check_available_players() -> Vec<String> {
    let players = vec!["vlc", "potplayer", "mpc-hc", "mpv"];
    players
        .iter()
        .filter_map(|p| {
            if find_player(p).is_some() {
                Some(p.to_string())
            } else {
                None
            }
        })
        .collect()
}

/// Open a URL or file path using the system default application.
#[tauri::command]
fn open_in_system(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| format!("打开失败: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("打开失败: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("打开失败: {}", e))?;
    }
    Ok(())
}

/// Get the platform OS name.
#[tauri::command]
fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

/// Read the current text content of the system clipboard.
/// Returns an empty string if the clipboard is empty or not text.
#[tauri::command]
fn read_clipboard() -> Result<String, String> {
    let mut clipboard = arboard::Clipboard::new()
        .map_err(|e| format!("无法访问剪贴板: {}", e))?;
    clipboard.get_text().or_else(|_| Ok(String::new()))
}

/// Try to start the Node.js backend from a given directory that contains server.js.
fn try_start_backend_from(dir: &std::path::Path) -> Option<std::process::Child> {
    let server_js = dir.join("server.js");
    if !server_js.exists() {
        return None;
    }

    // Ensure node_modules are installed
    let npm_dir = dir.join("node_modules");
    if !npm_dir.exists() {
        let _ = Command::new("npm")
            .arg("install")
            .arg("--production")
            .current_dir(dir)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }

    Command::new("node")
        .arg("server.js")
        .current_dir(dir)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .ok()
}

/// Start the Node.js backend server.
/// Tries: 1) bundled resources dir, 2) portable mode (exe's own dir), 3) development mode.
fn start_backend(app: &tauri::App) -> Option<std::process::Child> {
    // 1. Try production mode: look for bundled server.js in resources
    if let Ok(resource_dir) = app.path().resource_dir() {
        if let Some(child) = try_start_backend_from(&resource_dir) {
            return Some(child);
        }
    }

    // 2. Try portable mode: look for server.js next to the executable
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            // Check exe directory itself
            if let Some(child) = try_start_backend_from(exe_dir) {
                return Some(child);
            }
            // Check a "backend" subdirectory next to the exe
            let backend_subdir = exe_dir.join("backend");
            if let Some(child) = try_start_backend_from(&backend_subdir) {
                return Some(child);
            }
        }
    }

    // 3. Development mode: run npm run backend from the project root
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default();
    let project_root = if manifest_dir.is_empty() {
        std::path::PathBuf::from(".")
    } else {
        std::path::PathBuf::from(&manifest_dir)
            .parent()
            .unwrap_or(std::path::Path::new("."))
            .to_path_buf()
    };

    let child = Command::new("npm")
        .arg("run")
        .arg("backend")
        .current_dir(&project_root)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .ok();
    child
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .manage(BackendProcess(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            launch_player,
            check_available_players,
            open_in_system,
            get_platform,
            read_clipboard,
        ])
        .setup(|app| {
            // Start the Node.js backend server
            if let Some(child) = start_backend(app) {
                let state: tauri::State<BackendProcess> = app.state();
                *state.0.lock().unwrap() = Some(child);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // Kill the backend process when the window is closed
                let state: tauri::State<BackendProcess> = window.state();
                let child = {
                    let mut guard = state.0.lock().unwrap();
                    guard.take()
                };
                if let Some(mut child) = child {
                    let _ = child.kill();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
