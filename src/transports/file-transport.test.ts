import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LogRecord } from '../log/logger';

const {
  appendFileMock,
  mkdirMock,
  renameMock,
  rmMock,
  statMock,
} = vi.hoisted(() => ({
  appendFileMock: vi.fn(),
  mkdirMock: vi.fn(),
  renameMock: vi.fn(),
  rmMock: vi.fn(),
  statMock: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  appendFile: appendFileMock,
  mkdir: mkdirMock,
  rename: renameMock,
  rm: rmMock,
  stat: statMock,
}));

import { FileTransport } from './file-transport';

const baseRecord: LogRecord = {
  timestamp: '2026:04:10 12:34:56',
  level: 'INFO' as LogRecord['level'],
  context: 'UserService',
  message: 'findAll() called',
  args: [],
};

describe('FileTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appendFileMock.mockResolvedValue(undefined);
    mkdirMock.mockResolvedValue(undefined);
    renameMock.mockResolvedValue(undefined);
    rmMock.mockResolvedValue(undefined);
    statMock.mockRejectedValue(new Error('ENOENT'));
  });

  it('appends formatted logs into the target file - 포맷된 로그를 대상 파일에 append 한다', async () => {
    // Given: 기본 파일 저장 옵션을 가진 FileTransport가 있다.
    const transport = new FileTransport({
      enabled: true,
      dirPath: 'logs',
      fileName: 'app.log',
    });

    // When: 포맷된 로그 한 줄을 기록한다.
    await transport.write(baseRecord, 'formatted line');

    // Then: 디렉터리를 만들고 app.log에 줄바꿈과 함께 append 한다.
    expect(mkdirMock).toHaveBeenCalledWith('logs', { recursive: true });
    expect(appendFileMock).toHaveBeenCalledWith('logs\\app.log', 'formatted line\n', 'utf8');
  });

  it('rotates existing files before append when size limit is exceeded - 크기 제한을 넘기면 append 전에 rotate 한다', async () => {
    // Given: size rotate 설정과 기존 파일 크기가 임계치를 넘는 상황이 있다.
    statMock.mockResolvedValue({ size: 95 });

    const transport = new FileTransport({
      enabled: true,
      dirPath: 'logs',
      fileName: 'app.log',
      rotate: {
        type: 'size',
        maxSizeBytes: 100,
        maxFiles: 3,
      },
    });

    // When: 새 로그를 기록한다.
    await transport.write(baseRecord, '1234567890');

    // Then: 기존 파일을 순차적으로 밀어내고 새 로그를 append 한다.
    expect(rmMock).toHaveBeenCalledWith('logs\\app.log.3', { force: true });
    expect(renameMock).toHaveBeenCalledWith('logs\\app.log.2', 'logs\\app.log.3');
    expect(renameMock).toHaveBeenCalledWith('logs\\app.log.1', 'logs\\app.log.2');
    expect(renameMock).toHaveBeenCalledWith('logs\\app.log', 'logs\\app.log.1');
    expect(appendFileMock).toHaveBeenCalledWith('logs\\app.log', '1234567890\n', 'utf8');
  });

  it('uses a date-suffixed file name for daily rotation - daily rotate면 날짜가 붙은 파일명을 사용한다', async () => {
    // Given: daily rotate 설정을 가진 FileTransport가 있다.
    const transport = new FileTransport({
      enabled: true,
      dirPath: 'logs',
      fileName: 'app.log',
      rotate: {
        type: 'daily',
      },
    });

    // When: 날짜가 포함된 타임스탬프를 가진 로그를 기록한다.
    await transport.write(baseRecord, 'formatted line');

    // Then: 해당 날짜가 반영된 파일명으로 append 한다.
    expect(appendFileMock).toHaveBeenCalledWith('logs\\app-2026-04-10.log', 'formatted line\n', 'utf8');
  });

  it('skips rotation when size rotate has no maxSizeBytes - size rotate에 maxSizeBytes가 없으면 회전을 건너뛴다', async () => {
    // Given: maxSizeBytes를 설정하지 않은 size rotate가 있다.
    const transport = new FileTransport({
      enabled: true,
      dirPath: 'logs',
      fileName: 'app.log',
      rotate: { type: 'size' },
    });

    // When: 로그를 기록한다.
    await transport.write(baseRecord, 'line');

    // Then: append만 수행되고 rotate 관련 호출은 일어나지 않는다.
    expect(appendFileMock).toHaveBeenCalledTimes(1);
    expect(renameMock).not.toHaveBeenCalled();
    expect(rmMock).not.toHaveBeenCalled();
  });

  it('treats missing file as zero size and appends - 기존 파일이 없으면 0 크기로 간주하고 append 한다', async () => {
    // Given: stat이 실패하도록 설정(기본 beforeEach)하고 size rotate 설정이 있다.
    const transport = new FileTransport({
      enabled: true,
      dirPath: 'logs',
      fileName: 'app.log',
      rotate: {
        type: 'size',
        maxSizeBytes: 1024,
      },
    });

    // When: 신규 기록을 수행한다.
    await transport.write(baseRecord, 'line');

    // Then: rotate를 건너뛰고 append로 끝난다.
    expect(renameMock).not.toHaveBeenCalled();
    expect(appendFileMock).toHaveBeenCalledTimes(1);
  });

  it('uses an hourly-suffixed file name for hourly rotation - hourly rotate는 시간까지 포함된 파일명을 사용한다', async () => {
    // Given: hourly rotate 설정을 가진 FileTransport가 있다.
    const transport = new FileTransport({
      enabled: true,
      dirPath: 'logs',
      fileName: 'app.log',
      rotate: { type: 'hourly' },
    });

    // When: 시간 정보를 포함한 타임스탬프의 로그를 기록한다.
    await transport.write(baseRecord, 'line');

    // Then: 날짜-시간이 반영된 파일명으로 append 한다.
    expect(appendFileMock).toHaveBeenCalledWith('logs\\app-2026-04-10-12.log', 'line\n', 'utf8');
  });

  it('falls back to the current date when the record timestamp is malformed - 잘못된 타임스탬프는 현재 시각으로 대체한다', () => {
    // Given: 파싱 불가능한 타임스탬프를 가진 record가 있다.
    const transport = new FileTransport({
      enabled: true,
      dirPath: 'logs',
      fileName: 'app.log',
      rotate: { type: 'daily' },
    });
    const badRecord = { ...baseRecord, timestamp: 'not-a-date' };

    // When / Then: 현재 시각을 기반으로 한 파일 경로가 생성된다 (예외가 발생하지 않는다).
    expect(() => transport.resolveFilePath(badRecord)).not.toThrow();
  });

  it('falls back to a plain file path when no rotate option is set - rotate 옵션이 없으면 기본 파일명을 사용한다', () => {
    // Given: rotate 설정이 없는 FileTransport가 있다.
    const transport = new FileTransport({
      enabled: true,
      dirPath: 'logs',
      fileName: 'app.log',
    });

    // When / Then: 기본 파일 경로를 그대로 사용한다.
    expect(transport.resolveFilePath(baseRecord)).toBe('logs\\app.log');
  });
});
