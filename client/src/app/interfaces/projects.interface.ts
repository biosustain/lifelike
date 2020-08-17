import { Directory } from '../file-browser/services/project-space.service';
import { PdfFile } from './pdf-files.interface';
import { KnowledgeMap } from '../drawing-tool/services/interfaces';

export interface DirectoryContent {
  dir: Directory;
  path: Directory[];
  objects: DirectoryObject[];
}

export interface DirectoryObject {
  type: 'dir' | 'file' | 'map';
  name: string;
  description?: string;
  annotationDate?: string;
  creationDate?: string;
  modificationDate?: string;
  creator?: {
    id: number,
    name: string;
  };
  data: Directory | KnowledgeMap | PdfFile;
}
