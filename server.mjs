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
  const headOpen = html.indexOf("<head>");
  const headClose = html.indexOf("</head>");
  if (headOpen === -1 || headClose === -1 || headClose <= headOpen) return html;

  const headStart = headOpen + "<head>".length;
  const head = html.slice(headStart, headClose);
  const { remaining, tags } = pullSeoTags(head);
  if (!tags.length) return html;

  const { remaining: headWithoutEssentials, tags: essentialTags } = pullEssentialTags(remaining);
  const { titleTag, seoTags } = splitTitleAndSeoTags(tags);
  const reorderedHead = `${titleTag}${essentialTags.join("")}${seoTags.join("")}${headWithoutEssentials}`;
  return `${html.slice(0, headStart)}${reorderedHead}${html.slice(headClose)}`;
}

function interceptHtmlResponse(response) {
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
    const nextHtml = reorderHtmlHead(html);
    const body = Buffer.from(nextHtml, "utf8");
    if (!response.headersSent) {
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
    request.headers["accept-encoding"] = "identity";
    interceptHtmlResponse(response);
    await handle(request, response);
  } catch (error) {
    console.error(error);
    if (!response.headersSent) response.statusCode = 500;
    response.end("Internal Server Error");
  }
}).listen(port, hostname, () => {
  console.log(`> Ready on http://${hostname}:${port}`);
});
