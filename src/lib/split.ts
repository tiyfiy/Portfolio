/**
 * Wraps every character of an element's text in `.char` spans grouped into
 * `.word` spans (overflow:hidden), so characters can slide in from below.
 * Idempotent enough for React strict-mode double effects: it always rebuilds
 * from the element's current text content.
 */
export function splitChars(el: HTMLElement): HTMLElement[] {
  const text = (el.textContent ?? "").trim();
  el.textContent = "";
  el.setAttribute("aria-label", text);

  const chars: HTMLElement[] = [];
  const words = text.split(/\s+/);

  words.forEach((word, i) => {
    const w = document.createElement("span");
    w.className = "word";
    w.setAttribute("aria-hidden", "true");
    for (const ch of word) {
      const c = document.createElement("span");
      c.className = "char";
      c.textContent = ch;
      w.appendChild(c);
      chars.push(c);
    }
    el.appendChild(w);
    if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
  });

  return chars;
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
