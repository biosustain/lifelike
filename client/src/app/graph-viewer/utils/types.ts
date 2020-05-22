// TODO: Replace it with the null coalescing operator when we get it
export function nullCoalesce(...items) {
  for (const item of items) {
    if (item != null) {
      return item;
    }
  }
  return null;
}
