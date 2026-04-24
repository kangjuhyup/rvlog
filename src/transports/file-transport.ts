import {
  appendFile,
  mkdir,
  rename,
  rm,
  stat,
} from 'node:fs/promises';
import type { LogRecord, LogTransport } from '../log/logger';
import { parseRecordDate, resolveRotatedFilePath } from './file-transport.utils';

export interface LogRotateOptions {
  type: 'size' | 'daily' | 'hourly';
  maxSizeBytes?: number;
  maxFiles?: number;
  datePattern?: string;
}

export interface LogFileOptions {
  enabled?: boolean;
  dirPath?: string;
  fileName?: string;
  rotate?: LogRotateOptions;
}

export class FileTransport implements LogTransport {
  constructor(private readonly options: LogFileOptions) {}

  async write(record: LogRecord, formatted: string): Promise<void> {
    const dirPath = this.options.dirPath ?? 'logs';
    const targetPath = this.resolveFilePath(record);
    await mkdir(dirPath, { recursive: true });

    if (this.options.rotate?.type === 'size') {
      await this.rotateBySize(targetPath, `${formatted}\n`);
    }

    await appendFile(targetPath, `${formatted}\n`, 'utf8');
  }

  resolveFilePath(record: LogRecord): string {
    const dirPath = this.options.dirPath ?? 'logs';
    const fileName = this.options.fileName ?? 'app.log';
    const rotateType = this.options.rotate?.type;

    return resolveRotatedFilePath(record, dirPath, fileName, rotateType);
  }

  private async rotateBySize(filePath: string, nextContent: string): Promise<void> {
    const rotateOptions = this.options.rotate;

    if (!rotateOptions?.maxSizeBytes) {
      return;
    }

    let currentSize = 0;

    try {
      const fileStat = await stat(filePath);
      currentSize = fileStat.size;
    } catch {
      currentSize = 0;
    }

    const nextSize = Buffer.byteLength(nextContent, 'utf8');

    if (currentSize + nextSize <= rotateOptions.maxSizeBytes) {
      return;
    }

    const maxFiles = rotateOptions.maxFiles ?? 5;

    for (let index = maxFiles - 1; index >= 1; index -= 1) {
      const current = `${filePath}.${index}`;
      const next = `${filePath}.${index + 1}`;

      if (index === maxFiles - 1) {
        await rm(next, { force: true }).catch(() => {});
      }

      await rename(current, next).catch(() => {});
    }

    await rename(filePath, `${filePath}.1`).catch(() => {});
  }
}
