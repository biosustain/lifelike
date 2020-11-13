import { FilesystemObject } from './models/filesystem-object';

export interface ProjectData {
  hashId: string;
  name: string;
  description: string;
  creationDate: string;
  modifiedDate: string;
  ***ARANGO_USERNAME***: FilesystemObjectData;
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
}

export interface FileUpdateRequest extends BulkFileUpdateRequest {
  contentValue?: Blob;
}

export interface FileCreateRequest extends FileUpdateRequest {
  mimeType: string;
  contentHashId?: string;
  contentUrl?: string;
}

export interface FileDataResponse {
  object: FilesystemObjectData;
}
