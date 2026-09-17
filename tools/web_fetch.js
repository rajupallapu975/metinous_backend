const { BaseTool } = require('./base');

class WebFetchTool extends BaseTool {
  constructor() {
    super({
      name: 'web_fetch',
      description: 'Fetches, sanitizes, and extracts readable text from public web URLs with SSRF protection.',
      category: 'WEB_FETCH',
    });
  }

  /**
   * SSRF Validator: Blocks private, local, and reserved network addresses
   */
  validateUrl(rawUrl) {
    try {
      const parsed = new URL(rawUrl);

      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { valid: false, reason: `Unsupported protocol: '${parsed.protocol}'. Only http/https allowed.` };
      }

      const hostname = parsed.hostname.toLowerCase();

      // Block local/internal hostnames
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname === '::1' ||
        hostname.endsWith('.localhost') ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal') ||
        hostname.endsWith('.lan')
      ) {
        return { valid: false, reason: `Access to local/loopback address '${hostname}' is forbidden.` };
      }

      // Block IPv4 private ranges (10.x.x.x, 172.16.x.x - 172.31.x.x, 192.168.x.x, 169.254.x.x)
      const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
      if (ipMatch) {
        const [_, a, b] = ipMatch.map(Number);
        if (
          a === 10 ||
          (a === 172 && b >= 16 && b <= 31) ||
          (a === 192 && b === 168) ||
          (a === 169 && b === 254) ||
          a === 127 ||
          a === 0
        ) {
          return { valid: false, reason: `Access to private IP range '${hostname}' is forbidden.` };
        }
      }

      return { valid: true, url: parsed.toString() };
    } catch (err) {
      return { valid: false, reason: `Invalid URL format: ${err.message}` };
    }
  }

  /**
   * Sanitizes raw HTML and converts to readable plain text
   */
  extractReadableText(html, maxLength = 4000) {
    if (!html || typeof html !== 'string') return { title: '', content: '' };

    // Extract title
    let title = '';
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    // Strip unneeded tags: script, style, noscript, nav, footer, header, svg, iframe
    let cleaned = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, ''); // strip HTML comments

    // Replace block tags with newlines
    cleaned = cleaned
      .replace(/<\/(p|div|h[1-6]|li|tr|article|section|blockquote)>/gi, '\n')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<[^>]+>/g, ' '); // Strip remaining tags

    // Decode standard HTML entities
    cleaned = cleaned
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–');

    // Normalize multiple whitespace and newlines
    const formatted = cleaned
      .split('\n')
      .map(line => line.replace(/\s+/g, ' ').trim())
      .filter(line => line.length > 0)
      .join('\n');

    // Trim to maxLength
    const truncated = formatted.length > maxLength
      ? formatted.substring(0, maxLength) + '...\n[Content truncated]'
      : formatted;

    return {
      title: title || 'Web Page Document',
      content: truncated,
    };
  }

  async fetchPage(targetUrl, maxChars = 4000, timeoutMs = 10000) {
    const validation = this.validateUrl(targetUrl);
    if (!validation.valid) {
      return {
        success: false,
        url: targetUrl,
        error: validation.reason,
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      console.log(`[WEB_FETCH] Fetching URL: ${validation.url}`);
      const response = await fetch(validation.url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 MetinousAI/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          url: targetUrl,
          error: `HTTP ${response.status} (${response.statusText})`,
        };
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text') && !contentType.includes('html') && !contentType.includes('json')) {
        return {
          success: false,
          url: targetUrl,
          error: `Unsupported content type '${contentType}'. Only text/html pages can be parsed.`,
        };
      }

      const rawHtml = await response.text();
      const extracted = this.extractReadableText(rawHtml, maxChars);

      return {
        success: true,
        url: validation.url,
        title: extracted.title,
        content: extracted.content,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      return {
        success: false,
        url: targetUrl,
        error: `Fetch failed: ${err.message}`,
      };
    }
  }

  async execute(params = {}) {
    const url = params.url || params.targetUrl || '';
    const res = await this.fetchPage(url);

    return {
      success: res.success,
      data: res,
      sources: res.success ? [{ title: res.title, url: res.url, content: res.content }] : [],
    };
  }
}

module.exports = {
  WebFetchTool,
  webFetchTool: new WebFetchTool(),
};
