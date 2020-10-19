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
  new EntityType('Disease', '#fae0b8'),
  new EntityType('Species', '#3177b8'),
  new EntityType('Company', '#ff7f7f'),
  new EntityType('Mutation', '#8b5d2e'),
  new EntityType('Chemical', '#cee5cb'),
  new EntityType('Phenotype', '#edc949'),
  new EntityType('Pathway', '#90eebf'),
  new EntityType('Entity', '#7f7f7f'),
  new EntityType('Compound', '#cee5cb'),
  new EntityType('Food', '#8eff69'),
  new EntityType('Anatomy', '#0202bd')
];

export const ENTITY_TYPE_MAP = ENTITY_TYPES.reduce((map, item) => {
  map[item.id] = item;
  return map;
}, {});
