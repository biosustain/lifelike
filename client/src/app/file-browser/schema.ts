import { FilesystemObject } from './models/filesystem-object';

export interface ProjectData {
  hashId: string;
  name: string;
  description: string;
  creationDate: string;
  modifiedDate: string;
  root: FilesystemObjectData;
}

export interface FilesystemObjectData {
  hashId: string;
  filename: string;
  user: unknown;
  description: string;
  mimeType: string;
  doi: string;
  public: boolean;
  annotationsDate: string;
  creationDate: string;
  modifiedDate: string;
  recyclingDate: string;
  parent: FilesystemObjectData;
  children: FilesystemObjectData[];
  project: ProjectData;
  privileges: unknown;
  recycled: boolean;
  effectivelyRecycled: boolean;
}

export interface MultipleFileDataResponse {
  objects: { [hashId: string]: FilesystemObjectData };
}

export interface BulkFileUpdateRequest {
  filename: string;
  parentHashId: string;
  description: string;
  uploadUrl: string;
  public: boolean;
  annotationMethod: string;
  organism: string;
  contentValue?: Blob;
}

// tslint:disable-next-line
export interface FileUpdateRequest extends BulkFileUpdateRequest {
}

export interface FileCreateRequest extends FileUpdateRequest {
  mimeType: string;
  contentHashId?: string;
  contentUrl?: string;
}

export interface FileDataResponse {
  object: FilesystemObjectData;
}
