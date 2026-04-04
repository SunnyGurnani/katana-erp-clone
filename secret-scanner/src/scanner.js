const fs = require("fs");
const path = require("path");
const { patterns } = require("./patterns");

/**
 * Default file extensions to scan.
 */
const DEFAULT_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
  ".py", ".rb", ".go", ".rs", ".java", ".kt",
  ".php", ".cs", ".swift", ".c", ".cpp", ".h",
  ".json", ".yaml", ".yml", ".toml", ".xml",
  ".env", ".conf", ".cfg", ".ini", ".properties",
  ".html", ".htm", ".css", ".scss", ".vue", ".svelte",
  ".sh", ".bash", ".zsh", ".fish",
  ".md", ".txt", ".rst",
  ".dockerfile", ".tf", ".hcl",
]);

/**
 * Directories to always skip.
 */
const SKIP_DIRS = new Set([
  "node_modules", ".git", ".svn", ".hg",
  "__pycache__", ".tox", ".mypy_cache",
  "dist", "build", ".next", ".nuxt",
  "vendor", "venv", ".venv", "env",
  ".idea", ".vscode",
  "coverage", ".nyc_output",
]);

/**
 * Files to always skip.
 */
const SKIP_FILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
  "composer.lock", "Gemfile.lock", "Cargo.lock",
  "poetry.lock", "go.sum",
]);

/**
 * Collect all scannable files under a directory.
 */
function collectFiles(dirPath, extensions = DEFAULT_EXTENSIONS) {
  const results = [];

  function walk(currentPath) {
    let entries;
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch {
      // Permission denied or unreadable directory - skip
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        if (SKIP_FILES.has(entry.name)) continue;

        const ext = path.extname(entry.name).toLowerCase();
        // Also scan extensionless dotfiles like .env
        if (extensions.has(ext) || entry.name.startsWith(".env")) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(dirPath);
  return results;
}

/**
 * Check if a line of context contains any of the required context words.
 */
function hasContext(surroundingText, contextWords) {
  if (!contextWords || contextWords.length === 0) return true;
  const lower = surroundingText.toLowerCase();
  return contextWords.some((word) => lower.includes(word.toLowerCase()));
}

/**
 * Scan a single string of content for secrets.
 *
 * @param {string} content - The text content to scan
 * @param {string} sourceName - Identifier for the source (file path or URL)
 * @returns {Array} Array of finding objects
 */
function scanContent(content, sourceName) {
  const findings = [];
  const lines = content.split("\n");

  for (const pattern of patterns) {
    // Reset the regex lastIndex for global patterns
    pattern.regex.lastIndex = 0;

    let match;
    while ((match = pattern.regex.exec(content)) !== null) {
      // Find which line this match is on
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = beforeMatch.split("\n").length;

      // Get surrounding context (3 lines before and after)
      const contextStart = Math.max(0, lineNumber - 4);
      const contextEnd = Math.min(lines.length, lineNumber + 3);
      const contextLines = lines.slice(contextStart, contextEnd);
      const surroundingText = contextLines.join("\n");

      // If pattern requires context keywords, check them
      if (pattern.contextRequired && !hasContext(surroundingText, pattern.contextRequired)) {
        continue;
      }

      // Mask the matched secret for safe display
      const rawMatch = match[0];
      const masked = maskSecret(rawMatch);

      findings.push({
        source: sourceName,
        line: lineNumber,
        pattern: pattern.name,
        severity: pattern.severity,
        description: pattern.description,
        matched: masked,
        rawLength: rawMatch.length,
        context: contextLines.map((l, i) => ({
          lineNumber: contextStart + i + 1,
          text: maskSecretsInLine(l, pattern.regex),
          isCurrent: contextStart + i + 1 === lineNumber,
        })),
        remediation: pattern.remediation,
      });
    }
  }

  // Deduplicate findings with the same match on the same line
  return deduplicateFindings(findings);
}

/**
 * Mask a secret string, showing only the first few and last few characters.
 */
function maskSecret(secret) {
  if (secret.length <= 8) return "****";
  const showChars = Math.min(4, Math.floor(secret.length * 0.15));
  const prefix = secret.substring(0, showChars);
  const suffix = secret.substring(secret.length - showChars);
  return `${prefix}${"*".repeat(Math.min(20, secret.length - showChars * 2))}${suffix}`;
}

/**
 * Mask any secrets found within a line of text.
 */
function maskSecretsInLine(line, regex) {
  const freshRegex = new RegExp(regex.source, regex.flags);
  return line.replace(freshRegex, (m) => maskSecret(m));
}

/**
 * Remove duplicate findings on the same line with the same pattern.
 */
function deduplicateFindings(findings) {
  const seen = new Set();
  return findings.filter((f) => {
    const key = `${f.source}:${f.line}:${f.pattern}:${f.matched}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Scan a directory for secrets.
 *
 * @param {string} dirPath - Path to the directory
 * @param {Object} options - Options
 * @returns {Array} Array of findings
 */
function scanDirectory(dirPath, options = {}) {
  const resolvedPath = path.resolve(dirPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Directory not found: ${resolvedPath}`);
  }

  if (!fs.statSync(resolvedPath).isDirectory()) {
    throw new Error(`Not a directory: ${resolvedPath}`);
  }

  const files = collectFiles(resolvedPath);
  const allFindings = [];

  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");

      // Skip binary-looking files
      if (content.includes("\0")) continue;

      // Skip very large files (>1MB)
      if (content.length > 1_000_000) continue;

      const relativePath = path.relative(resolvedPath, filePath);
      const findings = scanContent(content, relativePath);
      allFindings.push(...findings);
    } catch {
      // Unreadable file - skip
    }
  }

  return allFindings;
}

/**
 * Scan a single file for secrets.
 *
 * @param {string} filePath - Path to the file
 * @returns {Array} Array of findings
 */
function scanFile(filePath) {
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  const content = fs.readFileSync(resolvedPath, "utf-8");
  return scanContent(content, path.basename(resolvedPath));
}

module.exports = {
  scanContent,
  scanDirectory,
  scanFile,
  collectFiles,
  maskSecret,
  DEFAULT_EXTENSIONS,
};
