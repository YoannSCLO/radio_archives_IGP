
import { GoogleGenAI, Type } from "@google/genai";
import { Specialty, Difficulty, RadioCase } from "../types";

// Always use the process.env.API_KEY directly and use named parameters for initialization.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeCase = async (clinicalNote: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyse la note clinique suivante en radiologie et suggère la spécialité et le niveau de difficulté. 
      Note clinique: "${clinicalNote}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            specialty: {
              type: Type.STRING,
              description: "La spécialité radiologique"
            },
            difficulty: {
              type: Type.STRING,
              description: "Le niveau de difficulté suggéré"
            },
            summary: {
              type: Type.STRING,
              description: "Un court résumé professionnel du cas."
            }
          },
          required: ["specialty", "difficulty", "summary"]
        }
      }
    });

    // Access the text property directly (it's a property, not a method).
    const text = response.text;
    if (!text) return null;
    return JSON.parse(text.trim());
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return null;
  }
};

export const semanticSearch = async (query: string, cases: RadioCase[]) => {
  if (cases.length === 0) return null;

  const casesSummary = cases.map(c => ({
    id: c.id,
    diagnosis: c.diagnosis,
    note: c.clinicalNote
  }));

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Tu es un expert en radiologie. Analyse la requête de l'utilisateur: "${query}".
      Parmi la liste de cas suivante, identifie les 3 cas les plus pertinents sémantiquement, même si les mots exacts ne correspondent pas.
      Liste des cas: ${JSON.stringify(casesSummary)}`,
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
                  reason: { type: Type.STRING, description: "Pourquoi ce cas est pertinent ?" }
                },
                required: ["id", "reason"]
              }
            },
            suggestedKeywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Mots-clés médicaux reliés à la recherche."
            }
          },
          required: ["matches", "suggestedKeywords"]
        }
      }
    });

    // Access the text property directly (it's a property, not a method).
    const text = response.text;
    if (!text) return null;
    return JSON.parse(text.trim());
  } catch (error) {
    console.error("Semantic Search Error:", error);
    return null;
  }
};
