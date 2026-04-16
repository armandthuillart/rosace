import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function renderTemplate(templateRoot: string, templateName: string): string {
  return readFileSync(resolve(templateRoot, templateName), "utf-8");
}

export { renderTemplate };
