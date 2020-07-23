import { Directory, Map } from '../file-browser/services/project-space.service';
import { File } from '../file-browser/components/file-browser.component';

export interface DirectoryContent {
  dir: Directory;
  path: Directory[];
  objects: DirectoryObject[];
}

export interface DirectoryObject {
  creator?: {
    id: number,
    name: string;
  };
  type: 'dir' | 'file' | 'map';
  name: string;
  data: Directory | Map | File;
}
