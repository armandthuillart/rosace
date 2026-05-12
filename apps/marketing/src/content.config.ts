import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { defineCollection } from 'astro:content';

const docs = defineCollection({
  loader: glob({
    base: './src/content/docs/',
    pattern: '**/*.mdx',
  }),
  schema: z.object({
    date: z.coerce.date(),
    title: z.string(),
  }),
});

export const collections = { docs };
