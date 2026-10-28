/**
 * Agent chat smoke: verifies the workspace agent-chat routes exist, reject
 * unauthenticated access, and — when a customer session cookie is provided
 * (SMOKE_AGENT_CHAT_COOKIE="customer_session=...") — complete a streamed
 * round-trip with the mock text provider.
 *
 * Usage: SMOKE_BASE_URL=http://localhost:3000 node scripts/smoke-aidreamcapes-agent-chat.mjs
 */
const base = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const siteId = "site_aidreamcapes";
const root = `${base}/api/sites/${siteId}/aivideosugc/chat`;
const cookie = process.env.SMOKE_AGENT_CHAT_COOKIE ?? "";

async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(`${root}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { cookie } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return response;
}

let failures = 0;
async function check(name, run) {
  try {
    await run();
    console.log(`ok ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

await check("conversations require authentication", async () => {
  const response = await fetch(`${root}/conversations`, { headers: cookie ? {} : { cookie: "customer_session=invalid" } });
  if (response.status !== 401) throw new Error(`expected 401, got ${response.status}`);
});

await check("sending messages requires authentication", async () => {
  const response = await fetch(`${root}/conversations/conv_smoke/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: "customer_session=invalid" },
    body: JSON.stringify({ content: "hello" })
  });
  if (response.status !== 401) throw new Error(`expected 401, got ${response.status}`);
});

if (cookie) {
  await check("authenticated conversation round-trip", async () => {
    const created = await request("/conversations", { method: "POST", body: {} });
    if (!created.ok) throw new Error(`create failed: ${created.status}`);
    const { conversation } = await created.json();
    try {
      const stream = await request(`/conversations/${conversation.id}/messages`, {
        method: "POST",
        body: { content: "smoke test message" }
      });
      if (!stream.ok) throw new Error(`send failed: ${stream.status}`);
      const text = await stream.text();
      if (!text.includes("mock assistant reply")) throw new Error("stream did not contain mock reply");
      const messages = await request(`/conversations/${conversation.id}`);
      if (!messages.ok) throw new Error(`fetch messages failed: ${messages.status}`);
      const payload = await messages.json();
      if (payload.messages?.length !== 2) throw new Error(`expected 2 persisted messages, got ${payload.messages?.length}`);
    } finally {
      await request(`/conversations/${conversation.id}`, { method: "DELETE" });
    }
  });
} else {
  console.log("skip authenticated round-trip (set SMOKE_AGENT_CHAT_COOKIE to enable)");
}

if (failures) {
  console.error(`${failures} smoke check(s) failed`);
  process.exit(1);
}
console.log("agent chat smoke passed");
