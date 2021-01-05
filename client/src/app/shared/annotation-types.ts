export class EntityType {
  id: string;

  constructor(public name: string,
              public color: string) {
    this.id = name;
  }
}

export const ENTITY_TYPES = [
  new EntityType('Gene', '#673ab7'),
  new EntityType('Protein', '#bcbd22'),
  new EntityType('Disease', '#ff9800'),
  new EntityType('Species', '#3177b8'),
  new EntityType('Company', '#d62728'),
  new EntityType('Mutation', '#5d4037'),
  new EntityType('Chemical', '#4caf50'),
  new EntityType('Phenomena', '#edc949'),
  new EntityType('Phenotype', '#edc949'),
  new EntityType('Pathway', '#e377c2'),
  new EntityType('Entity', '#7f7f7f'),
  new EntityType('Compound', '#4caf50'),
  new EntityType('Food', '#8eff69'),
  new EntityType('Anatomy', '#0202bd'),
  new EntityType('Lab Strain', '#f71698'),
  new EntityType('Lab Sample', '#f71698')
];

export const ENTITY_TYPE_MAP = ENTITY_TYPES.reduce((map, item) => {
  map[item.id] = item;
  return map;
}, {});
