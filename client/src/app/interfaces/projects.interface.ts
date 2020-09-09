import { Directory, Project } from '../file-browser/services/project-space.service';
import { PdfFile } from './pdf-files.interface';
import { KnowledgeMap } from '../drawing-tool/services/interfaces';
import { User } from './auth.interface';

export interface DirectoryContent {
  dir: Directory;
  path: Directory[];
  objects: DirectoryObject[];
}

export interface DirectoryObject {
  type: 'dir' | 'file' | 'map';
  id?: any;
  name: string;
  description?: string;
  annotationDate?: string;
  creationDate?: string;
  modificationDate?: string;
  creator?: User;
  project: Pick<Project, 'projectName'>;
  data?: Directory | KnowledgeMap | PdfFile;
}
