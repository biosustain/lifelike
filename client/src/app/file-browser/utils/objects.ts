import { escapeRegExp } from "lodash-es";

import { DirectoryObject } from "app/interfaces/projects.interface";

import { FilesystemObject } from "../models/filesystem-object";

export function getObjectCommands(object: DirectoryObject) {
  switch (object.type) {
    case "dir":
      // TODO: Convert to hash ID
      return [
        "/projects",
        object.project.projectName,
        "folders",
        object.hashId,
      ];
    case "file":
      if (
        object.filename.slice(object.filename.length - 11) === ".enrichment"
      ) {
        return [
          "/projects",
          object.project.projectName,
          "enrichment-table",
          object.hashId,
        ];
      } else {
        return [
          "/projects",
          object.project.projectName,
          "files",
          object.hashId,
        ];
      }
    case "map":
      return ["/projects", object.project.projectName, "maps", object.hashId];
    default:
      throw new Error(`unknown directory object type: ${object.type}`);
  }
}

export function getObjectMatchExistingTab(object: DirectoryObject) {
  switch (object.type) {
    case "dir":
      // TODO: Convert to hash ID
      return `^/+projects/[^/]+/folders/${escapeRegExp(
        object.hashId
      )}([?#].*)?`;
    case "file":
      if (
        object.filename.slice(object.filename.length - 11) === ".enrichment"
      ) {
        return `^/+projects/[^/]+/enrichment-table/${escapeRegExp(
          object.hashId
        )}([?#].*)?`;
      } else {
        return `^/+projects/[^/]+/files/${escapeRegExp(
          object.hashId
        )}([?#].*)?`;
      }
    case "map":
      return `^/+projects/[^/]+/maps/${escapeRegExp(
        object.hashId
      )}/edit([?#].*)?`;
    default:
      throw new Error(`unknown directory object type: ${object.type}`);
  }
}

export function getObjectLabel(
  objects: FilesystemObject[] | FilesystemObject,
  titleCase = false
) {
  const targets = Array.isArray(objects) ? objects : [objects];
  if (targets.length === 0) {
    return "Nothing";
  } else if (targets.length === 1) {
    return `'${targets[0].effectiveName}'`;
  } else {
    return `${targets.length} ${titleCase ? "I" : "i"}tems`;
  }
}
