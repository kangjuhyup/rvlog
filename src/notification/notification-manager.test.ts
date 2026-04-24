import { describe, expect, it, vi } from 'vitest';
import { LogLevel } from '../log/log-level';
import type { LogContext, NotificationChannel } from './notification-channel';
import { NotificationManager } from './notification-manager';

class MockChannel implements NotificationChannel {
  public readonly send = vi.fn(async () => {});
}

const baseContext: LogContext = {
  className: 'UserService',
  methodName: 'create',
  args: [],
  error: new Error('잔액 부족'),
  duration: '0.45ms',
  timestamp: new Date(),
};

describe('NotificationManager', () => {
  it('filters by level and suppresses duplicates during cooldown - 레벨 필터링과 쿨다운 중복 방지를 함께 수행한다', async () => {
    // Given: ERROR만 허용하고 1초 쿨다운을 가진 채널 규칙이 있다.
    vi.useFakeTimers();

    const channel = new MockChannel();
    const manager = new NotificationManager().addRule({
      channel,
      levels: [LogLevel.ERROR],
      cooldownMs: 1000,
      circuitBreaker: {
        failureThreshold: 3,
        recoveryTimeMs: 1000,
        timeoutMs: 100,
      },
    });

    // When: WARN 1회와 같은 ERROR 2회를 연속으로 보낸다.
    await manager.notify(LogLevel.WARN, 'warn', baseContext);
    await manager.notify(LogLevel.ERROR, 'error', baseContext);
    await manager.notify(LogLevel.ERROR, 'error', baseContext);

    // Then: WARN는 걸러지고 동일 ERROR는 쿨다운 동안 한 번만 전송된다.
    expect(channel.send).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1001);
    // When: 쿨다운 이후 같은 ERROR를 다시 보낸다.
    await manager.notify(LogLevel.ERROR, 'error', baseContext);
    // Then: 다시 한 번 전송된다.
    expect(channel.send).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('notifies multiple matching channels independently - 여러 채널이 서로 영향 없이 독립적으로 호출된다', async () => {
    // Given: ERROR를 받을 수 있는 채널 두 개가 등록되어 있다.
    const channelA = new MockChannel();
    const channelB = new MockChannel();
    const manager = new NotificationManager()
      .addRule({
        channel: channelA,
        levels: [LogLevel.ERROR],
        cooldownMs: 0,
        circuitBreaker: {
          failureThreshold: 3,
          recoveryTimeMs: 1000,
          timeoutMs: 100,
        },
      })
      .addRule({
        channel: channelB,
        levels: [LogLevel.WARN, LogLevel.ERROR],
        cooldownMs: 0,
        circuitBreaker: {
          failureThreshold: 3,
          recoveryTimeMs: 1000,
          timeoutMs: 100,
        },
      });

    // When: ERROR 알림을 전송한다.
    await manager.notify(LogLevel.ERROR, 'error', baseContext);

    // Then: 두 채널 모두 독립적으로 호출된다.
    expect(channelA.send).toHaveBeenCalledTimes(1);
    expect(channelB.send).toHaveBeenCalledTimes(1);
  });

  it('prunes expired cooldown entries when the map grows large - 쿨다운 맵이 커지면 오래된 항목을 정리한다', async () => {
    // Given: cooldownMs 0으로 설정해 매 호출이 기록되도록 채널을 만든다.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-10T00:00:00.000Z'));

    const channel = new MockChannel();
    const manager = new NotificationManager().addRule({
      channel,
      levels: [LogLevel.ERROR],
      cooldownMs: 0,
      circuitBreaker: {
        failureThreshold: 10,
        recoveryTimeMs: 1000,
        timeoutMs: 100,
      },
    });

    // When: 서로 다른 dedup 키를 갖도록 에러 메시지를 바꿔 1000회 초과 호출한다.
    for (let i = 0; i < 1001; i += 1) {
      await manager.notify(LogLevel.ERROR, 'error', {
        ...baseContext,
        error: new Error(`err-${i}`),
      });
    }

    // And: 1시간 이상 흐른 뒤 추가로 한 번 더 호출해 prune 경로를 타게 한다.
    vi.advanceTimersByTime(60 * 60 * 1000 + 1);
    await manager.notify(LogLevel.ERROR, 'error', {
      ...baseContext,
      error: new Error('fresh'),
    });

    // Then: 모든 호출이 채널까지 도달했고, 내부적으로 prune이 실행되어도 예외가 발생하지 않는다.
    expect(channel.send).toHaveBeenCalledTimes(1002);

    vi.useRealTimers();
  });

  it('swallows channel failures without blocking other channels - 한 채널 실패가 다른 채널 전송을 막지 않는다', async () => {
    // Given: 하나는 실패하고 하나는 성공하는 채널이 함께 등록되어 있다.
    const failingChannel = new MockChannel();
    const healthyChannel = new MockChannel();
    failingChannel.send.mockRejectedValueOnce(new Error('send failed'));

    const manager = new NotificationManager()
      .addRule({
        channel: failingChannel,
        levels: [LogLevel.ERROR],
        cooldownMs: 0,
        circuitBreaker: {
          failureThreshold: 1,
          recoveryTimeMs: 1000,
          timeoutMs: 100,
        },
      })
      .addRule({
        channel: healthyChannel,
        levels: [LogLevel.ERROR],
        cooldownMs: 0,
        circuitBreaker: {
          failureThreshold: 1,
          recoveryTimeMs: 1000,
          timeoutMs: 100,
        },
      });

    // When: ERROR 알림을 전송한다.
    await expect(manager.notify(LogLevel.ERROR, 'error', baseContext)).resolves.toBeUndefined();
    // Then: 실패 채널의 예외는 흡수되고 정상 채널 전송은 계속된다.
    expect(failingChannel.send).toHaveBeenCalledTimes(1);
    expect(healthyChannel.send).toHaveBeenCalledTimes(1);
  });

  it('uses default circuit breaker options when omitted - circuitBreaker를 생략해도 기본값으로 안전하게 동작한다', async () => {
    const channel = new MockChannel();
    const manager = new NotificationManager().addRule({
      channel,
      levels: [LogLevel.ERROR],
      cooldownMs: 0,
    });

    await expect(manager.notify(LogLevel.ERROR, 'error', baseContext)).resolves.toBeUndefined();
    expect(channel.send).toHaveBeenCalledTimes(1);
  });

  it('does not suppress different non-error messages during cooldown - 일반 로그는 메시지가 다르면 쿨다운 중에도 별도로 전송한다', async () => {
    vi.useFakeTimers();

    const channel = new MockChannel();
    const manager = new NotificationManager().addRule({
      channel,
      levels: [LogLevel.INFO],
      cooldownMs: 1000,
    });

    const infoContext: LogContext = {
      className: 'useSignup',
      methodName: 'log',
      args: [],
      timestamp: new Date(),
    };

    await manager.notify(LogLevel.INFO, 'hook mounted', infoContext);
    await manager.notify(LogLevel.INFO, 'signup() started [{"email":"user@example.com"}]', infoContext);

    expect(channel.send).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
