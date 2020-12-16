import { DirectoryObject } from '../../interfaces/projects.interface';
import { escapeRegExp } from 'lodash';
import { PdfFile } from '../../interfaces/pdf-files.interface';
import { FilesystemObject } from '../models/filesystem-object';

export function getObjectCommands(object: DirectoryObject) {
  switch (object.type) {
    case 'dir':
      // TODO: Convert to hash ID
      return ['/projects', object.project.projectName, 'folders', object.id];
    case 'file':
      if (object.name.slice(object.name.length - 11) === '.enrichment') {
        return ['/projects', object.project.projectName, 'enrichment-table', object.id];
      } else {
        return ['/projects', object.project.projectName, 'files', object.id];
      }
    case 'map':
      return ['/projects', object.project.projectName, 'maps', object.id, 'edit'];
    default:
      throw new Error(`unknown directory object type: ${object.type}`);
  }
}

export function getObjectMatchExistingTab(object: DirectoryObject) {
  switch (object.type) {
    case 'dir':
      // TODO: Convert to hash ID
      return `^/+projects/[^/]+/folders/${escapeRegExp(object.id)}([?#].*)?`;
    case 'file':
      if (object.name.slice(object.name.length - 11) === '.enrichment') {
        return `^/+projects/[^/]+/enrichment-table/${escapeRegExp(object.id)}([?#].*)?`;
      } else {
        return `^/+projects/[^/]+/files/${escapeRegExp(object.id)}([?#].*)?`;
      }
    case 'map':
      return `^/+projects/[^/]+/maps/${escapeRegExp(object.id)}/edit([?#].*)?`;
    default:
      throw new Error(`unknown directory object type: ${object.type}`);
  }
}

export function pdfFileToFilesystemObject(file: PdfFile): FilesystemObject {
  if (file.project_name == null) {
    throw new Error('missing project_name on file');
  }
  if (file.dir_id == null) {
    throw new Error('missing dir_id on file');
  }
  const object = new FilesystemObject();
  object.type = 'file';
  object.locator = {
    projectName: file.project_name,
    directoryId: file.dir_id,
  };
  object.directory = {
    id: file.dir_id,
    projectsId: null,
    directoryParentId: null,
  };
  object.id = file.file_id;
  object.doi = file.doi;
  object.name = file.filename;
  object.description = file.description;
  object.annotationDate = file.annotations_date;
  object.creationDate = file.creation_date;
  object.modificationDate = file.modified_date;
  object.doi = file.doi;
  object.project = {
    projectName: file.project_name,
  };
  object.data = file;
  return object;
}
