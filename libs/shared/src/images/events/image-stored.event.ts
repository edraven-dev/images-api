/**
 * Event emitted when an image has been successfully stored.
 */
export class ImageStoredEvent {
  static readonly eventName = 'image.stored';

  constructor(
    /**
     * Image unique identifier
     */
    readonly imageId: string,

    /**
     * URL of the processed image
     */
    readonly url: string,
  ) {}
}
