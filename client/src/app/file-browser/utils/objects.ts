import { DirectoryObject } from '../../interfaces/projects.interface';
import { Directory } from '../services/project-space.service';
import { PdfFile } from '../../interfaces/pdf-files.interface';
import { KnowledgeMap } from '../../drawing-tool/services/interfaces';

export function getObjectCommands(object: DirectoryObject) {
  switch (object.type) {
    case 'dir':
      // TODO: Convert to hash ID
      return ['/projects', object.project.projectName, 'folders', object.id];
    case 'file':
      return ['/projects', object.project.projectName, 'files', object.id];
    case 'map':
      return ['/projects', object.project.projectName, 'maps', object.id, 'edit'];
    default:
      throw new Error(`unknown directory object type: ${object.type}`);
  }
}
