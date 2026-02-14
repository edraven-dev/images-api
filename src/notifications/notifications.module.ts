import { Module } from '@nestjs/common';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationService } from './services/notification.service';
import { SSEService } from './services/sse.service';

/**
 * Module for handling notifications.
 * Listens to image processing events and sends SSE notifications to clients.
 */
@Module({
  controllers: [NotificationsController],
  providers: [NotificationService, SSEService],
})
export class NotificationsModule {}
