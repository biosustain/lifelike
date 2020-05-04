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
    background: '#d0c1eb'
  },
  {
    label: 'disease',
    color: DISEASE,
    background: '#ffe0b2'
  },
  {
    label: 'chemical',
    color: CHEMICAL,
    background: '#c8e7ca'
  },
  {
    label: 'mutation',
    color: MUTATION,
    background: '#d6c1ba'
  },
  {
    label: 'species',
    color: SPECIES,
    background: '#a0dafd'
  },
  {
    label: 'company',
    color: COMPANY,
    background: '#f3bdbe'
  },
  {
    label: 'study',
    color: STUDY,
    background: '#b3f0f6'
  },
  {
    label: 'protein',
    color: PROTEIN,
    background: '#f1f1b6'
  },
  {
    label: 'pathway',
    color: PATHWAY,
    background: '#f6d6ec'
  },
  {
    label: 'phenotype',
    color: PHENOTYPE,
    background: '#f9eec8'
  },
  {
    label: 'link',
    color: LINK,
    background: '#d8d8d8',
  },
  {
    label: 'entity',
    color: ENTITY,
    background: '#d8d8d8'
  },
  // Non-Entity types
  {
    label: 'correlation',
    color: CORRELATION,
    background: '#fff'
  },
  {
    label: 'cause',
    color: CAUSE,
    background: '#fff'
  },
  {
    label: 'effect',
    color: EFFECT,
    background: '#fff'
  },
  {
    label: 'observation',
    color: OBSERVATION,
    background: '#fff'
  },
  {
    label: 'association',
    color: ASSOCIATION,
    background: '#fff'
  },
];

function groupStyle(color) {
  return {
    borderWidth: 1,
    color: {
      background: '#fff'
    },
    font: {
      color
    }
  };
}

/**
 * Return group style dictionary for nodes of
 * different group types for vis-js network library
 */
function visJsGroupStyleFactory() {
    const groupStyleDict = {};

    annotationTypes.map(
        ann => {
            groupStyleDict[ann.label] = groupStyle(ann.color);
        }
    );

    return groupStyleDict;
}

export {
  annotationTypes,
  visJsGroupStyleFactory
};
