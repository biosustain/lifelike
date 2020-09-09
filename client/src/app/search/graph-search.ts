import { Domain, EntityType } from '../interfaces';

export interface GraphSearchParameters {
  query: string;
  domains?: Domain[];
  entityTypes?: EntityType[];
  organism?: string | null;
  page: number;
  limit: number;
}
