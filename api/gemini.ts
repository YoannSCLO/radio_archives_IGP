import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { action, payload } = req.body ?? {};

    if (action === "analyzeCase") {
      const { clinicalNote } = payload;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyse la note clinique suivante en radiologie :
"${clinicalNote}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              specialty: { type: Type.STRING },
              difficulty: { type: Type.STRING },
              summary: { type: Type.STRING },
            },
            required: ["specialty", "difficulty", "summary"],
          },
        },
      });

      const text = response.text;
      return res.status(200).json(text ? JSON.parse(text) : null);
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Gemini error" });
  }
}
