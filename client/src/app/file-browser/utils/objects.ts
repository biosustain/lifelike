import { escapeRegExp } from 'lodash-es';

import { FilesystemObject } from '../models/filesystem-object';

export function getObjectCommands(object: FilesystemObject) {
  switch (object.type) {
    case 'dir':
      // TODO: Convert to hash ID
      return ['/projects', object.project.filename, 'folders', object.id];
    case 'file':
      if (object.name.slice(object.name.length - 11) === '.enrichment') {
        return ['/projects', object.project.filename, 'enrichment-table', object.id];
      } else {
        return ['/projects', object.project.filename, 'files', object.id];
      }
    case 'map':
      return ['/projects', object.project.filename, 'maps', object.id];
    default:
      throw new Error(`unknown directory object type: ${object.type}`);
  }
}

export function getObjectMatchExistingTab(object: FilesystemObject) {
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

export function getObjectLabel(objects: FilesystemObject[] | FilesystemObject,
                               titleCase = false) {
  const targets = Array.isArray(objects) ? objects : [objects];
  if (targets.length === 0) {
    return 'Nothing';
  } else if (targets.length === 1) {
    return `'${targets[0].effectiveName}'`;
  } else {
    return `${targets.length} ${titleCase ? 'I' : 'i'}tems`;
  }
}
