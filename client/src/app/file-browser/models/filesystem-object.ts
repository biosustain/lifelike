import { Directory, Project } from '../services/project-space.service';
import { CollectionModal } from '../../shared/utils/collection-modal';
import { nullCoalesce, RecursivePartial } from '../../shared/utils/types';
import moment from 'moment';
import { DirectoryObject } from '../../interfaces/projects.interface';
import { PdfFile } from '../../interfaces/pdf-files.interface';
import { KnowledgeMap, UniversalGraph, UniversalGraphNode } from '../../drawing-tool/services/interfaces';
import { AppUser, User } from '../../interfaces';
import { ObjectCreateRequest, FilesystemObjectData, ProjectData } from '../schema';

export const DIRECTORY_MIMETYPE = 'vnd.lifelike.filesystem/directory';
export const MAP_MIMETYPE = 'vnd.lifelike.document/map';
export const ENRICHMENT_TABLE_MIMETYPE = 'vnd.lifelike.document/enrichment-table';
export const PDF_MIMETYPE = 'application/pdf';

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
    for (const key of ['hashId', 'name', 'description', 'creationDate', 'modifiedDate']) {
      if (data.hasOwnProperty(key)) {
        this[key] = data[key];
      }
    }
    if (data.hasOwnProperty('root')) {
      this.root = data.root != null ? new FilesystemObject().update(data.root) : null;
    }
    return this;
  }
}

export interface FilePrivileges {
  readable: boolean;
  writable: boolean;
  commentable: boolean;
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
  contentValue?: Blob;
  uploadUrl: string;
  annotationsDate: string;
  creationDate: string;
  modifiedDate: string;
  recyclingDate: string;
  project: ProjectImpl;
  parent: FilesystemObject;
  readonly children = new CollectionModal<FilesystemObject>([], {
    multipleSelection: true,
    sort: this.defaultSort,
  });
  privileges: FilePrivileges;
  recycled: boolean;
  effectivelyRecycled: boolean;

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
    return true;
  }

  get isAnnotatable() {
    return this.mimeType === 'application/pdf';
  }

  get isMovable() {
    return true;
  }

  get isCloneable() {
    return this.isFile;
  }

  get isDeletable() {
    return true;
  }

  get isDownloadable() {
    return this.isFile;
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

  get fontAwesomeIcon() {
    switch (this.mimeType) {
      case DIRECTORY_MIMETYPE:
        return 'fa fa-folder';
      case MAP_MIMETYPE:
        return 'fa fa-project-diagram';
      case ENRICHMENT_TABLE_MIMETYPE:
        return 'fa fa-table';
      case 'application/pdf':
        return 'fa fa-file';
      default:
        return 'fa fa-file';
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

  get downloadFilename(): string {
    if (this.mimeType === MAP_MIMETYPE) {
      return `${this.filename}.llmap.json`;
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

  getCommands(): any[] {
    switch (this.type) {
      case 'dir':
        // TODO: Convert to hash ID
        return ['/projects', this.project.projectName, 'folders', this.id];
      case 'file':
        if (this.name.slice(this.name.length - 11) === '.enrichment') {
          return ['/projects', this.project.projectName, 'enrichment-table', this.id];
        } else {
          return ['/projects', this.project.projectName, 'files', this.id];
        }
      case 'map':
        return ['/projects', this.project.projectName, 'maps', this.id, 'edit'];
      default:
        throw new Error(`unknown directory object type: ${this.type}`);
    }
  }

  addDataTransferData(dataTransfer: DataTransfer) {
    dataTransfer.setData('text/plain', this.name);
    dataTransfer.setData('application/lifelike-node', JSON.stringify({
      display_name: this.name,
      label: this.type === 'map' ? 'map' : 'link',
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
    } as Partial<UniversalGraphNode>));
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
      'annotationsDate', 'uploadUrl',
      'creationDate', 'modifiedDate', 'recyclingDate', 'privileges', 'recycled',
      'effectivelyRecycled']) {
      if (key in data) {
        this[key] = data[key];
      }
    }
    if ('project' in data) {
      this.project = data.project != null ? new ProjectImpl().update(data.project) : null;
    }
    if ('parent' in data) {
      this.parent = data.parent != null ? new FilesystemObject().update(data.parent) : null;
    }
    if ('children' in data) {
      if (data.children != null) {
        this.children.replace(data.children.map(
          itemData => {
            const child = new FilesystemObject().update(itemData);
            child.parent = this;
            child.project = this.project;
            return child;
          }));
      } else {
        this.children.replace([]);
      }
    }
    return this;
  }
}

export interface PathLocator {
  projectName?: string;
  directoryId?: string;
}
