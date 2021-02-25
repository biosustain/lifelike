import { FilePrivileges } from './models/privileges';

export const FILESYSTEM_OBJECT_TRANSFER_TYPE = 'vnd.lifelike.transfer/filesystem-object';

export class FilesystemObjectTransferData {
  hashId: string;
  privileges: FilePrivileges;
}
