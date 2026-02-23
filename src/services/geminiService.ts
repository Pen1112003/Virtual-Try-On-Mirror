import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function checkThumbsUp(base64Image: string): Promise<boolean> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: "image/jpeg",
            },
          },
          {
            text: "Is the person in this image doing a clear thumbs up gesture? Reply with only YES or NO.",
          },
        ],
      },
      config: {
        temperature: 0.1,
      },
    });

    const text = response.text?.trim().toUpperCase() || "";
    return text.includes("YES");
  } catch (error) {
    console.error("Error checking thumbs up:", error);
    return false;
  }
}

export async function guessMajor(base64Image: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: "image/jpeg",
            },
          },
          {
            text: "Based on this person's face and appearance, guess which university major fits them best: 'it' (Công Nghệ Thông Tin), 'biz' (Quản Trị Kinh Doanh), 'design' (Thiết Kế Đồ Họa), or 'media' (Truyền Thông). Reply with ONLY the ID: it, biz, design, or media.",
          },
        ],
      },
      config: {
        temperature: 0.7,
      },
    });

    const text = response.text?.trim().toLowerCase() || "";
    if (text.includes("it")) return "it";
    if (text.includes("biz")) return "biz";
    if (text.includes("design")) return "design";
    if (text.includes("media")) return "media";
    
    const majors = ["it", "biz", "design", "media"];
    return majors[Math.floor(Math.random() * majors.length)];
  } catch (error) {
    console.error("Error guessing major:", error);
    const majors = ["it", "biz", "design", "media"];
    return majors[Math.floor(Math.random() * majors.length)];
  }
}

export async function generateOutfit(base64Image: string, majorPrompt: string): Promise<string | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: "image/jpeg",
            },
          },
          {
            text: `Edit this image to make the person wear an outfit suitable for a student or professional in the field of: ${majorPrompt}. Keep the person's face, body pose, and the background exactly the same. Only change their clothes to something fashionable and appropriate for this major.`,
          },
        ],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Error generating outfit:", error);
    return null;
  }
}
