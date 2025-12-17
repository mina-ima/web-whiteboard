import { GoogleGenAI, Type } from "@google/genai";

const getAiClient = () => {
  const apiKey =
    import.meta.env.VITE_GEMINI_API_KEY ||
    import.meta.env.VITE_API_KEY ||
    process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY is not defined");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateBrainstormingIdeas = async (topic: string): Promise<string[]> => {
  const ai = getAiClient();
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate 5 short, concise ideas or key points about: "${topic}". keep them under 10 words each.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as string[];
  } catch (error) {
    console.error("Error generating ideas:", error);
    throw error;
  }
};

export const analyzeBoard = async (imageData: string): Promise<string> => {
  const ai = getAiClient();
  
  // Strip the prefix if present (e.g., "data:image/png;base64,")
  const base64Data = imageData.split(',')[1] || imageData;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: base64Data
            }
          },
          {
            text: "Analyze this whiteboard session. Summarize the key themes found in the drawings and sticky notes. If there are action items, list them. Be concise."
          }
        ]
      }
    });

    return response.text || "ボードを解析できませんでした。";
  } catch (error) {
    console.error("Error analyzing board:", error);
    return "AIアシスタントに接続できませんでした。";
  }
};
