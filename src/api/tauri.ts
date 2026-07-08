import { invoke } from "@tauri-apps/api/core";

export interface PlayerInfo {
  available: string[];
}

/// Check which media players are installed on the system.
export async function checkAvailablePlayers(): Promise<string[]> {
  try {
    return await invoke<string[]>("check_available_players");
  } catch {
    return [];
  }
}

/// Launch an external media player (VLC, PotPlayer, etc.) with a URL.
export async function launchPlayer(player: string, url: string): Promise<string> {
  return await invoke<string>("launch_player", { player, url });
}

/// Open a URL or file path using the system default application.
export async function openInSystem(url: string): Promise<void> {
  await invoke("open_in_system", { url });
}

/// Get the platform OS name.
export async function getPlatform(): Promise<string> {
  try {
    return await invoke<string>("get_platform");
  } catch {
    return "web";
  }
}

/// Read the current text content of the system clipboard.
export async function readClipboard(): Promise<string> {
  try {
    return await invoke<string>("read_clipboard");
  } catch {
    return "";
  }
}
