import { writable } from "svelte/store";

function createThemeStore() {
  const isDark = writable(false);

  if (typeof window !== "undefined") {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    isDark.set(mediaQuery.matches);
    mediaQuery.addEventListener("change", (e) => {
      isDark.set(e.matches);
    });
  }

  return isDark;
}

export const isDarkMode = createThemeStore();
