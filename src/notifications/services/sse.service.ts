import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';

/**
 * SSE event data sent to clients
 */
export interface SSEEventData {
  type: 'completed' | 'failed';
  imageId: string;
  message?: string;
  url?: string;
}

/**
 * Service for managing Server-Sent Events (SSE) connections.
 * Allows notifying clients about image processing completion.
 */
@Injectable()
export class SSEService {
  private readonly logger = new Logger(SSEService.name);
  private readonly clients: Map<string, Set<Response>> = new Map();

  /**
   * Add a client connection for a specific image.
   */
  addClient(imageId: string, response: Response): void {
    if (!this.clients.has(imageId)) {
      this.clients.set(imageId, new Set());
    }

    this.clients.get(imageId)!.add(response);
    this.logger.log(`Client connected for image ${imageId}. Total clients: ${this.clients.get(imageId)!.size}`);

    // Setup cleanup on connection close
    response.on('close', () => {
      this.removeClient(imageId, response);
    });
  }

  /**
   * Remove a client connection.
   */
  removeClient(imageId: string, response: Response): void {
    const clients = this.clients.get(imageId);
    if (clients) {
      clients.delete(response);
      this.logger.log(`Client disconnected for image ${imageId}. Remaining clients: ${clients.size}`);

      if (clients.size === 0) {
        this.clients.delete(imageId);
        this.logger.log(`No more clients for image ${imageId}, cleaning up`);
      }
    }
  }

  /**
   * Send an event to all clients listening for a specific image.
   */
  async sendEvent(imageId: string, event: SSEEventData): Promise<void> {
    // Wait for clients to connect before sending event
    // it's for debug purposes only
    // on production event should be sent immediately
    await new Promise((resolve) => setTimeout(resolve, 30000));

    const clients = this.clients.get(imageId);

    if (!clients || clients.size === 0) {
      this.logger.log(`No clients listening for image ${imageId}, event not sent`);
      return;
    }

    this.logger.log(`Sending ${event.type} event to ${clients.size} client(s) for image ${imageId}`);

    const eventData = JSON.stringify(event);

    clients.forEach((response) => {
      try {
        response.write(`data: ${eventData}\n\n`);
      } catch (error) {
        const err = error as Error;
        this.logger.error(`Failed to send event to client: ${err.message}`);
        this.removeClient(imageId, response);
      }
    });

    // Clean up clients after sending terminal events (completed/failed)
    if (event.type === 'completed' || event.type === 'failed') {
      this.logger.log(`Terminal event sent for image ${imageId}, cleaning up clients`);
      clients.forEach((response) => {
        try {
          response.end();
        } catch {
          // Ignore errors when closing
        }
      });
      this.clients.delete(imageId);
    }
  }

  /**
   * Get the number of clients listening for a specific image.
   */
  getClientCount(imageId: string): number {
    return this.clients.get(imageId)?.size || 0;
  }

  /**
   * Get total number of active connections.
   */
  getTotalClientCount(): number {
    let total = 0;
    this.clients.forEach((clients) => {
      total += clients.size;
    });
    return total;
  }
}
