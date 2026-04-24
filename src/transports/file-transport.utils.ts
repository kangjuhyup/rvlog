import { join, parse } from 'node:path';
import type { LogRecord } from '../log/logger';

export function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function buildDateToken(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseRecordDate(record: LogRecord): Date {
  const normalized = record.timestamp.replace(
    /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
    '$1-$2-$3T$4:$5:$6',
  );
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function resolveRotatedFilePath(
  record: LogRecord,
  dirPath: string,
  fileName: string,
  rotateType?: 'size' | 'daily' | 'hourly',
): string {
  if (rotateType === 'daily') {
    const parsed = parse(fileName);
    const dateToken = buildDateToken(parseRecordDate(record));
    const nextFileName = parsed.ext
      ? `${parsed.name}-${dateToken}${parsed.ext}`
      : `${parsed.name}-${dateToken}`;

    return join(dirPath, nextFileName);
  }

  if (rotateType === 'hourly') {
    const parsed = parse(fileName);
    const date = parseRecordDate(record);
    const hourlyToken = `${buildDateToken(date)}-${pad(date.getHours())}`;
    const nextFileName = parsed.ext
      ? `${parsed.name}-${hourlyToken}${parsed.ext}`
      : `${parsed.name}-${hourlyToken}`;

    return join(dirPath, nextFileName);
  }

  return join(dirPath, fileName);
}
