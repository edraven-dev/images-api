/**
 * Event emitted when image processing has failed.
 */
export class ImageProcessingFailedEvent {
  static readonly eventName = 'image.processing-failed';

  constructor(
    /**
     * Image unique identifier
     */
    readonly imageId: string,

    /**
     * Error message describing the failure
     */
    readonly message: string,
  ) {}
}
