
export function getFilenameFromContentDisposition(contentDisposition: string) {
  const fileNameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
  const matches = fileNameRegex.exec(contentDisposition);
  if (matches != null && matches[1]) {
    return matches[1].replace(/['"]/g, '');
  }
  return 'unknown';
}
