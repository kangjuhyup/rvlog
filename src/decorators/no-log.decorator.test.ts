import { describe, expect, it } from 'vitest';
import { isNoLog, NoLog } from './no-log.decorator';

class SampleService {
  @NoLog
  skip(): string {
    return 'ok';
  }

  keep(): string {
    return 'ok';
  }
}

describe('@NoLog', () => {
  it('stores metadata on decorated methods only - 데코레이터가 붙은 메서드에만 제외 메타데이터를 저장한다', () => {
    // Given / When: 데코레이터가 붙은 메서드와 아닌 메서드의 메타데이터를 조회한다.
    // Then: @NoLog가 붙은 메서드만 true를 반환한다.
    expect(isNoLog(SampleService.prototype, 'skip')).toBe(true);
    expect(isNoLog(SampleService.prototype, 'keep')).toBe(false);
  });
});
