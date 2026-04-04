#!/usr/bin/env node

/**
 * SecretGuard - Scan your own code and websites for exposed secrets.
 *
 * Usage:
 *   node src/index.js scan <directory>           Scan a local directory
 *   node src/index.js file <filepath>            Scan a single file
 *   node src/index.js url <url>                  Fetch and scan a URL's source
 *   node src/index.js --help                     Show help
 *
 * Options:
 *   --json          Output results as JSON
 *   --output <file> Write report to a file
 */

const { scanDirectory, scanFile, scanContent } = require("./scanner");
const { fetchUrl } = require("./url-fetcher");
const { printReport, jsonReport } = require("./reporter");
const fs = require("fs");
const path = require("path");

const HELP = `
SecretGuard v1.0.0 - Find exposed secrets in your own code

USAGE:
  secretguard scan <directory>     Scan all files in a directory
  secretguard file <filepath>      Scan a single file
  secretguard url <url>            Fetch a URL and scan its HTML source

OPTIONS:
  --json              Output as JSON instead of terminal report
  --output <file>     Write report to a file (implies --json)
  --help, -h          Show this help message

EXAMPLES:
  secretguard scan ./my-project
  secretguard file ./config/settings.js
  secretguard url https://my-site.com
  secretguard scan ./src --json --output report.json

ABOUT:
  SecretGuard scans your own source code, config files, and website HTML
  for accidentally exposed API keys and secrets from providers like:

    - OpenAI, Anthropic, Google AI (Gemini), Mistral, Cohere
    - AWS, Azure, Hugging Face, Replicate, Stability AI, Together AI
    - Stripe, GitHub, Slack, SendGrid, Twilio, Pinecone
    - Generic patterns: PEM keys, Bearer tokens, password assignments

  All scanning happens locally on your machine. No data is sent anywhere.
`;

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    process.exit(0);
  }

  const useJson = args.includes("--json");
  const outputIdx = args.indexOf("--output");
  const outputFile = outputIdx !== -1 ? args[outputIdx + 1] : null;

  // Filter out flags to get positional args
  const positional = args.filter(
    (a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1] === "--output")
  );

  const command = positional[0];
  const target = positional[1];

  if (!command || !target) {
    console.error("Error: Please provide a command and target. Run with --help for usage.");
    process.exit(1);
  }

  let findings = [];
  let source = target;

  try {
    switch (command) {
      case "scan": {
        console.log(`Scanning directory: ${path.resolve(target)}`);
        findings = scanDirectory(target);
        source = path.resolve(target);
        break;
      }

      case "file": {
        console.log(`Scanning file: ${path.resolve(target)}`);
        findings = scanFile(target);
        source = path.resolve(target);
        break;
      }

      case "url": {
        console.log(`Fetching URL: ${target}`);
        const html = await fetchUrl(target);
        console.log(`Fetched ${html.length} bytes. Scanning for secrets...`);
        findings = scanContent(html, target);
        source = target;
        break;
      }

      default:
        console.error(`Unknown command: ${command}. Run with --help for usage.`);
        process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  // Output results
  if (outputFile || useJson) {
    const json = jsonReport(findings, source);
    if (outputFile) {
      fs.writeFileSync(outputFile, json, "utf-8");
      console.log(`Report written to: ${outputFile}`);
    } else {
      console.log(json);
    }
  } else {
    printReport(findings, source);
  }

  // Exit with non-zero if critical/high findings exist
  const hasCritical = findings.some((f) => f.severity === "critical" || f.severity === "high");
  process.exit(hasCritical ? 1 : 0);
}

main().catch((err) => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(2);
});
