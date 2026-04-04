const https = require("https");
const http = require("http");
const { URL } = require("url");

/**
 * Fetch the HTML source of a URL.
 * Only fetches YOUR OWN websites for self-auditing purposes.
 *
 * @param {string} urlString - The URL to fetch
 * @param {number} timeout - Request timeout in ms (default 10000)
 * @returns {Promise<string>} The page source
 */
function fetchUrl(urlString, timeout = 10000) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(urlString);
    } catch {
      return reject(new Error(`Invalid URL: ${urlString}`));
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return reject(new Error(`Unsupported protocol: ${parsedUrl.protocol}. Only http/https allowed.`));
    }

    const client = parsedUrl.protocol === "https:" ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: "GET",
      timeout,
      headers: {
        "User-Agent": "SecretGuard/1.0 (Self-Audit Security Scanner)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    };

    const req = client.request(options, (res) => {
      // Follow redirects (up to 5)
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        return fetchUrl(res.headers.location, timeout).then(resolve).catch(reject);
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`HTTP ${res.statusCode} when fetching ${urlString}`));
      }

      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf-8");
        resolve(body);
      });
      res.on("error", reject);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Request timed out after ${timeout}ms: ${urlString}`));
    });

    req.on("error", reject);
    req.end();
  });
}

module.exports = { fetchUrl };
