// TODO - Create sub-types for mutation
// - snp
// - sub
// - del
// - ins
// - mob
// - amp
// - con
// - inv

const GENE = '#673ab7';
const DISEASE = '#ff9800';
const CHEMICAL = '#4caf50';
const MUTATION = '#5d4037';
const SPECIES = '#0277bd';
const COMPANY = '#d62728';
const STUDY = '#17becf';
const PROTEIN = '#bcbd22';
const PATHWAY = '#e377c2';
const PHENOTYPE = '#edc949';

const NOTE  = '#edc949';
const MAP = '#0277bd';

const ENTITY = '#7f7f7f';
const LINK = '#7f7f7f';

// Non-Entity Types
const CORRELATION = '#d7d9f8';
const CAUSE = '#d7d9f8';
const EFFECT = '#d7d9f8';
const OBSERVATION = '#d7d9f8';
const ASSOCIATION = '#d7d9f8';

const annotationTypes = [{
    label: 'gene',
    color: GENE,
  },
  {
    label: 'disease',
    color: DISEASE,
  },
  {
    label: 'chemical',
    color: CHEMICAL,
  },
  {
    label: 'mutation',
    color: MUTATION,
  },
  {
    label: 'species',
    color: SPECIES,
  },
  {
    label: 'company',
    color: COMPANY,
  },
  {
    label: 'study',
    color: STUDY,
  },
  {
    label: 'protein',
    color: PROTEIN,
  },
  {
    label: 'pathway',
    color: PATHWAY,
  },
  {
    label: 'phenotype',
    color: PHENOTYPE,
  },
  {
    label: 'link',
    color: LINK,
  },
  {
    label: 'entity',
    color: ENTITY,
  },
  {
    label: 'map',
    color: MAP,
    iconCode: '\uf279'
  },
  {
    label: 'note',
    color: NOTE,
    iconCode: '\uf249'
  },
  // Non-Entity types
  {
    label: 'correlation',
    background: CORRELATION,
  },
  {
    label: 'cause',
    background: CAUSE,
  },
  {
    label: 'effect',
    background: EFFECT,
  },
  {
    label: 'observation',
    background: OBSERVATION,
  },
  {
    label: 'association',
    background: ASSOCIATION,
  },
];

function groupStyle(ann) {
  const gStyle: any = {
    borderWidth: 1,
    color: {
      background: ann.background || '#FFF',
      border: ann.border || '#2B7CE9'
    },
    font: {
      color: ann.color || '#000'
    }
  };

  if (ann.iconCode) {
    gStyle.icon = {
      face: 'FontAwesome',
      weight: 'bold',
      code: ann.iconCode,
      size: 50,
      color: ann.color
    };
    gStyle.shape = 'icon';
  }

  return gStyle;
}

/**
 * Return group style dictionary for nodes of
 * different group types for vis-js network library
 */
function visJsGroupStyleFactory() {
    const groupStyleDict = {};

    annotationTypes.map(
        ann => {
            groupStyleDict[ann.label] = groupStyle(ann);
        }
    );

    return groupStyleDict;
}

export {
  annotationTypes,
  visJsGroupStyleFactory
};
