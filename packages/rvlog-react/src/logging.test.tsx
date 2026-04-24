import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Logger } from 'rvlog';
import { Logging, useLoggingContext } from './logging';

function spyContaining(spy: ReturnType<typeof vi.spyOn>, text: string): boolean {
  return spy.mock.calls.some((args) =>
    args.some((arg) => typeof arg === 'string' && arg.includes(text)),
  );
}

describe('Logging 컴포넌트', () => {
  afterEach(() => {
    Logger.resetForTesting();
    vi.restoreAllMocks();
  });

  it('children을 렌더링한다', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});

    render(
      <Logging component="App">
        <div data-testid="child">hello</div>
      </Logging>,
    );

    expect(screen.getByTestId('child')).toBeDefined();
    expect(screen.getByTestId('child').textContent).toBe('hello');
  });

  it('mount/unmount lifecycle을 로깅한다', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { unmount } = render(
      <Logging component="TestApp">
        <div>content</div>
      </Logging>,
    );

    expect(spyContaining(infoSpy, 'component mounted')).toBe(true);

    infoSpy.mockClear();
    unmount();

    expect(spyContaining(infoSpy, 'component unmounted')).toBe(true);
  });
});

describe('useLoggingContext', () => {
  afterEach(() => {
    Logger.resetForTesting();
    vi.restoreAllMocks();
  });

  it('Logging 하위에서 trackEvent에 접근할 수 있다', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});

    const handler = vi.fn();

    function Child() {
      const { trackEvent } = useLoggingContext();
      return (
        <button onClick={trackEvent('click:test', handler)} data-testid="btn">
          click
        </button>
      );
    }

    render(
      <Logging component="Parent">
        <Child />
      </Logging>,
    );

    debugSpy.mockClear();
    fireEvent.click(screen.getByTestId('btn'));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(spyContaining(debugSpy, 'event:click:test')).toBe(true);
  });

  it('Logging 바깥에서 호출하면 에러를 던진다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    function Orphan() {
      useLoggingContext();
      return <div />;
    }

    expect(() => render(<Orphan />)).toThrow(
      'useLoggingContext must be used within a <Logging> component',
    );
  });

  it('깊이 중첩된 컴포넌트에서도 Context에 접근할 수 있다', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});

    const handler = vi.fn();

    function GrandChild() {
      const { trackEvent } = useLoggingContext();
      return (
        <button onClick={trackEvent('click:deep', handler)} data-testid="deep-btn">
          deep
        </button>
      );
    }

    function Child() {
      return <GrandChild />;
    }

    render(
      <Logging component="Root">
        <Child />
      </Logging>,
    );

    debugSpy.mockClear();
    fireEvent.click(screen.getByTestId('deep-btn'));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(spyContaining(debugSpy, 'event:click:deep')).toBe(true);
  });
});
