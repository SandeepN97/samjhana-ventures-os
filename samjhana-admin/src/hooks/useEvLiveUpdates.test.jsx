import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import useEvLiveUpdates from './useEvLiveUpdates';

vi.mock('../utils/api', () => ({ default: { post: vi.fn() } }));
import api from '../utils/api';

class FakeSocket {
  static instances = [];
  constructor(url) {
    this.url = url;
    FakeSocket.instances.push(this);
  }
  close() { this.onclose?.(); }
}

describe('useEvLiveUpdates', () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeSocket);
    localStorage.setItem('token', 'login-token-should-never-be-in-a-url');
    api.post.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    localStorage.clear();
  });

  it('connects with a one-time ticket, never the login token', async () => {
    api.post.mockResolvedValue({ data: { ticket: 'one-time-ticket' } });
    renderHook(() => useEvLiveUpdates(() => {}));

    await waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    expect(api.post).toHaveBeenCalledWith('/api/ev/live-ticket');
    expect(FakeSocket.instances[0].url).toContain('/ws/ev?ticket=one-time-ticket');
    expect(FakeSocket.instances[0].url).not.toContain('login-token');
  });

  it('reports connected once the socket opens and passes events on', async () => {
    api.post.mockResolvedValue({ data: { ticket: 't1' } });
    const onEvent = vi.fn();
    const { result } = renderHook(() => useEvLiveUpdates(onEvent));
    await waitFor(() => expect(FakeSocket.instances).toHaveLength(1));

    act(() => FakeSocket.instances[0].onopen());
    expect(result.current).toBe(true);
    act(() => FakeSocket.instances[0].onmessage({ data: '{"type":"CONNECTED"}' }));
    expect(onEvent).toHaveBeenCalledWith({ type: 'CONNECTED' });
  });

  it('asks for a fresh ticket when it reconnects', async () => {
    api.post
      .mockResolvedValueOnce({ data: { ticket: 'first' } })
      .mockResolvedValueOnce({ data: { ticket: 'second' } });
    renderHook(() => useEvLiveUpdates(() => {}));
    await waitFor(() => expect(FakeSocket.instances).toHaveLength(1));

    act(() => FakeSocket.instances[0].onclose());

    await waitFor(() => expect(FakeSocket.instances).toHaveLength(2), { timeout: 3000 });
    expect(FakeSocket.instances[1].url).toContain('ticket=second');
  });

  it('keeps retrying without opening a socket when no ticket can be had', async () => {
    api.post.mockRejectedValue(new Error('offline'));
    renderHook(() => useEvLiveUpdates(() => {}));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(FakeSocket.instances).toHaveLength(0);
  });

  it('does nothing when nobody is signed in', () => {
    localStorage.removeItem('token');
    renderHook(() => useEvLiveUpdates(() => {}));
    expect(api.post).not.toHaveBeenCalled();
  });
});
