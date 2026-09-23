const SITE_PASSWORD = "cxZ1!";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    if (body.password !== SITE_PASSWORD) {
      return res.status(401).json({ error: "Invalid password" });
    }

    res.setHeader(
      "Set-Cookie",
      "czx_auth=1; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800"
    );
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(400).json({ error: "Invalid request" });
  }
}
