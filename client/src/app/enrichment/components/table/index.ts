function isEnrichmentTable({type, name}) {
  const [fileName, ...extensions] = name.split('.');
  return (
    type === 'file' &&
    extensions.length == 1 &&
    extensions[0] === 'enrichment'
  );
}
