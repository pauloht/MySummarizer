export function extractJson(result: string): string | null {
  // Regex explanation:
  // ```json\s*     Matches the opening tag and optional newline
  // ([\s\S]*?)     Captures everything inside (non-greedy)
  // \s*```         Matches the closing tag and optional whitespace
  const jsonMatch = result.match(/```json\s*([\s\S]*?)\s*```/);

  if (jsonMatch && jsonMatch[1]) {
    try {
      // jsonMatch[1] is the content inside the backticks
      return jsonMatch[1].trim();
    } catch (e) {
      console.error("Failed to parse extracted JSON:", e);
      return null;
    }
  }

  // Fallback: If it's not wrapped in backticks, try parsing the whole string
  try {
    return result;
  } catch (e) {
    return null;
  }
}
