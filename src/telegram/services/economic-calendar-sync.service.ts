import { Injectable, Logger } from '@nestjs/common';
import { SyncStatus } from '@prisma/client';
import axios from 'axios';
import { createHash } from 'crypto';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { PrismaService } from '../../prisma/prisma.service';
import { TELEGRAM_SOURCES } from '../telegram.constants';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

type SourceEvent = Record<string, unknown>;

@Injectable()
export class EconomicCalendarSyncService {
  private readonly logger = new Logger(EconomicCalendarSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async syncCurrentWeekIfNeeded(): Promise<void> {
    const weekKey = this.getCurrentWeekKey();
    const source = TELEGRAM_SOURCES.FAIR_ECONOMY_WEEKLY;

    const existing = await this.prisma.syncState.findUnique({
      where: { source_weekKey: { source, weekKey } },
    });

    if (existing?.status === SyncStatus.SUCCESS) {
      this.logger.debug(`Skip sync for ${weekKey}: already successful`);
      return;
    }

    try {
      await this.fetchAndStoreWeek(source, weekKey);
      await this.prisma.syncState.upsert({
        where: { source_weekKey: { source, weekKey } },
        update: {
          fetchedAt: new Date(),
          status: SyncStatus.SUCCESS,
          details: { message: 'ok' },
        },
        create: {
          source,
          weekKey,
          fetchedAt: new Date(),
          status: SyncStatus.SUCCESS,
          details: { message: 'ok' },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sync error';
      this.logger.error(`Sync failed for ${weekKey}: ${message}`);
      await this.prisma.syncState.upsert({
        where: { source_weekKey: { source, weekKey } },
        update: {
          fetchedAt: new Date(),
          status: SyncStatus.FAILED,
          details: { error: message },
        },
        create: {
          source,
          weekKey,
          fetchedAt: new Date(),
          status: SyncStatus.FAILED,
          details: { error: message },
        },
      });
    }
  }

  private getCurrentWeekKey() {
    return `${dayjs().tz('Europe/Warsaw').isoWeekYear()}-W${String(dayjs().tz('Europe/Warsaw').isoWeek()).padStart(2, '0')}`;
  }

  private async fetchAndStoreWeek(source: string, weekKey: string) {
    const url =
      process.env.FAIR_ECONOMY_WEEKLY_JSON_URL ??
      'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
    const timeout = Number(process.env.FETCH_TIMEOUT_MS ?? 10000);

    const response = await axios.get<SourceEvent[]>(url, { timeout });
    const payload = response.data;

    if (!Array.isArray(payload)) {
      throw new Error('Weekly payload is not an array');
    }

    let upserted = 0;
    for (const item of payload) {
      const mapped = this.mapEvent(item, source, weekKey);
      if (!mapped) {
        continue;
      }

      await this.prisma.economicEvent.upsert({
        where: { externalId: mapped.externalId },
        update: mapped,
        create: mapped,
      });
      upserted += 1;
    }

    this.logger.log(`Weekly sync complete. Upserted events: ${upserted}`);
  }

  private mapEvent(raw: SourceEvent, source: string, weekKey: string) {
    const title = String(raw.title ?? raw.event ?? '').trim();
    const country = String(raw.country ?? raw.currency ?? '').trim().toUpperCase();
    const impact = String(raw.impact ?? '').trim().toLowerCase();
    const eventDateSource = String(
      raw.date ?? raw.dateUtc ?? raw.datetime ?? raw.time ?? '',
    ).trim();

    const eventDateUtc = this.resolveEventDate(raw);

    if (!title || !country || !impact || !eventDateUtc) {
      return null;
    }

    const externalId = createHash('sha256')
      .update(`${source}|${country}|${title}|${impact}|${eventDateUtc.toISOString()}`)
      .digest('hex');

    return {
      externalId,
      source,
      title,
      country,
      impact,
      eventDateUtc,
      eventDateSource,
      forecast: raw.forecast == null ? null : String(raw.forecast),
      previous: raw.previous == null ? null : String(raw.previous),
      weekKey,
      rawPayload: raw as any,
    };
  }

  private resolveEventDate(raw: SourceEvent): Date | null {
    const timestamp = raw.timestamp;
    if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
      return new Date(timestamp * 1000);
    }

    const dateTimeCandidate = raw.dateUtc ?? raw.datetime ?? raw.date;
    if (typeof dateTimeCandidate === 'string' && dateTimeCandidate.trim().length > 0) {
      const parsed = dayjs.utc(dateTimeCandidate);
      if (parsed.isValid()) {
        return parsed.toDate();
      }
    }

    return null;
  }
}
