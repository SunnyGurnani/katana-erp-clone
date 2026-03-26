/**
 * Report generation for secret scan results.
 */

const SEVERITY_COLORS = {
  critical: "\x1b[91m", // bright red
  high: "\x1b[31m",     // red
  medium: "\x1b[33m",   // yellow
  low: "\x1b[36m",      // cyan
};

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

/**
 * Sort findings by severity (critical first).
 */
function sortBySeverity(findings) {
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...findings].sort((a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4));
}

/**
 * Print a terminal-friendly report.
 */
function printReport(findings, source) {
  const sorted = sortBySeverity(findings);

  console.log("");
  console.log(`${BOLD}=== SecretGuard Scan Report ===${RESET}`);
  console.log(`${DIM}Source: ${source}${RESET}`);
  console.log(`${DIM}Scan time: ${new Date().toISOString()}${RESET}`);
  console.log("");

  if (sorted.length === 0) {
    console.log("\x1b[32m  No secrets detected. Your code looks clean!\x1b[0m");
    console.log("");
    printGeneralTips();
    return;
  }

  // Summary
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of sorted) {
    counts[f.severity] = (counts[f.severity] || 0) + 1;
  }

  console.log(`${BOLD}Summary:${RESET}`);
  console.log(`  Total findings: ${sorted.length}`);
  if (counts.critical) console.log(`  ${SEVERITY_COLORS.critical}CRITICAL: ${counts.critical}${RESET}`);
  if (counts.high) console.log(`  ${SEVERITY_COLORS.high}HIGH: ${counts.high}${RESET}`);
  if (counts.medium) console.log(`  ${SEVERITY_COLORS.medium}MEDIUM: ${counts.medium}${RESET}`);
  if (counts.low) console.log(`  ${SEVERITY_COLORS.low}LOW: ${counts.low}${RESET}`);
  console.log("");

  // Detail each finding
  for (let i = 0; i < sorted.length; i++) {
    const f = sorted[i];
    const color = SEVERITY_COLORS[f.severity] || "";

    console.log(`${BOLD}--- Finding #${i + 1} ---${RESET}`);
    console.log(`  ${BOLD}Type:${RESET}     ${f.pattern}`);
    console.log(`  ${BOLD}Severity:${RESET} ${color}${f.severity.toUpperCase()}${RESET}`);
    console.log(`  ${BOLD}File:${RESET}     ${f.source}:${f.line}`);
    console.log(`  ${BOLD}Match:${RESET}    ${f.matched} (${f.rawLength} chars)`);
    console.log(`  ${BOLD}About:${RESET}    ${f.description}`);
    console.log("");

    // Context
    if (f.context && f.context.length > 0) {
      console.log(`  ${DIM}Context:${RESET}`);
      for (const ctx of f.context) {
        const marker = ctx.isCurrent ? `${color}>>${RESET}` : "  ";
        const lineNum = String(ctx.lineNumber).padStart(4);
        console.log(`    ${marker} ${DIM}${lineNum}${RESET} | ${ctx.text}`);
      }
      console.log("");
    }

    // Remediation
    console.log(`  ${BOLD}How to fix:${RESET}`);
    for (const tip of f.remediation) {
      console.log(`    - ${tip}`);
    }
    console.log("");
  }

  printGeneralTips();
}

/**
 * Print general security tips.
 */
function printGeneralTips() {
  console.log(`${BOLD}General Security Tips:${RESET}`);
  console.log("  1. Use environment variables for all secrets (never hardcode them)");
  console.log("  2. Add a .env file to .gitignore so it never gets committed");
  console.log("  3. Use a pre-commit hook (e.g. git-secrets, husky + gitleaks) to catch leaks before they land");
  console.log("  4. Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, Doppler) in production");
  console.log("  5. Rotate any exposed keys immediately - assume they have been compromised");
  console.log("  6. Enable provider-side usage limits and alerts to detect abuse early");
  console.log("  7. Audit your repos periodically with tools like gitleaks or trufflehog");
  console.log("");
}

/**
 * Generate a JSON report string.
 */
function jsonReport(findings, source) {
  return JSON.stringify(
    {
      tool: "SecretGuard",
      version: "1.0.0",
      source,
      timestamp: new Date().toISOString(),
      totalFindings: findings.length,
      summary: {
        critical: findings.filter((f) => f.severity === "critical").length,
        high: findings.filter((f) => f.severity === "high").length,
        medium: findings.filter((f) => f.severity === "medium").length,
        low: findings.filter((f) => f.severity === "low").length,
      },
      findings: sortBySeverity(findings),
    },
    null,
    2
  );
}

module.exports = { printReport, jsonReport, sortBySeverity };
