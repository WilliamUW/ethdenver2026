export const runtime = "nodejs";

export async function POST() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "GEMINI_API_KEY is not set on the server." }, { status: 500 });
  }

  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Explain how AI works in a few words. Mention Global Credit Passport.",
                },
              ],
            },
          ],
        }),
      },
    );

    if (!res.ok) {
      const errorText = await res.text();
      return Response.json({ error: "Gemini API error", details: errorText }, { status: 500 });
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No content returned from Gemini.";

    return Response.json({ text });
  } catch (error) {
    console.error("Gemini debug error", error);
    return Response.json({ error: "Failed to call Gemini API." }, { status: 500 });
  }
}
