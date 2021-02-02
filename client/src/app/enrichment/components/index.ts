function isEnrichment({type, name}) {
  const [fileName, ...extensions] = name.split('.');
  return (
    type === 'file' &&
    extensions[0] === 'enrichment'
  );
}
