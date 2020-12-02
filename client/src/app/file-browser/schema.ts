import { PaginatedRequestOptions, ResultList } from '../interfaces/shared.interface';
import { Annotation } from '../pdf-viewer/annotation-type';
import { AnnotationMethod } from '../interfaces/annotation';
import { OrganismAutocomplete } from '../interfaces';
import { FilePrivileges, ProjectPrivileges } from './models/filesystem-object';

export interface ProjectSearchRequest extends PaginatedRequestOptions {
  name: string;
}

export interface ProjectData {
  hashId: string;
  name: string;
  description: string;
  creationDate: string;
  modifiedDate: string;
  ***ARANGO_USERNAME***: FilesystemObjectData;
  privileges: ProjectPrivileges;
}

export interface ProjectDataResponse {
  project: ProjectData;
}

export interface ProjectCreateRequest {
  name: string;
  description: string;
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
  privileges: FilePrivileges;
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

export type ObjectSearchRequest = ({
  type: 'public';
  mimeTypes: string[];
} & PaginatedRequestOptions) | {
  type: 'linked';
  linkedHashId: string;
  mimeTypes: ['vnd.***ARANGO_DB_NAME***.document/map'];
};

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
  missing: string[];
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

export interface ObjectAnnotationsDataResponse {
  annotations: Annotation[];
}

export interface AnnotationGenerationRequest {
  organism?: OrganismAutocomplete;
  annotationMethod?: AnnotationMethod;
}

export interface AnnotationGenerationResultData {
  attempted: boolean;
  success: boolean;
}

export interface MultipleAnnotationGenerationResponse {
  results: { [hashId: string]: AnnotationGenerationResultData };
  missing: string[];
}
