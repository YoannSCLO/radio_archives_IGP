import { RadioCase } from "../types";

export const analyzeCase = async (clinicalNote: string) => {
  const response = await fetch("/api/gemini", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "analyzeCase",
      payload: { clinicalNote },
    }),
  });

  if (!response.ok) {
    console.error("Analyze case failed");
    return null;
  }

  return response.json();
};

export const semanticSearch = async (query: string, cases: RadioCase[]) => {
  if (!cases.length) return null;

  const casesSummary = cases.map(c => ({
    id: c.id,
    diagnosis: c.diagnosis,
    note: c.clinicalNote,
  }));

  const response = await fetch("/api/gemini", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "semanticSearch",
      payload: { query, casesSummary },
    }),
  });

  if (!response.ok) {
    console.error("Semantic search failed");
    return null;
  }

  return response.json();
};
