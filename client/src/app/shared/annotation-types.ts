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
  new EntityType('Species', '#0277bd'),
  new EntityType('Companies', '#d62728'),
  new EntityType('Mutations', '#5d4037'),
  new EntityType('Chemical', '#4caf50'),
  new EntityType('Phenotype', '#edc949'),
  new EntityType('Pathways', '#e377c2'),
  new EntityType('Entities', '#7f7f7f'),
  new EntityType('Compound', '#4caf50'),
  new EntityType('Food', '#8eff69'),
  new EntityType('Anatomy', '#0202bd')
];

export const ENTITY_TYPE_MAP = ENTITY_TYPES.reduce((map, item) => {
  map[item.id] = item;
  return map;
}, {});
