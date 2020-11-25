import { ResultList } from '../interfaces/shared.interface';

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

interface ObjectContentValueRequest {
  contentValue: Blob;
}

/**
 * You can specify content one of three ways.
 */
export type ObjectContentSource = { contentHashId: string }
  | { contentUrl: string }
  | ObjectContentValueRequest;

export interface BulkObjectUpdateRequest extends Partial<ObjectContentValueRequest> {
  filename?: string;
  parentHashId?: string;
  description?: string;
  uploadUrl?: string;
  public?: boolean;
}

// tslint:disable-next-line:no-empty-interface
export interface ObjectUpdateRequest extends BulkObjectUpdateRequest {
}

// We need to require the filename and parentHashId fields
type RequiredObjectCreateRequestFields = 'filename' | 'parentHashId';
type BaseObjectCreateRequest = Required<Pick<BulkObjectUpdateRequest, RequiredObjectCreateRequestFields>>
  & Omit<ObjectUpdateRequest, RequiredObjectCreateRequestFields>;

export type ObjectCreateRequest = BaseObjectCreateRequest & Partial<ObjectContentSource> & {
  mimeType?: string;
};

export interface ObjectDataResponse {
  object: FilesystemObjectData;
}

export interface MultipleObjectDataResponse {
  objects: { [hashId: string]: FilesystemObjectData };
}

export interface ObjectBackupCreateRequest extends ObjectContentValueRequest {
  hashId: string;
}

export interface ObjectVersionData {
  hashId: string;
  message?: string;
  user: unknown;
  creationDate: string;
}

export interface ObjectVersionHistoryResponse extends ResultList<ObjectVersionData> {
  object: FilesystemObjectData;
}

export interface ObjectExportRequest {
  format: string;
}
