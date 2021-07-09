import { annotationTypesMap } from 'app/shared/annotation-styles';

export class EntityType {
  id: string;

  constructor(public name: string,
              public color: string) {
    this.id = name;
  }
}

export const ENTITY_TYPES = [
  new EntityType('Gene', annotationTypesMap.get('gene').color),
  new EntityType('Protein', annotationTypesMap.get('protein').color),
  new EntityType('Disease', annotationTypesMap.get('disease').color),
  new EntityType('Species', annotationTypesMap.get('species').color),
  new EntityType('Company', annotationTypesMap.get('company').color),
  new EntityType('Mutation', annotationTypesMap.get('mutation').color),
  new EntityType('Chemical', annotationTypesMap.get('chemical').color),
  new EntityType('Phenomena', annotationTypesMap.get('phenomena').color),
  new EntityType('Phenotype', annotationTypesMap.get('phenotype').color),
  new EntityType('Pathway', annotationTypesMap.get('pathway').color),
  new EntityType('Entity', annotationTypesMap.get('entity').color),
  new EntityType('Compound', annotationTypesMap.get('compound').color),
  new EntityType('Food', annotationTypesMap.get('food').color),
  new EntityType('Anatomy', annotationTypesMap.get('anatomy').color),
  new EntityType('Lab Strain', annotationTypesMap.get('lab strain').color),
  new EntityType('Lab Sample', annotationTypesMap.get('lab sample').color),
  new EntityType('Image', annotationTypesMap.get('image').color),
];

export const ENTITY_TYPE_MAP = ENTITY_TYPES.reduce((map, item) => {
  map[item.id] = item;
  return map;
}, {});
