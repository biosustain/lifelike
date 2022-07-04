import { escapeRegExp } from 'lodash-es';

import { DirectoryObject } from 'app/interfaces/projects.interface';

import { FilesystemObject } from '../models/filesystem-object';

export function getObjectCommands(object: DirectoryObject) {
  switch (object.type) {
    case 'dir':
      // TODO: Convert to hash ID
      return ['/folders', object.id];
    case 'file':
      if (object.name.slice(object.name.length - 11) === '.enrichment') {
        return ['/files', object.id, 'enrichment-table'];
      } else {
        return ['/files', object.id];
      }
    case 'map':
      return ['/files', object.id, 'maps'];
    default:
      throw new Error(`unknown directory object type: ${object.type}`);
  }
}

export function getObjectMatchExistingTab(object: DirectoryObject) {
  switch (object.type) {
    case 'dir':
      // TODO: Convert to hash ID
      return `^/+folders/${escapeRegExp(object.id)}([?#].*)?`;
    case 'file':
      if (object.name.slice(object.name.length - 11) === '.enrichment') {
        return `^/+files/${escapeRegExp(object.id)}/enrichment-table([?#].*)?`;
      } else {
        return `^/+files/${escapeRegExp(object.id)}([?#].*)?`;
      }
    case 'map':
      return `^/+files/${escapeRegExp(object.id)}/maps/edit([?#].*)?`;
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
