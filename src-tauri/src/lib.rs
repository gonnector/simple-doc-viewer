mod commands;

use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // 두 번째 실행 → 기존 창 포커스 + 파일 인자가 있으면 open-file 이벤트로 전달
    // (브라우저판 launcher.js의 kill/재시작 패턴을 대체)
    .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
      if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_focus();
        let _ = win.unminimize();
      }
      if let Some(file) = args.iter().skip(1).find(|a| std::path::Path::new(a).is_file()) {
        let _ = app.emit("open-file", file.replace('\\', "/"));
      }
    }))
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
      commands::get_boot_config,
      commands::list_dir,
      commands::read_file,
      commands::search_dir,
      commands::rename_path,
      commands::delete_path,
      commands::check_dir
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
