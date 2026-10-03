import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { screen, act } from '@testing-library/react';
import NepalDateTime from './NepalDateTime';
import { renderWithProviders } from '../test/test-utils';

const field = () => screen.getByLabelText('Current date and time');

describe('NepalDateTime', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows the date and time in Nepal on a 12-hour clock', () => {
    vi.setSystemTime(new Date('2026-10-03T00:00:00Z')); // 05:45 in Kathmandu (UTC+5:45)
    renderWithProviders(<NepalDateTime id="t" />);
    expect(field()).toHaveValue('Oct 3, 2026, 5:45 AM');
  });

  it('uses PM in the afternoon', () => {
    vi.setSystemTime(new Date('2026-10-03T07:30:00Z')); // 13:15 in Kathmandu
    renderWithProviders(<NepalDateTime id="t" />);
    expect(field()).toHaveValue('Oct 3, 2026, 1:15 PM');
  });

  it('is labelled "Date & Time" and cannot be edited', () => {
    vi.setSystemTime(new Date('2026-10-03T00:00:00Z'));
    renderWithProviders(<NepalDateTime id="t" />);
    expect(screen.getByText('Date & Time')).toBeInTheDocument();
    expect(field()).toHaveAttribute('readonly');
    expect(field()).toHaveAttribute('type', 'text');
  });

  it('follows Nepal, not UTC, around midnight and moves to the next day on the minute', () => {
    vi.setSystemTime(new Date('2026-10-02T18:14:30Z')); // 23:59:30 on 2 Oct in Nepal, still 2 Oct UTC
    renderWithProviders(<NepalDateTime id="t" />);
    expect(field()).toHaveValue('Oct 2, 2026, 11:59 PM');

    act(() => { vi.advanceTimersByTime(31_000); }); // 18:15:01 UTC = 00:00 on 3 Oct in Nepal
    expect(field()).toHaveValue('Oct 3, 2026, 12:00 AM');
  });

  it('keeps ticking every minute', () => {
    vi.setSystemTime(new Date('2026-10-03T00:00:10Z'));
    renderWithProviders(<NepalDateTime id="t" />);
    expect(field()).toHaveValue('Oct 3, 2026, 5:45 AM');
    act(() => { vi.advanceTimersByTime(51_000); });
    expect(field()).toHaveValue('Oct 3, 2026, 5:46 AM');
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(field()).toHaveValue('Oct 3, 2026, 5:47 AM');
  });

  it('shows Nepali labels and Devanagari numerals in Nepali', () => {
    vi.setSystemTime(new Date('2026-10-03T00:00:00Z'));
    renderWithProviders(<NepalDateTime id="t" />, { locale: 'ne' });
    expect(screen.getByText('मिति र समय')).toBeInTheDocument();
    const input = screen.getByLabelText('हालको मिति र समय');
    expect(input.value).toContain('२०२६');
    expect(input.value).toContain('०५:४५');
    expect(input.value).not.toMatch(/[0-9]/);
  });

  it('keeps the field at least 44px tall', () => {
    vi.setSystemTime(new Date('2026-10-03T00:00:00Z'));
    renderWithProviders(<NepalDateTime id="t" />);
    expect(field()).toHaveClass('min-h-[44px]');
  });

  it('stops its timer when it is removed', () => {
    vi.setSystemTime(new Date('2026-10-03T00:00:00Z'));
    const { unmount } = renderWithProviders(<NepalDateTime id="t" />);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
