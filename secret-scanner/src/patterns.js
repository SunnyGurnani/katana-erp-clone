/**
 * Secret detection patterns for AI and cloud service providers.
 *
 * Each pattern includes:
 * - name: Human-readable provider/key name
 * - regex: RegExp to match the secret
 * - severity: "critical" | "high" | "medium" | "low"
 * - description: What the key is used for
 * - remediation: Steps to fix the exposure
 */

const patterns = [
  // ─── OpenAI ───────────────────────────────────────────────
  {
    name: "OpenAI API Key",
    regex: /sk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}/g,
    severity: "critical",
    description: "OpenAI API key (legacy format) grants access to GPT models, DALL-E, and other OpenAI services.",
    remediation: [
      "Rotate the key immediately at https://platform.openai.com/api-keys",
      "Store the key in environment variables (e.g. OPENAI_API_KEY)",
      "Use a secrets manager like AWS Secrets Manager, HashiCorp Vault, or Doppler",
      "Add the key pattern to your .gitignore and pre-commit hooks",
      "Set usage limits on your OpenAI account to cap potential damage",
    ],
  },
  {
    name: "OpenAI API Key (Project Format)",
    regex: /sk-proj-[A-Za-z0-9_-]{80,}/g,
    severity: "critical",
    description: "OpenAI project-scoped API key grants access to GPT, DALL-E, and other OpenAI services within a project.",
    remediation: [
      "Rotate the key immediately at https://platform.openai.com/api-keys",
      "Store the key in environment variables (e.g. OPENAI_API_KEY)",
      "Use a secrets manager for production deployments",
      "Never embed keys in client-side JavaScript or HTML",
    ],
  },
  {
    name: "OpenAI API Key (Service Account)",
    regex: /sk-svcacct-[A-Za-z0-9_-]{80,}/g,
    severity: "critical",
    description: "OpenAI service account API key used for automated/service-level access.",
    remediation: [
      "Rotate the key immediately at https://platform.openai.com/api-keys",
      "Restrict key permissions to only what the service needs",
      "Use environment variables or a secrets manager",
    ],
  },

  // ─── Anthropic ────────────────────────────────────────────
  {
    name: "Anthropic API Key",
    regex: /sk-ant-api03-[A-Za-z0-9_-]{93}AA/g,
    severity: "critical",
    description: "Anthropic API key grants access to Claude models.",
    remediation: [
      "Rotate the key at https://console.anthropic.com/settings/keys",
      "Store in environment variables (e.g. ANTHROPIC_API_KEY)",
      "Use a secrets manager for production",
      "Set spending limits on your Anthropic account",
    ],
  },
  {
    name: "Anthropic API Key (Generic)",
    regex: /sk-ant-[A-Za-z0-9_-]{32,}/g,
    severity: "critical",
    description: "Anthropic API key grants access to Claude models.",
    remediation: [
      "Rotate the key at https://console.anthropic.com/settings/keys",
      "Never hardcode keys in source files",
      "Use server-side proxy endpoints instead of exposing keys client-side",
    ],
  },

  // ─── Google AI / Gemini ───────────────────────────────────
  {
    name: "Google AI (Gemini) API Key",
    regex: /AIzaSy[A-Za-z0-9_-]{33}/g,
    severity: "high",
    description: "Google API key that may grant access to Gemini, Vertex AI, and other Google Cloud services.",
    remediation: [
      "Rotate the key at https://console.cloud.google.com/apis/credentials",
      "Restrict the key to specific APIs and IP addresses/referrers",
      "Use Application Default Credentials (ADC) for server-side apps",
      "Never expose Google API keys in client-side code without referrer restrictions",
    ],
  },

  // ─── AWS (Bedrock, SageMaker, etc.) ──────────────────────
  {
    name: "AWS Access Key ID",
    regex: /AKIA[0-9A-Z]{16}/g,
    severity: "critical",
    description: "AWS access key ID used for authenticating to AWS services including Bedrock, SageMaker, and S3.",
    remediation: [
      "Rotate credentials immediately via AWS IAM console",
      "Use IAM roles instead of long-lived access keys",
      "Enable AWS CloudTrail to audit any unauthorized usage",
      "Use aws-vault or similar tools for local development",
      "Set up AWS Organizations SCPs to limit blast radius",
    ],
  },
  {
    name: "AWS Secret Access Key",
    regex: /(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/g,
    severity: "medium",
    description: "Potential AWS secret access key (40-character base64 string). Verify manually as this may produce false positives.",
    remediation: [
      "If confirmed as an AWS secret key, rotate immediately in IAM",
      "Use temporary credentials via AWS STS AssumeRole",
      "Store secrets in AWS Secrets Manager or Parameter Store",
    ],
    // Only flag this if found near AWS context
    contextRequired: ["aws", "AWS", "amazon", "AKIA", "s3", "bedrock", "sagemaker"],
  },

  // ─── Azure OpenAI ────────────────────────────────────────
  {
    name: "Azure API Key",
    regex: /[a-f0-9]{32}/g,
    severity: "medium",
    description: "Potential Azure API key (32-char hex string). Common for Azure OpenAI and Cognitive Services.",
    remediation: [
      "Rotate the key in the Azure Portal under your resource's Keys section",
      "Use Azure Managed Identity for service-to-service auth",
      "Store keys in Azure Key Vault",
      "Use Azure RBAC instead of key-based auth where possible",
    ],
    contextRequired: ["azure", "Azure", "openai.azure.com", "cognitiveservices"],
  },

  // ─── Cohere ──────────────────────────────────────────────
  {
    name: "Cohere API Key",
    regex: /[a-zA-Z0-9]{40}/g,
    severity: "high",
    description: "Potential Cohere API key for accessing embedding, generation, and reranking models.",
    remediation: [
      "Rotate at https://dashboard.cohere.com/api-keys",
      "Use environment variables (COHERE_API_KEY)",
      "Proxy requests through your backend to avoid client-side exposure",
    ],
    contextRequired: ["cohere", "Cohere", "co.api_key", "cohere.Client"],
  },

  // ─── Hugging Face ────────────────────────────────────────
  {
    name: "Hugging Face Token",
    regex: /hf_[A-Za-z0-9]{34,}/g,
    severity: "high",
    description: "Hugging Face user access token for model inference, Hub access, and Spaces.",
    remediation: [
      "Rotate at https://huggingface.co/settings/tokens",
      "Use fine-grained tokens with minimal scopes",
      "Store in environment variables (HF_TOKEN or HUGGING_FACE_HUB_TOKEN)",
    ],
  },

  // ─── Replicate ───────────────────────────────────────────
  {
    name: "Replicate API Token",
    regex: /r8_[A-Za-z0-9]{37}/g,
    severity: "high",
    description: "Replicate API token for running AI models.",
    remediation: [
      "Rotate at https://replicate.com/account/api-tokens",
      "Use environment variables (REPLICATE_API_TOKEN)",
      "Set spending limits on your Replicate account",
    ],
  },

  // ─── Stability AI ───────────────────────────────────────
  {
    name: "Stability AI API Key",
    regex: /sk-[A-Za-z0-9]{48,}/g,
    severity: "high",
    description: "Potential Stability AI API key for Stable Diffusion and other generative models.",
    remediation: [
      "Rotate at https://platform.stability.ai/account/keys",
      "Use environment variables (STABILITY_API_KEY)",
      "Proxy requests through backend services",
    ],
    contextRequired: ["stability", "Stability", "stable-diffusion", "stabilityai"],
  },

  // ─── Mistral AI ──────────────────────────────────────────
  {
    name: "Mistral AI API Key",
    regex: /[a-zA-Z0-9]{32}/g,
    severity: "high",
    description: "Potential Mistral AI API key.",
    remediation: [
      "Rotate at https://console.mistral.ai/api-keys",
      "Store in environment variables (MISTRAL_API_KEY)",
      "Use server-side proxying for web applications",
    ],
    contextRequired: ["mistral", "Mistral", "mistral.ai"],
  },

  // ─── Together AI ─────────────────────────────────────────
  {
    name: "Together AI API Key",
    regex: /[a-f0-9]{64}/g,
    severity: "high",
    description: "Potential Together AI API key (64-char hex string).",
    remediation: [
      "Rotate at https://api.together.xyz/settings/api-keys",
      "Use environment variables (TOGETHER_API_KEY)",
    ],
    contextRequired: ["together", "Together", "together.xyz", "togetherai"],
  },

  // ─── Pinecone ────────────────────────────────────────────
  {
    name: "Pinecone API Key",
    regex: /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g,
    severity: "high",
    description: "Potential Pinecone API key (UUID format) for vector database access.",
    remediation: [
      "Rotate at https://app.pinecone.io",
      "Use environment variables (PINECONE_API_KEY)",
      "Restrict access using Pinecone's project-level permissions",
    ],
    contextRequired: ["pinecone", "Pinecone", "pinecone.io"],
  },

  // ─── Stripe (common in AI billing) ──────────────────────
  {
    name: "Stripe Secret Key",
    regex: /sk_live_[A-Za-z0-9]{24,}/g,
    severity: "critical",
    description: "Stripe live secret key can process real payments and access customer data.",
    remediation: [
      "Rotate immediately at https://dashboard.stripe.com/apikeys",
      "Use restricted keys with minimum necessary permissions",
      "Never expose secret keys in frontend code; use Stripe.js with publishable keys only",
      "Enable Stripe's webhook signing for server-side validation",
    ],
  },
  {
    name: "Stripe Publishable Key (Live)",
    regex: /pk_live_[A-Za-z0-9]{24,}/g,
    severity: "low",
    description: "Stripe live publishable key. While designed for client-side use, verify it should be in this context.",
    remediation: [
      "Publishable keys are safe for client-side use but verify this is intentional",
      "Ensure the corresponding secret key is NOT exposed alongside it",
    ],
  },

  // ─── GitHub Token ────────────────────────────────────────
  {
    name: "GitHub Personal Access Token",
    regex: /ghp_[A-Za-z0-9]{36}/g,
    severity: "critical",
    description: "GitHub personal access token can access repositories, create commits, and manage settings.",
    remediation: [
      "Revoke at https://github.com/settings/tokens",
      "Use fine-grained PATs with minimal repository and permission scope",
      "Use GitHub Apps or deploy keys for CI/CD instead of personal tokens",
    ],
  },
  {
    name: "GitHub OAuth Access Token",
    regex: /gho_[A-Za-z0-9]{36}/g,
    severity: "critical",
    description: "GitHub OAuth access token.",
    remediation: [
      "Revoke the OAuth app authorization at https://github.com/settings/applications",
      "Use short-lived tokens where possible",
    ],
  },

  // ─── Slack ───────────────────────────────────────────────
  {
    name: "Slack Bot Token",
    regex: /xoxb-[0-9]{11,}-[0-9]{11,}-[A-Za-z0-9]{24}/g,
    severity: "high",
    description: "Slack bot token can read/write messages and access workspace data.",
    remediation: [
      "Rotate at https://api.slack.com/apps",
      "Use the minimum required OAuth scopes",
      "Store in environment variables (SLACK_BOT_TOKEN)",
    ],
  },
  {
    name: "Slack Webhook URL",
    regex: /https:\/\/hooks\.slack\.com\/services\/T[A-Za-z0-9]+\/B[A-Za-z0-9]+\/[A-Za-z0-9]+/g,
    severity: "medium",
    description: "Slack incoming webhook URL can post messages to a channel.",
    remediation: [
      "Regenerate the webhook at https://api.slack.com/apps",
      "Restrict webhook usage to server-side code only",
    ],
  },

  // ─── SendGrid ────────────────────────────────────────────
  {
    name: "SendGrid API Key",
    regex: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/g,
    severity: "high",
    description: "SendGrid API key for email sending services.",
    remediation: [
      "Rotate at https://app.sendgrid.com/settings/api_keys",
      "Use API keys with restricted permissions",
      "Store in environment variables (SENDGRID_API_KEY)",
    ],
  },

  // ─── Twilio ──────────────────────────────────────────────
  {
    name: "Twilio API Key",
    regex: /SK[a-f0-9]{32}/g,
    severity: "high",
    description: "Twilio API key for SMS, voice, and communication services.",
    remediation: [
      "Rotate at https://www.twilio.com/console",
      "Use separate API keys per environment (dev/staging/prod)",
      "Store in environment variables",
    ],
  },

  // ─── Generic patterns ───────────────────────────────────
  {
    name: "Private Key (PEM)",
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    severity: "critical",
    description: "Private key in PEM format found. This can be used for authentication, signing, or decryption.",
    remediation: [
      "Remove the private key from the codebase immediately",
      "Store private keys in a secure secrets manager or HSM",
      "Rotate the key pair if the private key was committed to version control",
      "Use ssh-agent or keychain for local development",
    ],
  },
  {
    name: "Generic API Key Assignment",
    regex: /(?:api[_-]?key|apikey|api[_-]?secret|api[_-]?token)\s*[:=]\s*['"][A-Za-z0-9_\-/.]{16,}['"]/gi,
    severity: "medium",
    description: "A variable named like an API key is assigned a string value. Verify this is not a real secret.",
    remediation: [
      "Move the value to an environment variable",
      "Use a .env file (excluded from version control) for local development",
      "Add the pattern to your .gitignore and secret scanning pre-commit hooks",
    ],
  },
  {
    name: "Generic Secret/Password Assignment",
    regex: /(?:password|passwd|secret|token|credential)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    severity: "medium",
    description: "A variable named like a secret is assigned a string value. Verify this is not a real credential.",
    remediation: [
      "Move sensitive values to environment variables",
      "Use a secrets manager for production deployments",
      "Never hardcode passwords or secrets in source code",
    ],
  },
  {
    name: "Bearer Token in Code",
    regex: /['"]Bearer\s+[A-Za-z0-9_\-/.=]{20,}['"]/g,
    severity: "high",
    description: "A hardcoded Bearer token was found. This token may grant authenticated access to an API.",
    remediation: [
      "Remove the hardcoded token and load it from environment variables at runtime",
      "Use OAuth2 token refresh flows instead of hardcoded tokens",
      "Rotate the token if it was committed to version control",
    ],
  },
];

module.exports = { patterns };
