/**
 * Represents the stages of an upload.
 */
export enum UploadStatus {
  /**
   * Ready to accept a new file upload. No upload in progress.
   */
  Ready = 'ready',
  /**
   * The upload has been submitted but no progress events have been emitted.
   */
  Starting = 'starting',
  /**
   * Data is being transferred to the server.
   */
  Uploading = 'uploading',
  /**
   * Data transferred has completed and now we await a response from the server.
   */
  Processing = 'processing',
}


/**
 * Holds the progress of an upload.
 */
export class UploadProgress {
  constructor(
    public status: UploadStatus,
    public progress: number,
    public name: string = '',
  ) {
  }
}
