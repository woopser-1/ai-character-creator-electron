const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const URL_PATTERN = /^https?:\/\/(?:www\.)?ourdream\.ai\/c\/[^/?#]+/i;

export function isOurDreamCharacterUrl(value: string): boolean {
  return URL_PATTERN.test(value.trim());
}

export type OurDreamExtractResult =
  | { success: true; profileImageUrl: string }
  | { success: false; error: string };

export async function extractOurDreamProfileImage(
  url: string
): Promise<OurDreamExtractResult> {
  const trimmed = url.trim();
  if (!isOurDreamCharacterUrl(trimmed)) {
    return {
      success: false,
      error: "URL must look like https://ourdream.ai/c/<character-slug>",
    };
  }

  let res: Response;
  try {
    res = await fetch(trimmed, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
    });
  } catch (err) {
    return { success: false, error: `Network error: ${String(err)}` };
  }

  if (!res.ok) {
    return { success: false, error: `OurDream returned HTTP ${res.status}` };
  }
  const html = await res.text();
  const found = findFirstDisplayImageUrl(html);
  if (!found) {
    return {
      success: false,
      error: "Could not find a character image in the page HTML",
    };
  }
  return { success: true, profileImageUrl: found };
}

function findFirstDisplayImageUrl(html: string): string | null {
  const thumbRe =
    /https:\/\/img\.ourdream\.ai\/thumb\/[A-Za-z0-9-]+(?:\?(?:[^"\s\\]|\\u[0-9a-fA-F]{4})*)?/;
  const thumbMatch = html.match(thumbRe);
  if (thumbMatch) {
    return decodeEmbeddedUrl(thumbMatch[0]);
  }
  const mediaRe =
    /https:\/\/media\.ourdream\.ai\/[A-Za-z0-9._\/-]+(?:\?(?:[^"\s\\]|\\u[0-9a-fA-F]{4})*)?/;
  const mediaMatch = html.match(mediaRe);
  if (mediaMatch && !mediaMatch[0].includes("opengraph_hero_image")) {
    return decodeEmbeddedUrl(mediaMatch[0]);
  }
  return null;
}

function decodeEmbeddedUrl(raw: string): string {
  return raw.replace(/\\u0026/g, "&").replace(/\\\//g, "/").replace(/\\"/g, '"');
}
