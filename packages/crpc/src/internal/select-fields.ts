function selectFields<T extends Record<string, unknown> | null>(
  row: T,
  fields?: string[],
): T | Record<string, unknown> | null {
  if (!row || !fields?.length) return row;

  const selected = Object.fromEntries(
    fields
      .map((field) => [field, (row as Record<string, unknown>)[field]])
      .filter(([, value]) => value !== undefined),
  );

  const withId = row as Record<string, unknown>;
  if (withId.id !== undefined) selected.id = withId.id;
  if (withId.createdAt !== undefined) selected.createdAt = withId.createdAt;

  return selected;
}

export { selectFields };
