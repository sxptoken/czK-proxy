export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const key = process.env.AI_API_KEY;
  if (!key) return res.status(500).json({ error: "AI_API_KEY is not configured." });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + key
      },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        instructions: "You are czX AI, a helpful assistant on the czX website. Keep replies clear and concise.",
        input: messages,
        max_output_tokens: 700
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || "AI request failed." });

    res.status(200).json({ reply: data.output_text || "I could not generate a response." });
  } catch {
    res.status(500).json({ error: "The AI service could not be reached." });
  }
}
