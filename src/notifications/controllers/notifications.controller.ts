import { Controller, Get, Logger, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Response } from 'express';
import { SSEService } from '../services/sse.service';

/**
 * Controller for notification endpoints (SSE).
 */
@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly sseService: SSEService) {}

  /**
   * Server-Sent Events endpoint for image processing status.
   */
  @Get('images/events/:id')
  @ApiExcludeEndpoint()
  imageEvents(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Res() response: Response): void {
    this.logger.log(`SSE client connected for image ${id}`);

    // Setup SSE headers
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');

    // Register client
    this.sseService.addClient(id, response);

    // Keep connection alive
    const keepAliveInterval = setInterval(() => {
      try {
        response.write(':keep-alive\n\n');
      } catch {
        clearInterval(keepAliveInterval);
      }
    }, 15000); // Send keep-alive every 15 seconds

    // Cleanup on disconnect
    response.on('close', () => {
      clearInterval(keepAliveInterval);
      this.logger.log(`SSE client disconnected for image ${id}`);
    });
  }
}
