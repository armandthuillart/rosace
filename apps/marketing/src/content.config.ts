import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({
    base: "./src/content/blog/",
    pattern: "**/*.mdx",
  }),
  schema: ({ image }) =>
    z.object({
      blurb: z.string(),
      cover: image(),
      date: z.coerce.date(),
      headline: z.string(),
      standfirst: z.string(),
    }),
});

const policies = defineCollection({
  loader: glob({
    base: "./src/content/policies/",
    pattern: "**/*.mdx",
  }),
  schema: z.object({
    date: z.coerce.date(),
    title: z.string(),
  }),
});

export const collections = {
  blog,
  policies,
};
