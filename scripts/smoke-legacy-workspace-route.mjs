const baseUrl = (process.env.SMOKE_BASE_URL || "https://www.mydreamshoots.com").replace(/\/$/, "");
const host = process.env.SMOKE_PUBLIC_HOST || new URL(baseUrl).host;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function checkLegacyWorkspaceRoute() {
  const response = await fetch(`${baseUrl}/workspace`, {
    redirect: "manual"
  });
  const location = response.headers.get("location") || "";
  assert(response.status === 307, `legacy /workspace should redirect to login for a guest, received ${response.status}`);
  assert(location.startsWith("/login?next="), `legacy /workspace should preserve a login next path, received ${location || "none"}`);
  console.log(`OK: ${host}/workspace redirects guests to ${location}`);
}

checkLegacyWorkspaceRoute().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
