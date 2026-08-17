const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const sites = [
  { slug: "mydreamshoots", cookieSiteId: "site_dreamshoot", publicPath: "/ai-video-generation/talking-photo" },
  { slug: "aidreamcapes", cookieSiteId: "site_aidreamcapes" }
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, headers = {}) {
  return fetch(`${baseUrl}${path}`, {
    headers,
    redirect: "manual"
  });
}

async function smokeWorkspaceRoute() {
  for (const site of sites) {
    const workspacePath = `/site/${site.slug}/app/create#step-video`;
    if (site.publicPath) {
      const publicResponse = await request(`/site/${site.slug}${site.publicPath}`);
      assert(publicResponse.status === 200, `${site.slug} talking-photo route should be public, received ${publicResponse.status}`);
    }

    const guestResponse = await request(workspacePath);
    assert(guestResponse.status === 307, `${site.slug} guest workspace entry should redirect to login, received ${guestResponse.status}`);
    assert(
      (guestResponse.headers.get("location") || "").startsWith(`/site/${site.slug}/login?next=`),
      `${site.slug} guest workspace redirect should preserve the site login path, received ${guestResponse.headers.get("location") || "none"}`
    );

    const staleSessionResponse = await request(workspacePath, {
      Cookie: `customer_session_${site.cookieSiteId}=stale-session`
    });
    assert(
      staleSessionResponse.status === 307,
      `${site.slug} stale customer session should recover to login instead of 404, received ${staleSessionResponse.status}`
    );
    assert(
      (staleSessionResponse.headers.get("location") || "").startsWith(`/site/${site.slug}/login?next=`),
      `${site.slug} stale customer session should redirect to the site login path, received ${staleSessionResponse.headers.get("location") || "none"}`
    );
  }

  console.log("OK: public talking-photo, guest workspace, and stale-session workspace routes are healthy");
}

smokeWorkspaceRoute().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
