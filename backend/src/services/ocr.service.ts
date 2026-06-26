import Tesseract from "tesseract.js";

export async function extractTextFromImage(imageBuffer: Buffer): Promise<string> {
  const { data } = await Tesseract.recognize(imageBuffer, "eng", {
    logger: () => {},
  });
  return data.text.trim();
}
