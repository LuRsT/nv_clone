use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::mpsc;
use std::time::{Duration, Instant};

use notify::{RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::commands::notes::NoteInfo;
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

/// Reads events from `rx`, debounces them over `DEBOUNCE`, then applies
/// incremental updates to a cached note list and emits `notes:changed`.
fn debounce_loop<R: Runtime>(
    rx: mpsc::Receiver<notify::Result<notify::Event>>,
    app: AppHandle<R>,
    vault_path: PathBuf,
) {
    // Seed cache with initial full read.
    let mut cache: Vec<NoteInfo> =
        crate::commands::notes::list_notes_from_path(&vault_path).unwrap_or_default();

    let mut pending = false;
    let mut deadline = Instant::now();
    let mut dirty_paths: HashSet<PathBuf> = HashSet::new();

    loop {
        let timeout = if pending {
            let now = Instant::now();
            if now >= deadline {
                apply_incremental(&app, &vault_path, &mut cache, &mut dirty_paths);
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
                for p in &event.paths {
                    if p.extension().is_some_and(|e| e == "md") {
                        dirty_paths.insert(p.clone());
                        pending = true;
                        deadline = Instant::now() + DEBOUNCE;
                    }
                }
            }
            Ok(Err(e)) => eprintln!("watcher: notify error: {e}"),
            Err(mpsc::RecvTimeoutError::Timeout) => {
                if pending {
                    apply_incremental(&app, &vault_path, &mut cache, &mut dirty_paths);
                    pending = false;
                }
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }
}

/// Apply incremental updates for `dirty_paths` to the cache, then emit.
fn apply_incremental<R: Runtime>(
    app: &AppHandle<R>,
    vault_path: &PathBuf,
    cache: &mut Vec<NoteInfo>,
    dirty_paths: &mut HashSet<PathBuf>,
) {
    // Verify the vault hasn't changed.
    let app_state = app.state::<AppState>();
    let vault_guard = app_state.vault_path.lock().unwrap();
    let current = match vault_guard.as_ref() {
        Some(p) if p == vault_path => p.clone(),
        _ => return,
    };
    drop(vault_guard);

    for path in dirty_paths.drain() {
        // Derive title from filename.
        let title = match path.file_stem() {
            Some(s) => s.to_string_lossy().into_owned(),
            None => continue,
        };

        // Remove old entry for this title.
        cache.retain(|n| n.title != title);

        // If the file still exists and qualifies, re-read and insert.
        if path.starts_with(&current) {
            if let Some(info) = crate::commands::notes::read_note_info(&path) {
                cache.push(info);
            }
        }
    }

    cache.sort_by(|a, b| b.mtime.partial_cmp(&a.mtime).unwrap());

    if let Err(e) = app.emit("notes:changed", cache.clone()) {
        eprintln!("watcher: emit error: {e}");
    }
}
