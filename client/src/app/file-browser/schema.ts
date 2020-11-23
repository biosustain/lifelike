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

interface FileContentValueRequest {
  contentValue: Blob;
}

/**
 * You can specify content one of three ways.
 */
export type FileContentSource = { contentHashId: string }
  | { contentUrl: string }
  | FileContentValueRequest;

export interface BulkFileUpdateRequest extends Partial<FileContentValueRequest> {
  filename?: string;
  parentHashId?: string;
  description?: string;
  uploadUrl?: string;
  public?: boolean;
}

// tslint:disable-next-line:no-empty-interface
export interface FileUpdateRequest extends BulkFileUpdateRequest {
}

// We need to require the filename and parentHashId fields
type RequiredFileCreateRequestFields = 'filename' | 'parentHashId';
type BaseFileCreateRequest = Required<Pick<BulkFileUpdateRequest, RequiredFileCreateRequestFields>>
  & Omit<FileUpdateRequest, RequiredFileCreateRequestFields>;

export type FileCreateRequest = BaseFileCreateRequest & Partial<FileContentSource> & {
  mimeType?: string;
};

export interface FileDataResponse {
  object: FilesystemObjectData;
}

export interface MultipleFileDataResponse {
  objects: { [hashId: string]: FilesystemObjectData };
}
