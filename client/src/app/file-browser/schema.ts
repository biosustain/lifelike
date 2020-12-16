import { Annotation, AnnotationChangeExclusionMeta, Meta } from '../pdf-viewer/annotation-type';
import { AnnotationMethod } from '../interfaces/annotation';
import { AppUser, OrganismAutocomplete } from '../interfaces';
import { FilePrivileges, ProjectPrivileges } from './models/filesystem-object';
import { PaginatedRequestOptions, ResultList } from '../shared/schemas/common';

// ========================================
// Projects
// ========================================

export interface ProjectData {
  hashId: string;
  name: string;
  description: string;
  creationDate: string;
  modifiedDate: string;
  root: FilesystemObjectData;
  privileges: ProjectPrivileges;
}

// Requests
// ----------------------------------------

/**
 * Search request.
 */
export interface ProjectSearchRequest extends PaginatedRequestOptions {
  name: string;
}

/**
 * Create request.
 */
export interface ProjectCreateRequest {
  name: string;
  description: string;
}

/**
 * Bulk update request.
 */
export interface BulkProjectUpdateRequest {
  name?: string;
  description?: string;
}

// ========================================
// Objects
// ========================================

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

// Requests
// ----------------------------------------

/**
 * Search request.
 */
export type ObjectSearchRequest = ({
  type: 'public';
  mimeTypes: string[];
} & PaginatedRequestOptions) | {
  type: 'linked';
  linkedHashId: string;
  mimeTypes: ['vnd.lifelike.document/map'];
};

/**
 * Bulk update request.
 */
export interface BulkObjectUpdateRequest extends Partial<ObjectContentValueRequest> {
  filename?: string;
  parentHashId?: string;
  description?: string;
  uploadUrl?: string;
  public?: boolean;
}

/**
 * Update request.
 */

// tslint:disable-next-line:no-empty-interface
export interface ObjectUpdateRequest extends BulkObjectUpdateRequest {
}

// We need to require the filename and parentHashId fields
type RequiredObjectCreateRequestFields = 'filename' | 'parentHashId';
type BaseObjectCreateRequest = Required<Pick<BulkObjectUpdateRequest, RequiredObjectCreateRequestFields>>
  & Omit<ObjectUpdateRequest, RequiredObjectCreateRequestFields>;

/**
 * Create request.
 */
export type ObjectCreateRequest = BaseObjectCreateRequest & Partial<ObjectContentSource> & {
  mimeType?: string;
};

/**
 * Export request.
 */
export interface ObjectExportRequest {
  format: string;
}

// ========================================
// Backups
// ========================================

// Requests
// ----------------------------------------

export interface ObjectBackupCreateRequest extends ObjectContentValueRequest {
  hashId: string;
}

// ========================================
// Versions
// ========================================

export interface ObjectVersionData {
  hashId: string;
  message?: string;
  user: unknown;
  creationDate: string;
}

// Responses
// ----------------------------------------

export interface ObjectVersionHistoryResponse extends ResultList<ObjectVersionData> {
  object: FilesystemObjectData;
}

// ========================================
// Locks
// ========================================

export interface ObjectLockData {
  user: AppUser;
  acquireDate: string;
}

// ========================================
// Annotations
// ========================================

export interface AnnotationGenerationResultData {
  attempted: boolean;
  success: boolean;
}

// Requests
// ----------------------------------------

export interface AnnotationGenerationRequest {
  organism?: OrganismAutocomplete;
  annotationMethod?: AnnotationMethod;
}

// ========================================
// Annotation history
// ========================================

export interface AnnotationChangeData {
  action: 'added' | 'removed';
}

export interface AnnotationInclusionChangeData extends AnnotationChangeData {
  meta: Meta;
}

export interface AnnotationExclusionChangeData extends AnnotationChangeData {
  meta: AnnotationChangeExclusionMeta;
}

export interface FileAnnotationChangeData {
  date: string;
  cause: 'user' | 'user_reannotation' | 'sys_reannotation';
  inclusionChanges: AnnotationInclusionChangeData[];
  exclusionChanges: AnnotationExclusionChangeData[];
}

export interface FileAnnotationHistoryResponse extends ResultList<FileAnnotationChangeData> {
}
