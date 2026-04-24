import { describe, expect, it } from 'vitest';
import { LogLevel } from '../../log/log-level';
import { levelColor } from './discord-channel.utils';

describe('discord channel utils', () => {
  it.each([
    [LogLevel.ERROR, 0xff3b30],
    [LogLevel.WARN, 0xffcc00],
    [LogLevel.INFO, 0x007aff],
    [LogLevel.DEBUG, 0x8e8e93],
  ])('maps %s to the correct color - %s 레벨 색상을 매핑한다', (level, color) => {
    expect(levelColor(level)).toBe(color);
  });
});
