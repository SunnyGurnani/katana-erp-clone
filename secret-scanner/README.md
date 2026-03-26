# SecretGuard

A local security scanner that checks your own source code and websites for accidentally exposed API keys and secrets from AI providers and cloud services.

**All scanning happens locally on your machine. No data is sent anywhere.**

## Supported Providers

| Provider | Key Types Detected |
|---|---|
| OpenAI | Legacy keys, project keys, service account keys |
| Anthropic | API keys (all formats) |
| Google AI / Gemini | API keys |
| AWS | Access key IDs, secret access keys (with context) |
| Azure | API keys for OpenAI and Cognitive Services (with context) |
| Cohere | API keys (with context) |
| Hugging Face | User access tokens |
| Replicate | API tokens |
| Stability AI | API keys (with context) |
| Mistral AI | API keys (with context) |
| Together AI | API keys (with context) |
| Pinecone | API keys (with context) |
| Stripe | Secret and publishable keys |
| GitHub | Personal access tokens, OAuth tokens |
| Slack | Bot tokens, webhook URLs |
| SendGrid | API keys |
| Twilio | API keys |

Also detects generic patterns: PEM private keys, Bearer tokens, and `api_key`/`password`/`secret` variable assignments.

## Installation

```bash
# Clone and use directly (no dependencies required)
git clone <repo-url>
cd secret-scanner

# Or link globally
npm link
```

**Requirements:** Node.js 16+. Zero external dependencies.

## Usage

### Scan a directory

```bash
node src/index.js scan ./my-project
```

### Scan a single file

```bash
node src/index.js file ./config/settings.js
```

### Scan your website's HTML source

```bash
node src/index.js url https://my-website.com
```

### Output as JSON

```bash
node src/index.js scan ./my-project --json
```

### Save report to file

```bash
node src/index.js scan ./my-project --output report.json
```

## What It Scans

- **Source code files:** `.js`, `.ts`, `.py`, `.go`, `.rb`, `.java`, `.php`, `.swift`, `.rs`, `.c`, `.cpp`, and more
- **Config files:** `.env`, `.json`, `.yaml`, `.yml`, `.toml`, `.xml`, `.ini`, `.conf`, `.properties`
- **Web files:** `.html`, `.css`, `.vue`, `.svelte`
- **Infrastructure files:** `.dockerfile`, `.tf`, `.hcl`
- **Shell scripts:** `.sh`, `.bash`, `.zsh`
- **Documentation:** `.md`, `.txt`, `.rst`

It automatically skips `node_modules`, `.git`, `dist`, `build`, lock files, and other non-relevant directories.

## How It Works

1. **Pattern matching**: Uses provider-specific regex patterns to identify API key formats
2. **Context analysis**: Some patterns (like Azure, Cohere, Mistral) only trigger when surrounding code contains relevant context words, reducing false positives
3. **Secret masking**: All detected secrets are masked in output (e.g., `sk-p********************fg`) so reports are safe to share
4. **Remediation tips**: Each finding includes specific steps to fix the issue

## Exit Codes

| Code | Meaning |
|---|---|
| 0 | No critical/high severity findings |
| 1 | Critical or high severity findings detected |
| 2 | Runtime error |

This makes it suitable for CI/CD pipeline integration.

## Running Tests

```bash
npm test
# or
node test/scanner.test.js
```

## Example Output

```
=== SecretGuard Scan Report ===
Source: /path/to/project
Scan time: 2024-01-15T10:30:00.000Z

Summary:
  Total findings: 3
  CRITICAL: 1
  HIGH: 1
  MEDIUM: 1

--- Finding #1 ---
  Type:     OpenAI API Key (Project Format)
  Severity: CRITICAL
  File:     src/config.js:12
  Match:    sk-p********************fg (95 chars)
  About:    OpenAI project-scoped API key grants access to GPT, DALL-E, and other OpenAI services.

  Context:
       10 | // API configuration
       11 | const config = {
    >> 12 |   openaiKey: "sk-p********************fg",
       13 | };

  How to fix:
    - Rotate the key immediately at https://platform.openai.com/api-keys
    - Store the key in environment variables (e.g. OPENAI_API_KEY)
    - Use a secrets manager for production deployments
    - Never embed keys in client-side JavaScript or HTML
```

## CI/CD Integration

Add to your GitHub Actions workflow:

```yaml
- name: Secret scan
  run: node secret-scanner/src/index.js scan . --json --output secret-report.json
  continue-on-error: false
```

Or as a pre-commit hook (`.husky/pre-commit`):

```bash
#!/bin/sh
node secret-scanner/src/index.js scan . && echo "No secrets found" || (echo "Secrets detected! Fix before committing." && exit 1)
```

## License

MIT
