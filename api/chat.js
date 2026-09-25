export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const messages = Array.isArray(body.messages)
      ? body.messages.filter(m => m && (m.role === "user" || m.role === "assistant")).slice(-12)
      : [];

    if (!messages.length) {
      return res.status(400).json({ error: "Please enter a message." });
    }

    const apiKey = process.env.POLLINATIONS_API_KEY;

    // Current Pollinations API: OpenAI-compatible chat completions.
    if (apiKey) {
      const response = await fetch("https://gen.pollinations.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openai",
          messages: [
            {
              role: "system",
              content: "You are czX AI. Reply in English unless the user asks for another language. Keep replies clear, friendly, and concise."
            },
            ...messages.map(m => ({
              role: m.role,
              content: String(m.content || "").slice(0, 2000)
            }))
          ]
        })
      });

      const data = await response.json().catch(() => ({}));
      const reply = data?.choices?.[0]?.message?.content?.trim();

      if (!response.ok || !reply) {
        return res.status(502).json({
          error: data?.error?.message || "The AI service returned no response."
        });
      }

      return res.status(200).json({ reply });
    }

    // Compatibility fallback for deployments that still expose the legacy
    // free text endpoint.
    const userPrompt = messages.map(m =>
      (m.role === "assistant" ? "czX AI: " : "User: ") + String(m.content || "")
    ).join("\n");

    const legacy = await fetch(
      "https://text.pollinations.ai/" + encodeURIComponent(
        "You are czX AI. Reply clearly and concisely.\n" + userPrompt
      )
    );
    const legacyReply = (await legacy.text()).trim();

    if (!legacy.ok || !legacyReply) {
      return res.status(503).json({
        error: "AI is not configured yet. Add POLLINATIONS_API_KEY in Vercel Environment Variables, then redeploy."
      });
    }

    return res.status(200).json({ reply: legacyReply });
  } catch (error) {
    return res.status(500).json({
      error: "The AI service could not be reached. Check the Vercel AI configuration."
    });
  }
}
