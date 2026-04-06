import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";
import { assertAuthenticated } from "../lib/authCore";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!assertAuthenticated(req, res)) {
    return;
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

    if (action === "semanticSearch") {
      const { query, casesSummary } = payload ?? {};
      if (typeof query !== "string" || !Array.isArray(casesSummary)) {
        return res.status(400).json({ error: "Invalid semanticSearch payload" });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Tu es un assistant pour classer des cas de radiologie pédagogiques.
Requête utilisateur: "${query}"

Liste des cas (résumés):
${JSON.stringify(casesSummary, null, 0)}

Réponds UNIQUEMENT en JSON avec ce schéma:
{"matches":[{"id":"id du cas","reason":"courte justification"}],"suggestedKeywords":["mot1","mot2"]}
Inclus uniquement les cas pertinents (matches peut être vide). Les id doivent exister dans la liste.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              matches: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    reason: { type: Type.STRING },
                  },
                  required: ["id", "reason"],
                },
              },
              suggestedKeywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ["matches", "suggestedKeywords"],
          },
        },
      });

      const text = response.text;
      return res.status(200).json(text ? JSON.parse(text) : { matches: [], suggestedKeywords: [] });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Gemini error" });
  }
}
