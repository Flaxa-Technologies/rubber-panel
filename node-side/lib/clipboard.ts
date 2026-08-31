/**
 * Universal clipboard copy helper with legacy fallback for non-secure contexts (HTTP IP addresses like http://192.168.1.3:3001)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // Modern navigator.clipboard API (works in HTTPS or localhost)
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}

  // Fallback for non-secure contexts (HTTP over IP addresses)
  try {
    if (typeof document !== "undefined") {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.top = "0";
      textarea.style.left = "0";
      textarea.style.width = "2em";
      textarea.style.height = "2em";
      textarea.style.padding = "0";
      textarea.style.border = "none";
      textarea.style.outline = "none";
      textarea.style.boxShadow = "none";
      textarea.style.background = "transparent";
      textarea.style.opacity = "0";
      textarea.setAttribute("readonly", "");

      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, text.length);

      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);
      return successful;
    }
  } catch {}

  return false;
}
