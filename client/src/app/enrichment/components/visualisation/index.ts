function isEnrichmentVisualisation({type, name}) {
  const [fileName, ...extensions] = name.split('.');
  return (
    type === 'file' &&
    extensions.length == 2 &&
    extensions[0] === 'enrichment' &&
    extensions[1] == 'visualisation'
  );
}
