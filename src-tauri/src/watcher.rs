use std::path::PathBuf;
use std::sync::mpsc;
use std::time::{Duration, Instant};

use notify::{RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::{AppState, WatcherState};

const DEBOUNCE: Duration = Duration::from_millis(100);

/// (Re)start the file watcher for the given vault path.
///
/// Drops any previously running watcher stored in `WatcherState`, which
/// signals the old debounce thread to exit via the dropped channel sender.
pub fn start<R: Runtime>(app: &AppHandle<R>, vault_path: PathBuf) {
    let (tx, rx) = mpsc::channel::<notify::Result<notify::Event>>();

    let mut watcher = match notify::recommended_watcher(move |evt| {
        let _ = tx.send(evt);
    }) {
        Ok(w) => w,
        Err(e) => {
            eprintln!("watcher: failed to create watcher: {e}");
            return;
        }
    };

    if let Err(e) = watcher.watch(&vault_path, RecursiveMode::NonRecursive) {
        eprintln!("watcher: failed to watch {}: {e}", vault_path.display());
        return;
    }

    // Replace the old watcher. Dropping the old one closes its sender,
    // which causes the old debounce thread to exit on next recv().
    *app.state::<WatcherState>().handle.lock().unwrap() = Some(watcher);

    let app = app.clone();
    std::thread::spawn(move || debounce_loop(rx, app, vault_path));
}

/// Reads events from `rx`, debounces them over `DEBOUNCE`, then emits a
/// `notes:changed` Tauri event with the refreshed note list.
fn debounce_loop<R: Runtime>(
    rx: mpsc::Receiver<notify::Result<notify::Event>>,
    app: AppHandle<R>,
    vault_path: PathBuf,
) {
    let mut pending = false;
    let mut deadline = Instant::now();

    loop {
        let timeout = if pending {
            let now = Instant::now();
            if now >= deadline {
                emit_changed(&app, &vault_path);
                pending = false;
                Duration::from_secs(3600)
            } else {
                deadline - now
            }
        } else {
            Duration::from_secs(3600)
        };

        match rx.recv_timeout(timeout) {
            Ok(Ok(event)) => {
                // Only react to .md files.
                let is_md = event
                    .paths
                    .iter()
                    .any(|p| p.extension().map_or(false, |e| e == "md"));
                if is_md {
                    pending = true;
                    deadline = Instant::now() + DEBOUNCE;
                }
            }
            Ok(Err(e)) => eprintln!("watcher: notify error: {e}"),
            Err(mpsc::RecvTimeoutError::Timeout) => {
                if pending {
                    emit_changed(&app, &vault_path);
                    pending = false;
                }
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }
}

fn emit_changed<R: Runtime>(app: &AppHandle<R>, vault_path: &PathBuf) {
    // Re-use the notes_list logic by reading AppState from the app handle.
    let app_state = app.state::<AppState>();
    let vault_guard = app_state.vault_path.lock().unwrap();
    let current = match vault_guard.as_ref() {
        Some(p) if p == vault_path => p.clone(),
        _ => return, // vault changed before we could emit — skip
    };
    drop(vault_guard);

    match crate::commands::notes::list_notes_from_path(&current) {
        Ok(notes) => {
            if let Err(e) = app.emit("notes:changed", notes) {
                eprintln!("watcher: emit error: {e}");
            }
        }
        Err(e) => eprintln!("watcher: list_notes error: {e}"),
    }
}
