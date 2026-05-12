const SEARCH_QUERY = 'tracking OR spårning OR shipment OR försändelse OR leverans OR "order shipped"';

function decodeBase64Url(str) {
  const binary = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function extractGmailBody(payload) {
  if (!payload) return '';
  // Prefer text/plain, fall back to text/html
  if (payload.mimeType?.startsWith('text/') && payload.body?.data) {
    try { return decodeBase64Url(payload.body.data); } catch { return ''; }
  }
  if (payload.parts) {
    const plain = payload.parts.find(p => p.mimeType === 'text/plain');
    if (plain?.body?.data) {
      try { return decodeBase64Url(plain.body.data); } catch { return ''; }
    }
    // Recurse into nested multipart
    for (const part of payload.parts) {
      const result = extractGmailBody(part);
      if (result) return result;
    }
  }
  return '';
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
        const body = extractGmailBody(msg.payload);
        return { subject, body, source: 'gmail' };
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
    return (data.value ?? []).map(msg => ({
      subject: msg.subject ?? '',
      body: msg.body?.content ?? '',
      source: 'outlook',
    }));
  }
}
