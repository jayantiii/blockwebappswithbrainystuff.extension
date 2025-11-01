// Lightweight DOM and timing utilities exposed globally
(function () {
  function $(id) { return document.getElementById(id); }
  function on(el, evt, fn, opts) { if (el) el.addEventListener(evt, fn, opts); }
  function debounce(fn, wait = 250, ctx) {
    let t;
    return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(ctx || this, args), wait); };
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function markdownToHtml(markdown) {
    if (!markdown) return '';
    let html = String(markdown);
    
    html = escapeHtml(html);
    
    const lines = html.split('\n');
    let inList = false;
    const processed = [];
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const trimmed = line.trim();
      const bulletMatch = trimmed.match(/^[\*\-]\s+(.+)$/);
      
      if (bulletMatch) {
        if (!inList) {
          processed.push('<ul>');
          inList = true;
        }
        processed.push(`___BULLET_ITEM___${bulletMatch[1]}___BULLET_END___`);
      } else {
        if (inList) {
          processed.push('</ul>');
          inList = false;
        }
        processed.push(line);
      }
    }
    
    if (inList) processed.push('</ul>');
    html = processed.join('\n');
    
    html = html.replace(/\*\*([^*]+?)\*\*/g, '___BOLD_PLACEHOLDER___$1___BOLD_END___');
    html = html.replace(/\*([^*]+?)\*/g, '<em>$1</em>');
    html = html.replace(/___BOLD_PLACEHOLDER___([^_]+?)___BOLD_END___/g, '<strong>$1</strong>');
    html = html.replace(/___BULLET_ITEM___([^_]+?)___BULLET_END___/g, '<li>$1</li>');
    html = html.replace(/\n\n+/g, '</p><p>');
    
    const finalLines = html.split('\n');
    const wrapped = [];
    for (let line of finalLines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.match(/^<[uodl]|^<\/[uodl]|^<li|^<\/li|^<p|^<\/p|^<strong|^<\/strong|^<em|^<\/em/)) {
        if (!trimmed.startsWith('<')) {
          wrapped.push(`<p>${trimmed}</p>`);
        } else {
          wrapped.push(line);
        }
      } else if (!trimmed) {
        wrapped.push('<br>');
      } else {
        wrapped.push(line);
      }
    }
    return wrapped.join('\n');
  }

  function parseFirstJson(s) {
    if (!s) return null;
    let t = String(s).trim();
    if (t.startsWith('```')) t = t.replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
    const i = t.indexOf('{'), j = t.lastIndexOf('}');
    if (i < 0 || j <= i) return null;
    try { return JSON.parse(t.slice(i, j + 1)); } catch { return null; }
  }

  function sanitizeMarkdownLink(url) {
    const match = url.match(/https?:\/\/[^\)]+/);
    return match ? match[0] : url;
  }

  window.AppUtils = { $, on, debounce, escapeHtml, markdownToHtml, parseFirstJson, sanitizeMarkdownLink };
})();


