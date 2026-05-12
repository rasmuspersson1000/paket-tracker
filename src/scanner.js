const SEARCH_QUERY = 'tracking OR spårning OR shipment OR försändelse OR leverans OR "order shipped"';

function decodeBase64Url(str) {
  const binary = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function extractGmailBody(payload) {
  if (!payload) return { text: '', html: '' };
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    try { return { text: decodeBase64Url(payload.body.data), html: '' }; } catch { return { text: '', html: '' }; }
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    try { return { text: '', html: decodeBase64Url(payload.body.data) }; } catch { return { text: '', html: '' }; }
  }
  if (payload.parts) {
    let text = '';
    let html = '';
    for (const part of payload.parts) {
      const r = extractGmailBody(part);
      if (r.text) text = text || r.text;
      if (r.html) html = html || r.html;
    }
    return { text, html };
  }
  return { text: '', html: '' };
}

function extractLinks(html) {
  const urls = [];
  const re = /href=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    urls.push(m[1]);
  }
  return urls;
}

export class EmailScanner {
  async scanGmail(accessToken) {
    const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages` +
      `?q=${encodeURIComponent(SEARCH_QUERY)}&maxResults=50`;
    const listRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!listRes.ok) return [];
    const list = await listRes.json();
    if (!list.messages?.length) return [];

    const emails = await Promise.all(
      list.messages.map(async ({ id }) => {
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok) return null;
        const msg = await res.json();
        const headers = msg.payload?.headers ?? [];
        const subject = headers.find(h => h.name === 'Subject')?.value ?? '';
        const { text, html } = extractGmailBody(msg.payload);
        return { subject, body: text || html, links: extractLinks(html), source: 'gmail' };
      })
    );

    return emails.filter(Boolean);
  }

  async scanOutlook(accessToken) {
    const url = `https://graph.microsoft.com/v1.0/me/messages` +
      `?$search="${SEARCH_QUERY}"&$top=50&$select=subject,body`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.value ?? []).map(msg => {
      const html = msg.body?.contentType === 'html' ? (msg.body?.content ?? '') : '';
      return {
        subject: msg.subject ?? '',
        body: msg.body?.content ?? '',
        links: extractLinks(html),
        source: 'outlook',
      };
    });
  }
}
