import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EconomicCalendarSyncService } from './economic-calendar-sync.service';
import { NotificationService } from './notification.service';

@Injectable()
export class TelegramSchedulerService {
  private readonly logger = new Logger(TelegramSchedulerService.name);

  constructor(
    private readonly syncService: EconomicCalendarSyncService,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async runTick() {
    this.logger.debug('Scheduler tick started');
    await this.syncService.syncCurrentWeekIfNeeded();
    await this.notificationService.processDailyReports();
    await this.notificationService.processEventReminders();
  }
}
