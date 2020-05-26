// TODO: Replace it with the null coalescing operator when we get it
export function nullCoalesce(...items) {
  for (const item of items) {
    if (item != null) {
      return item;
    }
  }
  return null;
}

export function emptyIfNull(s: any) {
  if (s == null) {
    return '';
  } else {
    return '' + s;
  }
}

export function nullIfEmpty(s: any) {
  if (s == null) {
    return null;
  } else if (!s.length) {
    return null;
  } else {
    return s;
  }
}

// TODO: Move this somewhere better
type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};
