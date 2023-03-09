import { FilesystemObject, ProjectImpl } from "app/file-browser/models/filesystem-object";
import { User } from "./auth.interface";

export interface DirectoryContent {
  dir: FilesystemObject;
  path: FilesystemObject[];
  objects: DirectoryObject[];
}

export interface DirectoryObject {
  type: "dir" | "file" | "map";
  hashId?: any;
  filename: string;
  description?: string;
  annotationsDate?: string;
  creationDate?: string;
  modifiedDate?: string;
  doi?: string;
  highlight?: string[];
  highlightAnnotated?: boolean[];
  user?: User;
  project: Pick<ProjectImpl, "projectName">;
}
