import { createServer } from "node:http";
import next from "next";

const dev = process.env.NODE_ENV !== "production" && process.env.NEXT_RUNTIME_DEV === "1";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function isHtmlResponse(response) {
  const contentType = response.getHeader("content-type");
  return typeof contentType === "string" && contentType.toLowerCase().includes("text/html");
}

function shouldInterceptHtmlPath(pathname) {
  return !(
    /^\/(?:assets|_next)(?:\/|$)/i.test(pathname) ||
    /^\/(?:favicon(?:\.ico|\.svg)?|robots\.txt|sitemap(?:\.xml)?)(?:$|\/)/i.test(pathname)
  );
}

function tagKey(tag) {
  if (/^<title\b/i.test(tag)) return "title";
  if (/\bcharset=/i.test(tag)) return "meta:charset";
  const name = tag.match(/\bname=(["'])(.*?)\1/i)?.[2]?.toLowerCase();
  if (name) return `meta:name:${name}`;
  const httpEquiv = tag.match(/\bhttp-equiv=(["'])(.*?)\1/i)?.[2]?.toLowerCase();
  if (httpEquiv) return `meta:http-equiv:${httpEquiv}`;
  const property = tag.match(/\bproperty=(["'])(.*?)\1/i)?.[2]?.toLowerCase();
  if (property) return `meta:property:${property}`;
  const rel = tag.match(/\brel=(["'])(.*?)\1/i)?.[2]?.toLowerCase();
  if (rel === "canonical") return "link:canonical";
  const scriptType = tag.match(/\btype=(["'])(.*?)\1/i)?.[2]?.toLowerCase();
  const scriptId = tag.match(/\bid=(["'])(.*?)\1/i)?.[2]?.toLowerCase();
  if (scriptType === "application/ld+json") return `script:ld-json:${scriptId || tag}`;
  return tag;
}

function pullSeoTags(head) {
  const tags = [];
  const seen = new Set();
  const patterns = [
    /<title\b[^>]*>[\s\S]*?<\/title>/gi,
    /<meta\s+(?=[^>]*(?:name=(["'])(?:description|keywords|robots|twitter:[^"']+)\1|property=(["'])og:[^"']+\2))[^>]*>/gi,
    /<link\s+(?=[^>]*rel=(["'])canonical\1)[^>]*>/gi,
    /<script\b(?=[^>]*type=(["'])application\/ld\+json\1)[^>]*>[\s\S]*?<\/script>/gi
  ];
  let remaining = head;

  for (const pattern of patterns) {
    remaining = remaining.replace(pattern, (tag) => {
      const key = tagKey(tag);
      if (!seen.has(key)) {
        seen.add(key);
        tags.push(tag);
      }
      return "";
    });
  }

  return { remaining, tags };
}

function pullEssentialTags(head) {
  const tags = [];
  const seen = new Set();
  const pattern = /<meta\s+(?=[^>]*(?:charset=|name=(["'])viewport\1|http-equiv=(["'])Content-Language\2))[^>]*>/gi;
  const remaining = head.replace(pattern, (tag) => {
    const key = tagKey(tag);
    if (!seen.has(key)) {
      seen.add(key);
      tags.push(tag);
    }
    return "";
  });

  return { remaining, tags };
}

function splitTitleAndSeoTags(tags) {
  const titleIndex = tags.findIndex((tag) => /^<title\b/i.test(tag));
  if (titleIndex < 0) return { titleTag: "", seoTags: tags };
  return {
    titleTag: tags[titleIndex],
    seoTags: [...tags.slice(0, titleIndex), ...tags.slice(titleIndex + 1)]
  };
}

function reorderHtmlHead(html) {
  const bodyJsonLdTags = [];
  const withoutBodyJsonLd = html.replace(/<script\b(?=[^>]*data-storefront-json-ld=["']body-marker["'])[^>]*>[\s\S]*?<\/script>/gi, (tag) => {
    bodyJsonLdTags.push(
      tag
        .replace(/\sdata-storefront-json-ld=["'][^"']+["']/i, "")
        .replace(/\stype=["']application\/json["']/i, ' type="application/ld+json"')
        .replace(/\sid=["']storefront-json-ld-(\d+)["']/i, ' id="storefront-json-ld-head-$1"')
    );
    // Keep the original body marker in place for React hydration. The
    // head copy above is for crawlers; removing the body node makes the
    // server tree differ from the client tree on every JSON-LD storefront page.
    return tag;
  });
  const headOpen = withoutBodyJsonLd.indexOf("<head>");
  const headClose = withoutBodyJsonLd.indexOf("</head>");
  if (headOpen === -1 || headClose === -1 || headClose <= headOpen) return html;

  const headStart = headOpen + "<head>".length;
  const head = withoutBodyJsonLd.slice(headStart, headClose);
  const { remaining, tags } = pullSeoTags(head);
  if (!tags.length && !bodyJsonLdTags.length) return html;

  const { remaining: headWithoutEssentials, tags: essentialTags } = pullEssentialTags(remaining);
  const { titleTag, seoTags } = splitTitleAndSeoTags(tags);
  const existingHeadJsonLdIds = new Set([...head.matchAll(/id=["']storefront-json-ld-head-(\d+)["']/gi)].map((match) => match[1]));
  const uniqueBodyJsonLdTags = bodyJsonLdTags.filter((tag) => {
    const id = tag.match(/id=["']storefront-json-ld-head-(\d+)["']/i)?.[1];
    return !id || !existingHeadJsonLdIds.has(id);
  });
  const reorderedHead = `${titleTag}${essentialTags.join("")}${seoTags.join("")}${uniqueBodyJsonLdTags.join("")}${headWithoutEssentials}`;
  return `${withoutBodyJsonLd.slice(0, headStart)}${reorderedHead}${withoutBodyJsonLd.slice(headClose)}`;
}

function interceptHtmlResponse(response, { reorderHead = true, startedAt = process.hrtime.bigint() } = {}) {
  const chunks = [];
  const write = response.write.bind(response);
  const end = response.end.bind(response);
  const writeHead = response.writeHead.bind(response);
  const flushHeaders = response.flushHeaders.bind(response);
  let pendingWriteHead;

  function writePendingHead() {
    if (!pendingWriteHead) return;
    for (const arg of pendingWriteHead) {
      if (!arg || typeof arg !== "object" || Array.isArray(arg)) continue;
      delete arg["content-length"];
      delete arg["Content-Length"];
    }
    writeHead(...pendingWriteHead);
  }

  response.writeHead = (...args) => {
    pendingWriteHead = args;
    return response;
  };

  response.flushHeaders = () => undefined;

  response.write = (chunk, encoding, callback) => {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    if (typeof callback === "function") callback();
    return true;
  };

  response.end = (chunk, encoding, callback) => {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));

    if (!isHtmlResponse(response)) {
      if (pendingWriteHead) {
        writePendingHead();
      } else if (!response.headersSent) {
        flushHeaders();
      }
      for (const bufferedChunk of chunks) write(bufferedChunk);
      return end(undefined, undefined, callback);
    }

    const html = Buffer.concat(chunks).toString("utf8");
    // Semantic SEO content is owned by the active immutable publication.
    // The transport wrapper may reorder tags but must not rewrite copy.
    const nextHtml = reorderHead ? reorderHtmlHead(html) : html;
    const body = Buffer.from(nextHtml, "utf8");
    if (!response.headersSent) {
      const totalMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const existingServerTiming = response.getHeader("Server-Timing");
      const transportTiming = `ssr;dur=${totalMs.toFixed(1)}, html;dur=${totalMs.toFixed(1)};desc="${body.byteLength} bytes"`;
      response.setHeader("Server-Timing", existingServerTiming ? `${existingServerTiming}, ${transportTiming}` : transportTiming);
      response.removeHeader("content-length");
      response.setHeader("content-length", String(body.length));
      if (pendingWriteHead) writePendingHead();
    }
    return end(body, undefined, callback);
  };
}

await app.prepare();

createServer(async (request, response) => {
  try {
    const startedAt = process.hrtime.bigint();
    request.headers["accept-encoding"] = "identity";
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const requestHost = requestUrl.host.split(":")[0].toLowerCase();
    const isAidreamcapesEuRequest =
      /^\/site\/aidreamcapes-eu(?:\/|$)/i.test(requestUrl.pathname) ||
      /^(?:www\.)?aidreamcapes\.eu$/i.test(requestHost);
    if (shouldInterceptHtmlPath(requestUrl.pathname)) {
      interceptHtmlResponse(response, { reorderHead: !isAidreamcapesEuRequest, startedAt });
    }
    await handle(request, response);
  } catch (error) {
    console.error(error);
    if (!response.headersSent) response.statusCode = 500;
    response.end("Internal Server Error");
  }
}).listen(port, hostname, () => {
  console.log(`> Ready on http://${hostname}:${port}`);
});
