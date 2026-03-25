import { Injectable, Logger } from '@nestjs/common';
import { NotificationStatus, NotificationType, User } from '@prisma/client';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { PrismaService } from '../../prisma/prisma.service';
import { EventFilterService } from './event-filter.service';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly filterService: EventFilterService,
    @InjectBot() private readonly bot: Telegraf,
  ) {}

  async sendDailyReportNow(telegramId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { telegramId },
      include: { preferences: true },
    });

    if (!user?.preferences) {
      return 'Please run /start first so I can initialize your preferences.';
    }

    const events = await this.getTodayMatchingEvents(user.id);
    if (events.length === 0) {
      return 'No matching events for today.';
    }

    const lines = events.map((event) => {
      const localTime = dayjs(event.eventDateUtc)
        .tz(user.preferences!.timezone)
        .format('HH:mm');
      return `• ${localTime} | ${event.country} | ${event.impact.toUpperCase()} | ${event.title}`;
    });

    return [
      `Today's events (${user.preferences.timezone}):`,
      ...lines,
      '',
      `Reminder: ${user.preferences.reminderMinutesBefore} minutes before each event.`,
    ].join('\n');
  }

  async processDailyReports(): Promise<void> {
    const nowUtc = dayjs.utc();
    const users = await this.prisma.user.findMany({
      where: { isActive: true, preferences: { isNot: null } },
      include: { preferences: true },
    });

    for (const user of users) {
      if (!user.preferences) {
        continue;
      }

      const localNow = nowUtc.tz(user.preferences.timezone);
      if (localNow.format('HH:mm') !== user.preferences.dailyReportTime) {
        continue;
      }

      const localDayStart = localNow.startOf('day');
      const scheduledFor = localDayStart.utc().toDate();

      const alreadySent = await this.prisma.notificationLog.findFirst({
        where: {
          userId: user.id,
          type: NotificationType.DAILY_REPORT,
          scheduledFor,
          status: NotificationStatus.SENT,
        },
      });

      if (alreadySent) {
        continue;
      }

      const text = await this.buildDailyReportMessageForUser({
        id: user.id,
        preferences: user.preferences,
      });
      await this.sendAndLog(user, text, NotificationType.DAILY_REPORT, scheduledFor, null);
    }
  }

  async processEventReminders(): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { isActive: true, preferences: { isNot: null } },
      include: { preferences: true },
    });

    const now = dayjs.utc().second(0).millisecond(0);
    for (const user of users) {
      if (!user.preferences) {
        continue;
      }

      const reminderMinutes = user.preferences.reminderMinutesBefore;
      const dueStart = now.add(reminderMinutes, 'minute');
      const dueEnd = dueStart.add(1, 'minute');

      const events = await this.prisma.economicEvent.findMany({
        where: {
          eventDateUtc: {
            gte: dueStart.toDate(),
            lt: dueEnd.toDate(),
          },
        },
        orderBy: { eventDateUtc: 'asc' },
      });

      const matched = this.filterService.filterEvents(events, user.preferences);
      for (const event of matched) {
        const scheduledFor = dueStart.toDate();
        const alreadySent = await this.prisma.notificationLog.findFirst({
          where: {
            userId: user.id,
            eventId: event.id,
            type: NotificationType.EVENT_REMINDER,
            scheduledFor,
            status: NotificationStatus.SENT,
          },
        });

        if (alreadySent) {
          continue;
        }

        const eventTime = dayjs(event.eventDateUtc)
          .tz(user.preferences.timezone)
          .format('HH:mm');
        const text =
          `⏰ Reminder (${user.preferences.reminderMinutesBefore}m before)\n` +
          `${eventTime} | ${event.country} | ${event.impact.toUpperCase()}\n${event.title}`;

        await this.sendAndLog(
          user,
          text,
          NotificationType.EVENT_REMINDER,
          scheduledFor,
          event.id,
        );
      }
    }
  }

  async updatePreference(telegramId: string, data: Record<string, unknown>) {
    const user = await this.prisma.user.findUnique({
      where: { telegramId },
      include: { preferences: true },
    });

    if (!user?.preferences) {
      throw new Error('User preferences not found');
    }

    return this.prisma.userPreference.update({
      where: { userId: user.id },
      data,
    });
  }

  async getCurrentSettings(telegramId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { telegramId },
      include: { preferences: true },
    });

    if (!user?.preferences) {
      return 'Preferences are not initialized. Use /start.';
    }

    const p = user.preferences;
    return [
      'Current settings:',
      `• Timezone: ${p.timezone}`,
      `• Daily report time: ${p.dailyReportTime}`,
      `• Reminder: ${p.reminderMinutesBefore} minutes before`,
      `• Currencies: ${p.currencies.join(', ') || 'all'}`,
      `• Impacts: ${p.impacts.join(', ') || 'all'}`,
      `• Include keywords: ${p.includeKeywords.join(', ') || 'none'}`,
      `• Exclude keywords: ${p.excludeKeywords.join(', ') || 'none'}`,
    ].join('\n');
  }

  async validateAndNormalizeInput(
    type: 'report_time' | 'currencies' | 'impacts' | 'include_keywords' | 'exclude_keywords',
    text: string,
  ): Promise<{ field: string; value: string | string[]; successMessage: string }> {
    const normalized = text.trim();

    if (type === 'report_time') {
      if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(normalized)) {
        throw new Error('Invalid time format. Use HH:mm (e.g. 08:00).');
      }
      return {
        field: 'dailyReportTime',
        value: normalized,
        successMessage: `Daily report time updated to ${normalized}.`,
      };
    }

    const parts = normalized
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (type === 'currencies') {
      return {
        field: 'currencies',
        value: parts.map((item) => item.toUpperCase()),
        successMessage: 'Currencies updated.',
      };
    }

    if (type === 'impacts') {
      return {
        field: 'impacts',
        value: parts.map((item) => item.toLowerCase()),
        successMessage: 'Impact priorities updated.',
      };
    }

    if (type === 'include_keywords') {
      return {
        field: 'includeKeywords',
        value: parts.map((item) => item.toLowerCase()),
        successMessage: 'Include keywords updated.',
      };
    }

    return {
      field: 'excludeKeywords',
      value: parts.map((item) => item.toLowerCase()),
      successMessage: 'Exclude keywords updated.',
    };
  }

  private async getTodayMatchingEvents(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { preferences: true },
    });

    if (!user?.preferences) {
      return [];
    }

    const localNow = dayjs().tz(user.preferences.timezone);
    const start = localNow.startOf('day').utc().toDate();
    const end = localNow.endOf('day').utc().toDate();

    const events = await this.prisma.economicEvent.findMany({
      where: {
        eventDateUtc: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { eventDateUtc: 'asc' },
    });

    return this.filterService.filterEvents(events, user.preferences);
  }

  private async buildDailyReportMessageForUser(
    user: { id: string; preferences: { timezone: string; reminderMinutesBefore: number } },
  ): Promise<string> {
    const events = await this.getTodayMatchingEvents(user.id);
    if (events.length === 0) {
      return 'No matching events for today.';
    }

    const lines = events.map((event) => {
      const localTime = dayjs(event.eventDateUtc)
        .tz(user.preferences.timezone)
        .format('HH:mm');
      return `• ${localTime} | ${event.country} | ${event.impact.toUpperCase()} | ${event.title}`;
    });

    return [
      `📊 Daily report (${user.preferences.timezone})`,
      ...lines,
      '',
      `Reminder: ${user.preferences.reminderMinutesBefore} minutes before each event.`,
    ].join('\n');
  }

  private async sendAndLog(
    user: User,
    message: string,
    type: NotificationType,
    scheduledFor: Date,
    eventId: string | null,
  ) {
    const pendingLog = await this.prisma.notificationLog.create({
      data: {
        userId: user.id,
        eventId,
        type,
        scheduledFor,
        status: NotificationStatus.PENDING,
      },
    });

    try {
      await this.bot.telegram.sendMessage(Number(user.telegramId), message);
      await this.prisma.notificationLog.update({
        where: { id: pendingLog.id },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
        },
      });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Unknown telegram error';
      this.logger.error(`Failed to send notification to ${user.telegramId}: ${messageText}`);
      await this.prisma.notificationLog.update({
        where: { id: pendingLog.id },
        data: {
          status: NotificationStatus.FAILED,
          error: messageText,
        },
      });
    }
  }
}
