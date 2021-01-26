import {
  AddedAnnotationExclusion,
  Annotation,
  AnnotationChangeExclusionMeta,
  Meta,
} from '../pdf-viewer/annotation-type';
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
  ***ARANGO_USERNAME***: FilesystemObjectData;
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
// Collaborators
// ========================================

export interface CollaboratorData {
  user: AppUser;
  roleName: string;
}

// Requests
// ----------------------------------------

export interface CollaboratorUpdateData {
  userHashId: string;
  roleName: string;
}

export interface MultiCollaboratorUpdateRequest {
  updateOrCreate?: CollaboratorUpdateData[];
  removeUserHashIds?: string[];
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
  highlight?: string[];
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
  mimeTypes: ['vnd.***ARANGO_DB_NAME***.document/map'];
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

export interface TextAnnotationGenerationRequest {
  organism?: OrganismAutocomplete;
  annotationMethod?: AnnotationMethod;
  texts: string[];
}

// ========================================
// Custom Annotations
// ========================================

// Requests
// ----------------------------------------

export interface CustomAnnotationCreateRequest {
  annotation: Annotation;
  annotateAll: boolean;
}

export interface CustomAnnotationDeleteRequest {
  removeAll: boolean;
}

// ========================================
// Annotation Exclusions
// ========================================

// Requests
// ----------------------------------------

export interface AnnotationExclusionCreateRequest {
  exclusion: AddedAnnotationExclusion;
}

export interface AnnotationExclusionDeleteRequest {
  type: string;
  text: string;
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
