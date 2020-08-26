import { Domain, EntityType } from '../interfaces';

export interface GraphSearchParameters {
  query: string;
  domains?: Domain[];
  entityTypes?: EntityType[];
  page: number;
  limit: number;
}
