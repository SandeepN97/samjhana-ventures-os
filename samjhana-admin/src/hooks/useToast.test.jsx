import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from './useToast';

describe('useToast', () => {
  it('stacks toasts that have no key', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showToast('one');
      result.current.showToast('two');
    });
    expect(result.current.toasts.map((t) => t.message)).toEqual(['one', 'two']);
  });

  it('replaces a toast with the same key instead of stacking it', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showToast('Payment confirmed — unlocking', 'success', undefined, 'ev-session-1');
      result.current.showToast('Connector unlocked', 'success', undefined, 'ev-session-1');
    });
    expect(result.current.toasts.map((t) => t.message)).toEqual(['Connector unlocked']);
  });

  it('keeps toasts for different keys side by side', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showToast('Session A unlocked', 'success', undefined, 'ev-session-a');
      result.current.showToast('Session B stopped', 'info', undefined, 'ev-session-b');
      result.current.showToast('Saved');
    });
    expect(result.current.toasts).toHaveLength(3);
  });

  it('removes a toast by id', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast('bye'));
    act(() => result.current.removeToast(result.current.toasts[0].id));
    expect(result.current.toasts).toEqual([]);
  });
});
