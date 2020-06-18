export interface PdfFiles {
  files: PdfFile[];
}

export interface PdfFile {
  // minimum field needed for the interface
  file_id: string;
  // optional
  filename?: string;
  creation_date?: string;
  description?: string;
  username?: string;
  annotations_date?: number;
  annotations_date_tooltip?: string;
}

export interface PdfFileUpload {
  file_id: string;
  filename: string;
  status: string;
}

export enum UploadType {
  Files = 'files',
  Url = 'url',
}

export interface UploadPayload {
  type: UploadType;
  filename: string;
  description?: string;
  // if type === Files
  files?: File[];
  // if type === Url
  url?: string;
}
