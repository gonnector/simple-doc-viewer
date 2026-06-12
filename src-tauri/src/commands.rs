// SDV Tauri commands — 브라우저판 HTTP API(/api/*)와 동일한 응답 형태를 유지하여
// 클라이언트 어댑터(client/app/api.js)가 얇은 invoke 래퍼로 끝나도록 설계.
// 확장자 화이트리스트·1MB 캡·검색 연산자(AND/OR)는 server/config.js·routes/search.js와 동치.

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

const MAX_FILE_SIZE: u64 = 1024 * 1024; // 1MB

const TEXT_EXTENSIONS: &[&str] = &[
    "md", "txt", "js", "ts", "jsx", "tsx", "mjs", "cjs",
    "json", "yaml", "yml", "toml", "cfg", "ini", "conf",
    "env", "gitignore", "dockerignore", "editorconfig",
    "prettierrc", "eslintrc", "babelrc",
    "html", "htm", "css", "scss", "less", "xml", "svg",
    "sh", "bash", "zsh", "fish", "bat", "cmd", "ps1",
    "py", "rb", "java", "c", "cpp", "h", "hpp", "cs",
    "go", "rs", "php", "sql", "r", "swift", "kt",
    "makefile", "dockerfile", "log", "csv", "tsv",
    "properties", "gradle", "lock", "map",
    "vue", "svelte", "astro",
];

const KNOWN_TEXT_FILES: &[&str] = &[
    "makefile", "dockerfile", "license", "readme", "changelog",
    "gemfile", "rakefile", "procfile", "vagrantfile",
    ".gitignore", ".dockerignore", ".editorconfig", ".env",
    ".npmrc", ".yarnrc", ".nvmrc", ".prettierrc", ".eslintrc",
    ".babelrc", ".browserslistrc",
];

const HIDDEN_NAMES: &[&str] = &[
    "node_modules", ".git", ".svn", ".hg", ".DS_Store",
    "Thumbs.db", ".idea", ".vscode", "__pycache__",
    ".cache", ".npm", ".yarn", "dist", "build", ".next",
    ".nuxt", "coverage", ".env.local", ".env.production",
];

// --- 공통 유틸 ---

fn norm(p: &Path) -> String {
    p.to_string_lossy().replace('\\', "/")
}

fn file_ext(name: &str) -> String {
    match name.rsplit_once('.') {
        Some((stem, ext)) if !stem.is_empty() => ext.to_lowercase(),
        _ => String::new(),
    }
}

fn is_text_file(name: &str) -> bool {
    let base = name.to_lowercase();
    if KNOWN_TEXT_FILES.contains(&base.as_str()) {
        return true;
    }
    let ext = file_ext(&base);
    !ext.is_empty() && TEXT_EXTENSIONS.contains(&ext.as_str())
}

fn is_hidden(name: &str) -> bool {
    name.starts_with('.') || HIDDEN_NAMES.contains(&name)
}

fn iso(t: SystemTime) -> String {
    let dt: chrono::DateTime<chrono::Utc> = t.into();
    dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

// --- 부트스트랩 (/api/config 대응) ---

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BootConfig {
    pub root_dir: String,
    pub initial_file: Option<String>,
}

/// CLI 인자 해석 — server.js와 동일 규칙:
/// 첫 비플래그 인자가 파일이면 initialFile + 부모를 root로, 디렉토리면 root로. 없으면 cwd.
pub fn resolve_boot_config(args: &[String]) -> BootConfig {
    let mut root: PathBuf = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut initial: Option<PathBuf> = None;

    for arg in args {
        if arg.starts_with('-') {
            continue;
        }
        let p = PathBuf::from(arg);
        let p = fs::canonicalize(&p).unwrap_or(p);
        if p.is_file() {
            if let Some(parent) = p.parent() {
                root = parent.to_path_buf();
            }
            initial = Some(p);
        } else if p.is_dir() {
            root = p;
        }
        break;
    }

    // Windows canonicalize의 \\?\ 접두 제거
    let strip = |s: String| s.trim_start_matches("//?/").trim_start_matches(r"\\?\").to_string();
    BootConfig {
        root_dir: strip(norm(&root)),
        initial_file: initial.map(|p| strip(norm(&p))),
    }
}

#[tauri::command]
pub fn get_boot_config() -> BootConfig {
    let args: Vec<String> = std::env::args().skip(1).collect();
    resolve_boot_config(&args)
}

// --- /api/list 대응 ---

#[derive(Serialize)]
pub struct ListItem {
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub modified: String,
    pub created: String,
    pub hidden: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
}

#[derive(Serialize)]
pub struct ListResult {
    pub path: String,
    pub parent: Option<String>,
    pub items: Vec<ListItem>,
}

#[tauri::command]
pub fn list_dir(path: String) -> Result<ListResult, String> {
    let dir = PathBuf::from(&path);
    let meta = fs::metadata(&dir).map_err(|e| format!("Cannot read directory: {}", e))?;
    if !meta.is_dir() {
        return Err("Not a directory".into());
    }

    let mut items: Vec<ListItem> = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| format!("Cannot read directory: {}", e))? {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let name = entry.file_name().to_string_lossy().to_string();
        let md = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue, // 접근 불가 파일 무시 (브라우저판과 동일)
        };
        let is_dir = md.is_dir();
        items.push(ListItem {
            hidden: is_hidden(&name),
            kind: if is_dir { "dir" } else { "file" }.into(),
            modified: md.modified().map(iso).unwrap_or_default(),
            created: md.created().or_else(|_| md.modified()).map(iso).unwrap_or_default(),
            size: if is_dir { None } else { Some(md.len()) },
            name,
        });
    }

    items.sort_by(|a, b| {
        if a.kind != b.kind {
            return if a.kind == "dir" { std::cmp::Ordering::Less } else { std::cmp::Ordering::Greater };
        }
        a.name.to_lowercase().cmp(&b.name.to_lowercase())
    });

    let resolved = norm(&dir);
    let parent = dir.parent().map(norm).filter(|p| *p != resolved && !p.is_empty());
    Ok(ListResult { path: resolved, parent, items })
}

// --- /api/read 대응 ---

#[derive(Serialize)]
pub struct ReadResult {
    pub path: String,
    pub name: String,
    pub ext: String,
    pub size: u64,
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[tauri::command]
pub fn read_file(path: String) -> Result<ReadResult, String> {
    let p = PathBuf::from(&path);
    let meta = fs::metadata(&p).map_err(|e| format!("Cannot read file: {}", e))?;
    if meta.is_dir() {
        return Err("Is a directory".into());
    }
    let name = p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
    let ext = file_ext(&name);
    let size = meta.len();

    if size > MAX_FILE_SIZE {
        return Ok(ReadResult {
            path: norm(&p), name, ext, size, content: None,
            error: Some(format!("File too large (max 1MB). Size: {:.1}MB", size as f64 / 1024.0 / 1024.0)),
        });
    }
    if !is_text_file(&name) {
        return Ok(ReadResult {
            path: norm(&p), name, ext, size, content: None,
            error: Some("Binary file — preview not available".into()),
        });
    }

    let bytes = fs::read(&p).map_err(|e| format!("Cannot read file: {}", e))?;
    let mut content = String::from_utf8_lossy(&bytes).to_string();
    // UTF-8 BOM 제거 (브라우저판 v0.78과 동일)
    if content.starts_with('\u{FEFF}') {
        content = content.trim_start_matches('\u{FEFF}').to_string();
    }
    Ok(ReadResult { path: norm(&p), name, ext, size, content: Some(content), error: None })
}

// --- /api/search 대응 (AND/OR: 콤마·파이프 = OR, 공백·& = AND) ---

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchItem {
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub size: u64,
    pub modified: String,
    pub created: String,
    pub hidden: bool,
    pub match_type: String,
    pub snippet: String,
    pub name_match_count: u32,
    pub content_match_count: u32,
    pub match_count: u32,
}

#[derive(Serialize)]
pub struct SearchResult {
    pub path: String,
    pub results: Vec<SearchItem>,
}

fn parse_query(q: &str) -> Vec<Vec<String>> {
    q.split(|c| c == ',' || c == '|')
        .map(|g| {
            g.split(|c: char| c.is_whitespace() || c == '&')
                .map(|t| t.trim().to_lowercase())
                .filter(|t| !t.is_empty())
                .collect::<Vec<_>>()
        })
        .filter(|g: &Vec<String>| !g.is_empty())
        .collect()
}

fn matches_query(text: &str, parsed: &[Vec<String>]) -> bool {
    let lower = text.to_lowercase();
    parsed.iter().any(|and_group| and_group.iter().all(|t| lower.contains(t.as_str())))
}

fn count_occurrences(text: &str, parsed: &[Vec<String>]) -> u32 {
    let lower = text.to_lowercase();
    let mut count = 0u32;
    for group in parsed {
        for term in group {
            let mut pos = 0;
            while let Some(idx) = lower[pos..].find(term.as_str()) {
                count += 1;
                // overlapping 카운트 (JS pos = idx + 1과 동치, UTF-8 경계 안전하게 한 글자 전진)
                let abs = pos + idx;
                let step = lower[abs..].chars().next().map(|c| c.len_utf8()).unwrap_or(1);
                pos = abs + step;
            }
        }
    }
    count
}

fn extract_snippet(content: &str, parsed: &[Vec<String>], max_len: usize) -> String {
    for line in content.lines() {
        let lower = line.to_lowercase();
        let hit = parsed.iter().flatten().any(|t| lower.contains(t.as_str()));
        if hit {
            let trimmed = line.trim();
            let chars: Vec<char> = trimmed.chars().collect();
            if chars.len() > max_len {
                let cut: String = chars[..max_len].iter().collect();
                return format!("{}...", cut);
            }
            return trimmed.to_string();
        }
    }
    String::new()
}

#[tauri::command]
pub fn search_dir(path: String, q: String) -> Result<SearchResult, String> {
    let dir = PathBuf::from(&path);
    let query = q.trim();
    let resolved = norm(&dir);
    if query.is_empty() {
        return Ok(SearchResult { path: resolved, results: vec![] });
    }
    let parsed = parse_query(query);
    let mut results: Vec<SearchItem> = Vec::new();

    for entry in fs::read_dir(&dir).map_err(|e| format!("Search failed: {}", e))? {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let md = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        if md.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        let name_match = matches_query(&name, &parsed);
        let mut content_match = false;
        let mut snippet = String::new();
        let mut content_count = 0u32;

        if is_text_file(&name) && md.len() <= MAX_FILE_SIZE {
            if let Ok(bytes) = fs::read(entry.path()) {
                let content = String::from_utf8_lossy(&bytes);
                content_match = matches_query(&content, &parsed);
                if content_match {
                    snippet = extract_snippet(&content, &parsed, 80);
                    content_count = count_occurrences(&content, &parsed);
                }
            }
        }

        if name_match || content_match {
            let name_count = count_occurrences(&name, &parsed);
            results.push(SearchItem {
                hidden: is_hidden(&name),
                kind: "file".into(),
                size: md.len(),
                modified: md.modified().map(iso).unwrap_or_default(),
                created: md.created().or_else(|_| md.modified()).map(iso).unwrap_or_default(),
                match_type: if name_match && content_match { "both" } else if name_match { "name" } else { "content" }.into(),
                snippet,
                name_match_count: name_count,
                content_match_count: content_count,
                match_count: name_count + content_count,
                name,
            });
        }
    }

    Ok(SearchResult { path: resolved, results })
}

// --- /api/rename, /api/delete 대응 ---

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameResult {
    pub ok: bool,
    pub old_path: String,
    pub new_path: String,
}

#[tauri::command]
pub fn rename_path(old_path: String, new_path: String) -> Result<RenameResult, String> {
    let old_p = PathBuf::from(&old_path);
    let new_p = PathBuf::from(&new_path);
    if !old_p.exists() {
        return Err("File not found".into());
    }
    if new_p.exists() {
        return Err("Target already exists".into());
    }
    fs::rename(&old_p, &new_p).map_err(|e| format!("Rename failed: {}", e))?;
    Ok(RenameResult { ok: true, old_path: norm(&old_p), new_path: norm(&new_p) })
}

#[derive(Serialize)]
pub struct DeleteResult {
    pub ok: bool,
    pub path: String,
}

#[tauri::command]
pub fn delete_path(path: String) -> Result<DeleteResult, String> {
    let p = PathBuf::from(&path);
    let meta = fs::metadata(&p).map_err(|_| "File not found".to_string())?;
    if meta.is_dir() {
        fs::remove_dir_all(&p).map_err(|e| format!("Delete failed: {}", e))?;
    } else {
        fs::remove_file(&p).map_err(|e| format!("Delete failed: {}", e))?;
    }
    Ok(DeleteResult { ok: true, path: norm(&p) })
}

// --- /api/chroot 대응 (디렉토리 존재 검증만 — 컨테인먼트는 네이티브 앱에서 불필요) ---

#[derive(Serialize)]
pub struct ChrootResult {
    pub root: String,
}

#[tauri::command]
pub fn check_dir(path: String) -> Result<ChrootResult, String> {
    let p = PathBuf::from(&path);
    let meta = fs::metadata(&p).map_err(|e| format!("Directory not found: {}", e))?;
    if !meta.is_dir() {
        return Err("Not a directory".into());
    }
    Ok(ChrootResult { root: norm(&p) })
}
