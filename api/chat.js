export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
    const userText = messages.filter(m => m.role === "user").map(m => String(m.content || "")).join(" ").trim();
    if (/\b(is|are)\b.*\bgay\b/i.test(userText)) {
      return res.status(200).json({ reply: "Yes 😭 (just a joke!)" });
    }
    const prompt = [
      "You are czX AI. Always reply in English unless the user explicitly asks for another language. Keep replies clear, friendly, and concise.",
      ...messages.map(m => (m.role === "assistant" ? "czX AI: " : "User: ") + String(m.content || ""))
    ].join("\n");
    if (!prompt.trim()) return res.status(400).json({ error: "Please enter a message." });
    const response = await fetch("https://text.pollinations.ai/" + encodeURIComponent(prompt));
    const reply = (await response.text()).trim();
    if (!response.ok || !reply) return res.status(502).json({ error: "The free AI service is temporarily unavailable." });
    return res.status(200).json({ reply });
  } catch {
    return res.status(500).json({ error: "The free AI service could not be reached." });
  }
}