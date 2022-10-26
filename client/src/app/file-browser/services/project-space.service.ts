// TODO: Remove this file after #unifiedfileschema

// TODO: Remove this after #unifiedfileschema
export interface Project {
  hashId: string;
  creationDate: string;
  description: string;
  id?: number;
  projectName: string;
  // Collection of user ids access to
  // the project
  users?: number[];
  // Root directory associated with proejct
  directory?: Directory;
}

// TODO: Remove this after #unifiedfileschema
export interface Directory {
  id: any;
  name?: string;
  type?: string;
  routeLink?: string;
  dirPath?: {
    dir: string[];
    id: number[];
  };
}
