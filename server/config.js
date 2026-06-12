// 상수 — 확장자 화이트리스트, 숨김 목록, 크기 제한
const TEXT_EXTENSIONS = new Set([
  'md', 'txt', 'js', 'ts', 'jsx', 'tsx', 'mjs', 'cjs',
  'json', 'yaml', 'yml', 'toml', 'cfg', 'ini', 'conf',
  'env', 'gitignore', 'dockerignore', 'editorconfig',
  'prettierrc', 'eslintrc', 'babelrc',
  'html', 'htm', 'css', 'scss', 'less', 'xml', 'svg',
  'sh', 'bash', 'zsh', 'fish', 'bat', 'cmd', 'ps1',
  'py', 'rb', 'java', 'c', 'cpp', 'h', 'hpp', 'cs',
  'go', 'rs', 'php', 'sql', 'r', 'swift', 'kt',
  'makefile', 'dockerfile', 'log', 'csv', 'tsv',
  'properties', 'gradle', 'lock', 'map',
  'vue', 'svelte', 'astro'
]);

const KNOWN_TEXT_FILES = new Set([
  'makefile', 'dockerfile', 'license', 'readme', 'changelog',
  'gemfile', 'rakefile', 'procfile', 'vagrantfile',
  '.gitignore', '.dockerignore', '.editorconfig', '.env',
  '.npmrc', '.yarnrc', '.nvmrc', '.prettierrc', '.eslintrc',
  '.babelrc', '.browserslistrc'
]);

const MEDIA_EXTENSIONS = new Set([
  // Images
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff', 'tif', 'avif',
  // Video
  'mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv',
  // Audio
  'mp3', 'wav', 'flac', 'aac', 'opus', 'wma', 'm4a',
  // Document
  'pdf'
]);

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff', 'tif', 'avif']);
const VIDEO_EXTS = new Set(['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv']);
const AUDIO_EXTS = new Set(['mp3', 'wav', 'flac', 'aac', 'opus', 'wma', 'm4a']);
const DOC_EXTS = new Set(['pdf']);

const HIDDEN_NAMES = new Set([
  'node_modules', '.git', '.svn', '.hg', '.DS_Store',
  'Thumbs.db', '.idea', '.vscode', '__pycache__',
  '.cache', '.npm', '.yarn', 'dist', 'build', '.next',
  '.nuxt', 'coverage', '.env.local', '.env.production'
]);

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

module.exports = {
  TEXT_EXTENSIONS, KNOWN_TEXT_FILES, MEDIA_EXTENSIONS,
  IMAGE_EXTS, VIDEO_EXTS, AUDIO_EXTS, DOC_EXTS,
  HIDDEN_NAMES, MAX_FILE_SIZE
};
