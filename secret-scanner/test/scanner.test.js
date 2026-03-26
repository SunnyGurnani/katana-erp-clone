/**
 * Tests for SecretGuard scanner.
 *
 * These use FAKE keys that match real patterns but are not actual credentials.
 * They verify the scanner correctly detects and reports secret patterns.
 */

const { scanContent, maskSecret } = require("../src/scanner");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

function assertFinding(findings, patternName, message) {
  const found = findings.some((f) => f.pattern === patternName);
  assert(found, message || `Should detect ${patternName}`);
}

function assertNoFinding(findings, patternName, message) {
  const found = findings.some((f) => f.pattern === patternName);
  assert(!found, message || `Should NOT detect ${patternName}`);
}

// ── Test: OpenAI legacy key ─────────────────────────────────
console.log("\nOpenAI API Key (Legacy):");
{
  // Build the fake key programmatically to avoid triggering GitHub push protection
  const prefix = "sk-";
  const mid = "aaaabbbbccccddddeeeeT3BlbkFJffffgggghhhhiiiijjjj";
  const code = `const key = "${prefix}${mid}";`;
  const findings = scanContent(code, "test.js");
  assertFinding(findings, "OpenAI API Key", "Detects legacy OpenAI key format");
}

// ── Test: OpenAI project key ────────────────────────────────
console.log("\nOpenAI API Key (Project):");
{
  // 80+ chars after sk-proj-
  const fakeKey = "sk-proj-" + "A".repeat(85);
  const code = `const key = "${fakeKey}";`;
  const findings = scanContent(code, "test.js");
  assertFinding(findings, "OpenAI API Key (Project Format)", "Detects project-scoped OpenAI key");
}

// ── Test: OpenAI service account key ────────────────────────
console.log("\nOpenAI API Key (Service Account):");
{
  const fakeKey = "sk-svcacct-" + "B".repeat(85);
  const code = `const key = "${fakeKey}";`;
  const findings = scanContent(code, "test.js");
  assertFinding(findings, "OpenAI API Key (Service Account)", "Detects service account OpenAI key");
}

// ── Test: Anthropic key ─────────────────────────────────────
console.log("\nAnthropic API Key:");
{
  const fakeKey = "sk-ant-api03-" + "C".repeat(93) + "AA";
  const code = `ANTHROPIC_API_KEY="${fakeKey}"`;
  const findings = scanContent(code, ".env");
  assertFinding(findings, "Anthropic API Key", "Detects Anthropic API key");
}

// ── Test: Anthropic generic key ─────────────────────────────
console.log("\nAnthropic API Key (Generic):");
{
  const fakeKey = "sk-ant-" + "D".repeat(40);
  const code = `const key = "${fakeKey}";`;
  const findings = scanContent(code, "test.js");
  assertFinding(findings, "Anthropic API Key (Generic)", "Detects generic Anthropic key");
}

// ── Test: Google AI key ─────────────────────────────────────
console.log("\nGoogle AI (Gemini) API Key:");
{
  const code = `const key = "AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ123456789";`;
  const findings = scanContent(code, "test.js");
  assertFinding(findings, "Google AI (Gemini) API Key", "Detects Google AI key");
}

// ── Test: AWS Access Key ────────────────────────────────────
console.log("\nAWS Access Key ID:");
{
  const code = `AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE`;
  const findings = scanContent(code, ".env");
  assertFinding(findings, "AWS Access Key ID", "Detects AWS access key ID");
}

// ── Test: Hugging Face Token ────────────────────────────────
console.log("\nHugging Face Token:");
{
  const fakeToken = "hf_" + "E".repeat(40);
  const code = `HF_TOKEN="${fakeToken}"`;
  const findings = scanContent(code, ".env");
  assertFinding(findings, "Hugging Face Token", "Detects Hugging Face token");
}

// ── Test: Replicate Token ───────────────────────────────────
console.log("\nReplicate API Token:");
{
  const fakeToken = "r8_" + "F".repeat(37);
  const code = `export REPLICATE_API_TOKEN="${fakeToken}"`;
  const findings = scanContent(code, ".env");
  assertFinding(findings, "Replicate API Token", "Detects Replicate token");
}

// ── Test: GitHub PAT ────────────────────────────────────────
console.log("\nGitHub Personal Access Token:");
{
  const fakeToken = "ghp_" + "G".repeat(36);
  const code = `GITHUB_TOKEN=${fakeToken}`;
  const findings = scanContent(code, ".env");
  assertFinding(findings, "GitHub Personal Access Token", "Detects GitHub PAT");
}

// ── Test: Stripe Secret Key ─────────────────────────────────
console.log("\nStripe Secret Key:");
{
  const fakeKey = "sk_live_" + "H".repeat(30);
  const code = `stripe.api_key = "${fakeKey}"`;
  const findings = scanContent(code, "billing.py");
  assertFinding(findings, "Stripe Secret Key", "Detects Stripe secret key");
}

// ── Test: Slack Bot Token ───────────────────────────────────
console.log("\nSlack Bot Token:");
{
  // Build programmatically to avoid GitHub push protection
  const prefix = "xoxb-";
  const parts = "00000000001-00000000001-aaaabbbbccccddddeeeeffff";
  const code = `const token = "${prefix}${parts}";`;
  const findings = scanContent(code, "bot.js");
  assertFinding(findings, "Slack Bot Token", "Detects Slack bot token");
}

// ── Test: SendGrid Key ──────────────────────────────────────
console.log("\nSendGrid API Key:");
{
  // Build programmatically to avoid GitHub push protection
  const prefix = "SG.";
  const part1 = "aabbccddeeAABBCCDDEEff";  // exactly 22 chars
  const part2 = "AABBCCDDEEFFGGHHIIJJKKLLMMNNOOPPQQRRSSTTUUv";  // exactly 43 chars
  const fakeKey = prefix + part1 + "." + part2;
  const code = `SENDGRID_API_KEY="${fakeKey}"`;
  const findings = scanContent(code, ".env");
  assertFinding(findings, "SendGrid API Key", "Detects SendGrid key");
}

// ── Test: Private Key ───────────────────────────────────────
console.log("\nPrivate Key (PEM):");
{
  const code = `-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----`;
  const findings = scanContent(code, "key.pem");
  assertFinding(findings, "Private Key (PEM)", "Detects PEM private key");
}

// ── Test: Generic API Key Assignment ────────────────────────
console.log("\nGeneric API Key Assignment:");
{
  const code = `api_key = "my-super-secret-api-key-12345"`;
  const findings = scanContent(code, "config.py");
  assertFinding(findings, "Generic API Key Assignment", "Detects generic api_key assignment");
}

// ── Test: Bearer Token ──────────────────────────────────────
console.log("\nBearer Token:");
{
  const code = `headers = { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test" }`;
  const findings = scanContent(code, "client.js");
  assertFinding(findings, "Bearer Token in Code", "Detects hardcoded Bearer token");
}

// ── Test: Clean code ────────────────────────────────────────
console.log("\nClean code (no secrets):");
{
  const code = `
    // This is clean code
    const greeting = "Hello, world!";
    function add(a, b) { return a + b; }
    module.exports = { add };
  `;
  const findings = scanContent(code, "clean.js");
  assert(findings.length === 0, "No findings in clean code");
}

// ── Test: maskSecret ────────────────────────────────────────
console.log("\nSecret Masking:");
{
  const masked = maskSecret("sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefg");
  assert(!masked.includes("ABCDEFGHIJ"), "Mask hides the middle of the secret");
  assert(masked.includes("*"), "Mask contains asterisks");
  assert(masked.length > 0, "Mask is not empty");
}

// ── Test: Context-required patterns ─────────────────────────
console.log("\nContext-Required Patterns:");
{
  // Azure key pattern without azure context should not match
  const codeNoContext = `const key = "abcdef0123456789abcdef0123456789";`;
  const findingsNoCtx = scanContent(codeNoContext, "test.js");
  assertNoFinding(findingsNoCtx, "Azure API Key", "No Azure match without azure context");

  // Azure key pattern with azure context should match
  const codeWithContext = `
    // Azure OpenAI configuration
    const endpoint = "https://myapp.openai.azure.com/";
    const key = "abcdef0123456789abcdef0123456789";
  `;
  const findingsWithCtx = scanContent(codeWithContext, "azure-config.js");
  assertFinding(findingsWithCtx, "Azure API Key", "Azure match with azure context");
}

// ── Summary ─────────────────────────────────────────────────
console.log(`\n${"=".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
console.log(`${"=".repeat(40)}\n`);

process.exit(failed > 0 ? 1 : 0);
