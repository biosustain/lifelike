import { Directory, Project } from '../services/project-space.service';
import { CollectionModel } from '../../shared/utils/collection-model';
import { nullCoalesce, RecursivePartial } from '../../shared/utils/types';
import moment from 'moment';
import { DirectoryObject } from '../../interfaces/projects.interface';
import { PdfFile } from '../../interfaces/pdf-files.interface';
import {
  KnowledgeMap, Source,
  UniversalEntityData,
  UniversalGraph,
  UniversalGraphNode,
} from '../../drawing-tool/services/interfaces';
import { AppUser, OrganismAutocomplete, User } from '../../interfaces';
import { AnnotationConfigs, FilesystemObjectData, ProjectData } from '../schema';
import { FILESYSTEM_OBJECT_TRANSFER_TYPE, FilesystemObjectTransferData } from '../data';
import { createObjectDragImage, createProjectDragImage } from '../utils/drag';
import { FilePrivileges, ProjectPrivileges } from './privileges';

// These are legacy mime type definitions that have to exist in this file until
// all the file type-specific query methods on FilesystemObject are moved to ObjectTypeProviders
const DIRECTORY_MIMETYPE = 'vnd.lifelike.filesystem/directory';
const MAP_MIMETYPE = 'vnd.lifelike.document/map';
const ENRICHMENT_TABLE_MIMETYPE = 'vnd.lifelike.document/enrichment-table';
const PDF_MIMETYPE = 'application/pdf';

// TODO: Rename this class after #unifiedfileschema
export class ProjectImpl implements Project {
  /**
   * Legacy ID field that needs to go away.
   */
  id?: number;
  hashId: string;
  name: string;
  description: string;
  creationDate: string;
  modifiedDate: string;
  root?: FilesystemObject;
  privileges: ProjectPrivileges;

  get projectName() {
    return this.name;
  }

  get directory(): Directory {
    return this.root ? this.root.directory : null;
  }

  update(data: RecursivePartial<ProjectData>): ProjectImpl {
    if (data == null) {
      return this;
    }
    for (const key of ['hashId', 'name', 'description', 'creationDate', 'modifiedDate',
      'privileges']) {
      if (data.hasOwnProperty(key)) {
        this[key] = data[key];
      }
    }
    if (data.hasOwnProperty('root')) {
      this.root = data.root != null ? new FilesystemObject().update(data.root) : null;
    }
    return this;
  }

  getCommands(): any[] {
    return ['/projects', this.name];
  }

  getURL(): string {
    return this.getCommands().map(item => {
      return encodeURIComponent(item.replace(/^\//, ''));
    }).join('/');
  }

  get colorHue(): number {
    let hash = 3242;
    for (let i = 0; i < this.hashId.length; i++) {
      // tslint:disable-next-line:no-bitwise
      hash = ((hash << 3) + hash) + this.hashId.codePointAt(i);
    }
    return hash % 100 / 100;
  }

  addDataTransferData(dataTransfer: DataTransfer) {
    createProjectDragImage(this).addDataTransferData(dataTransfer);

    const node: Partial<Omit<UniversalGraphNode, 'data'>> & { data: Partial<UniversalEntityData> } = {
      display_name: this.name,
      label: 'link',
      sub_labels: [],
      data: {
        references: [{
          type: 'PROJECT_OBJECT',
          id: this.id + '',
        }],
        sources: [{
          domain: 'File Source',
          url: this.getCommands().join('/'),
        }],
      },
    };

    dataTransfer.effectAllowed = 'all';
    dataTransfer.setData('text/plain', this.name);
    dataTransfer.setData('application/lifelike-node', JSON.stringify(node));
  }
}

/**
 * This object represents both directories and every type of file in Lifelike. Due
 * to a lot of legacy code, we implement several legacy interfaces to reduce the
 * amount of code for the refactor.
 */
export class FilesystemObject implements DirectoryObject, Directory, PdfFile, KnowledgeMap {
  hashId: string;
  filename: string;
  user: AppUser;
  description: string;
  mimeType: string;
  doi: string;
  public: boolean;
  uploadUrl: string;
  annotationsDate: string;
  creationDate: string;
  modifiedDate: string;
  recyclingDate: string;
  project: ProjectImpl;
  parent: FilesystemObject;
  readonly children = new CollectionModel<FilesystemObject>([], {
    multipleSelection: true,
    sort: this.defaultSort,
  });
  privileges: FilePrivileges;
  fallbackOrganism?: OrganismAutocomplete;
  recycled: boolean;
  effectivelyRecycled: boolean;
  annotationConfigs: AnnotationConfigs;

  highlight?: string[];
  highlightAnnotated?: boolean[];
  // tslint:disable-next-line:variable-name
  annotations_date_tooltip?: string;
  annotationsTooltipContent: string;

  get isDirectory() {
    return this.mimeType === DIRECTORY_MIMETYPE;
  }

  get isFile() {
    return !this.isDirectory;
  }

  get isOpenable() {
    // TODO: Move this method to ObjectTypeProvider
    return true;
  }

  get isEditable() {
    // TODO: Move this method to ObjectTypeProvider
    return !(this.isDirectory && !this.parent);
  }

  get isAnnotatable() {
    // TODO: Move this method to ObjectTypeProvider
    return this.mimeType === 'application/pdf' || this.mimeType === 'vnd.lifelike.document/enrichment-table';
  }

  get promptOrganism() {
    return this.mimeType !== ENRICHMENT_TABLE_MIMETYPE;
  }

  get isMovable() {
    // TODO: Move this method to ObjectTypeProvider
    return !(this.isDirectory && !this.parent);
  }

  get isCloneable() {
    // TODO: Move this method to ObjectTypeProvider
    return this.isFile;
  }

  get isDeletable() {
    // TODO: Move this method to ObjectTypeProvider
    return true;
  }

  get isVersioned() {
    // TODO: Move this method to ObjectTypeProvider
    return this.mimeType === MAP_MIMETYPE;
  }

  get isNavigable() {
    // TODO: Move this method to ObjectTypeProvider
    return this.isDirectory || this.mimeType === PDF_MIMETYPE || this.mimeType === MAP_MIMETYPE;
  }

  get hasWordCloud() {
    // TODO: Move this method to ObjectTypeProvider
    return this.isDirectory || this.mimeType === PDF_MIMETYPE || this.mimeType === ENRICHMENT_TABLE_MIMETYPE;
  }

  /**
   * @deprecated
   */
  get locator(): PathLocator {
    if (this.type === 'dir') {
      return {
        projectName: this.project.name,
        directoryId: this.hashId,
      };
    } else if (this.parent != null) {
      return this.parent.locator;
    } else {
      throw new Error('no locator available');
    }
  }

  /**
   * @deprecated
   */
  get directory(): Directory {
    // noinspection JSDeprecatedSymbols
    if (this.type === 'dir') {
      return this;
    } else {
      throw new Error('no directory available');
    }
  }

  /**
   * @deprecated
   */
  get file_id(): string {
    return this.hashId;
  }

  /**
   * @deprecated
   */
  get directoryParentId(): string {
    if (this.parent != null) {
      return this.parent.hashId;
    } else {
      return null;
    }
  }

  get mimeTypeLabel() {
    // TODO: Move this method to ObjectTypeProvider
    switch (this.mimeType) {
      case DIRECTORY_MIMETYPE:
        return 'Folder';
      case MAP_MIMETYPE:
        return 'Map';
      case ENRICHMENT_TABLE_MIMETYPE:
        return 'Enrichment Table';
      case 'application/pdf':
        return 'Document';
      default:
        return 'File';
    }
  }

  get fontAwesomeIcon() {
    // TODO: Move this method to ObjectTypeProvider
    switch (this.mimeType) {
      case DIRECTORY_MIMETYPE:
        return 'fa fa-folder';
      case MAP_MIMETYPE:
        return 'fa fa-project-diagram';
      case ENRICHMENT_TABLE_MIMETYPE:
        return 'fa fa-table';
      case 'application/pdf':
        return 'fa fa-file-pdf';
      default:
        return 'fa fa-file';
    }
  }

  get fontAwesomeIconCode() {
    // TODO: Move this method to ObjectTypeProvider
    switch (this.mimeType) {
      case DIRECTORY_MIMETYPE:
        return '\uf07b';
      case MAP_MIMETYPE:
        return '\uf542';
      case ENRICHMENT_TABLE_MIMETYPE:
        return '\uf0ce';
      case 'application/pdf':
        return '\uf1c1';
      default:
        return '\uf15b';
    }
  }

  get mapNodeLabel() {
    switch (this.mimeType) {
      case MAP_MIMETYPE:
        return 'map';
      default:
        return 'link';
    }
  }

  /**
   * @deprecated
   */
  get projectsId(): string {
    return this.project != null ? this.project.hashId : null;
  }

  /**
   * @deprecated
   */
  get type(): 'dir' | 'file' | 'map' {
    switch (this.mimeType) {
      case DIRECTORY_MIMETYPE:
        return 'dir';
      case MAP_MIMETYPE:
        return 'map';
      default:
        return 'file';
    }
  }

  /**
   * @deprecated
   */
  get name(): string {
    return this.filename;
  }

  get effectiveName(): string {
    if (this.isDirectory && this.parent == null && this.project != null) {
      return this.project.name;
    } else {
      return this.filename;
    }
  }

  /**
   * @deprecated
   */
  get label(): string {
    return this.filename;
  }

  /**
   * @deprecated
   */
  get graph(): UniversalGraph {
    return null;
  }

  /**
   * @deprecated
   */
  get upload_url(): string {
    return this.uploadUrl;
  }

  /**
   * @deprecated
   */
  get annotations_date(): string {
    return this.annotationsDate;
  }

  /**
   * @deprecated
   */
  get annotationDate(): string {
    return this.annotationsDate;
  }

  /**
   * @deprecated
   */
  get creation_date(): string {
    return this.creationDate;
  }

  /**
   * @deprecated
   */
  get modified_date(): string {
    return this.modifiedDate;
  }

  /**
   * @deprecated
   */
  get modificationDate(): string {
    return this.modifiedDate;
  }

  /**
   * @deprecated
   */
  get creator(): User {
    return this.user;
  }

  /**
   * @deprecated
   */
  get id(): string {
    return this.hashId;
  }

  /**
   * @deprecated
   */
  get data(): Directory | KnowledgeMap | PdfFile {
    return this;
  }

  filterChildren(filter: string) {
    const normalizedFilter = this.normalizeFilter(filter);
    this.children.filter = normalizedFilter.length ? (item: FilesystemObject) => {
      return this.normalizeFilter(item.name).includes(normalizedFilter);
    } : null;
  }

  getCommands(forEditing = true): any[] {
    // TODO: Move this method to ObjectTypeProvider
    const projectName = this.project ? this.project.name : 'default';
    switch (this.mimeType) {
      case DIRECTORY_MIMETYPE:
        // TODO: Convert to hash ID
        return ['/projects', projectName, 'folders', this.hashId];
      case ENRICHMENT_TABLE_MIMETYPE:
        return ['/projects', projectName, 'enrichment-table', this.hashId];
      case PDF_MIMETYPE:
        return ['/projects', projectName, 'files', this.hashId];
      case MAP_MIMETYPE:
        return ['/projects', projectName, 'maps', this.hashId];
      default:
        throw new Error(`unknown directory object type: ${this.mimeType}`);
    }
  }

  getURL(forEditing = true): string {
    // TODO: Move this method to ObjectTypeProvider
    return this.getCommands(forEditing).map(item => {
      return encodeURIComponent(item.replace(/^\//, ''));
    }).join('/');
  }

  addDataTransferData(dataTransfer: DataTransfer) {
    createObjectDragImage(this).addDataTransferData(dataTransfer);

    const filesystemObjectTransfer: FilesystemObjectTransferData = {
      hashId: this.hashId,
      privileges: this.privileges,
    };

    const sources: Source[] = [{
      domain: 'File Source',
      url: this.getCommands().join('/'),
    }];

    if (this.doi) {
      sources.push({
        domain: 'DOI',
        url: this.doi,
      });
    }

    if (this.uploadUrl) {
      sources.push({
        domain: 'Upload URL',
        url: this.uploadUrl,
      });
    }

    const node: Partial<Omit<UniversalGraphNode, 'data'>> & { data: Partial<UniversalEntityData> } = {
      display_name: this.name,
      label: this.type === 'map' ? 'map' : 'link',
      sub_labels: [],
      data: {
        references: [{
          type: 'PROJECT_OBJECT',
          id: this.id + '',
        }],
        sources,
      },
    };

    dataTransfer.effectAllowed = 'all';
    dataTransfer.setData('text/plain', this.name);
    dataTransfer.setData(FILESYSTEM_OBJECT_TRANSFER_TYPE, JSON.stringify(filesystemObjectTransfer));
    dataTransfer.setData('application/lifelike-node', JSON.stringify(node));
  }

  private getId(): any {
    switch (this.type) {
      case 'dir':
        const directory = this.data as Directory;
        return directory.id;
      case 'file':
        const file = this.data as PdfFile;
        return file.file_id;
      case 'map':
        const _map = this.data as KnowledgeMap;
        return _map.hash_id;
      default:
        throw new Error(`unknown directory object type: ${this.type}`);
    }
  }

  private normalizeFilter(filter: string): string {
    return filter.trim().toLowerCase().replace(/[ _]+/g, ' ');
  }

  private defaultSort(a: FilesystemObject, b: FilesystemObject) {
    if (a.type === 'dir' && b.type !== 'dir') {
      return -1;
    } else if (a.type !== 'dir' && b.type === 'dir') {
      return 1;
    } else {
      const aDate = nullCoalesce(a.modificationDate, a.creationDate);
      const bDate = nullCoalesce(b.modificationDate, b.creationDate);

      if (aDate != null && bDate != null) {
        const aMoment = moment(aDate);
        const bMoment = moment(bDate);
        if (aMoment.isAfter(bMoment)) {
          return -1;
        } else if (aMoment.isBefore(bMoment)) {
          return 1;
        } else {
          return a.name.localeCompare(b.name);
        }
      } else if (aDate != null) {
        return -1;
      } else if (bDate != null) {
        return 1;
      } else {
        return a.name.localeCompare(b.name);
      }
    }
  }

  update(data: RecursivePartial<FilesystemObjectData>): FilesystemObject {
    if (data == null) {
      return this;
    }
    for (const key of [
      'hashId', 'filename', 'user', 'description', 'mimeType', 'doi', 'public',
      'annotationsDate', 'uploadUrl', 'highlight', 'fallbackOrganism',
      'creationDate', 'modifiedDate', 'recyclingDate', 'privileges', 'recycled',
      'effectivelyRecycled', 'fallbackOrganism', 'annotationConfigs']) {
      if (key in data) {
        this[key] = data[key];
      }
    }
    if ('project' in data) {
      this.project = data.project != null ? new ProjectImpl().update(data.project) : null;
    }
    if ('parent' in data) {
      if (data.parent != null) {
        const parent = new FilesystemObject();
        if (this.project != null) {
          parent.project = this.project;
        }
        this.parent = parent.update(data.parent);
      } else {
        this.parent = null;
      }
    }
    if ('children' in data) {
      if (data.children != null) {
        this.children.replace(data.children.map(
          itemData => {
            const child = new FilesystemObject();
            child.parent = this;
            if (this.project != null) {
              child.project = this.project;
            }
            return child.update(itemData);
          }));
      } else {
        this.children.replace([]);
      }
    }
    return this;
  }

  get root(): FilesystemObject {
    let root: FilesystemObject = this;
    while (root.parent != null) {
      root = root.parent;
    }
    return root;
  }
}

export interface PathLocator {
  projectName?: string;
  directoryId?: string;
}
