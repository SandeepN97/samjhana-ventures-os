import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { screen, act } from '@testing-library/react';
import NepalDateTime from './NepalDateTime';
import { renderWithProviders } from '../test/test-utils';

const time = () => screen.getByTestId('nepal-time').textContent;
const date = () => screen.getByTestId('nepal-date').textContent;

describe('NepalDateTime', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  describe('English (AD)', () => {
    it('shows the AD date, weekday and 12-hour Nepal time', () => {
      vi.setSystemTime(new Date('2026-10-03T00:00:00Z')); // 05:45 in Kathmandu (UTC+5:45)
      renderWithProviders(<NepalDateTime id="t" />);
      expect(time()).toBe('5:45 AM');
      expect(date()).toBe('Sat, Oct 3, 2026');
    });

    it('uses PM in the afternoon', () => {
      vi.setSystemTime(new Date('2026-10-03T08:30:00Z')); // 14:15 in Kathmandu
      renderWithProviders(<NepalDateTime id="t" />);
      expect(time()).toBe('2:15 PM');
    });

    it('is labelled, marked as Nepal time and has no editable control', () => {
      vi.setSystemTime(new Date('2026-10-03T00:00:00Z'));
      const { container } = renderWithProviders(<NepalDateTime id="t" />);
      expect(screen.getByText('Date & Time')).toBeInTheDocument();
      expect(screen.getByText('Nepal time (NPT)')).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Current date and time' })).toBeInTheDocument();
      expect(container.querySelector('input')).toBeNull();
    });

    it('follows Nepal, not UTC, around midnight and moves to the next day on the minute', () => {
      vi.setSystemTime(new Date('2026-10-02T18:14:30Z')); // 23:59:30 on 2 Oct in Nepal
      renderWithProviders(<NepalDateTime id="t" />);
      expect(time()).toBe('11:59 PM');
      expect(date()).toBe('Fri, Oct 2, 2026');

      act(() => { vi.advanceTimersByTime(31_000); }); // 00:00 on 3 Oct in Nepal
      expect(time()).toBe('12:00 AM');
      expect(date()).toBe('Sat, Oct 3, 2026');
    });

    it('keeps ticking every minute', () => {
      vi.setSystemTime(new Date('2026-10-03T00:00:10Z'));
      renderWithProviders(<NepalDateTime id="t" />);
      expect(time()).toBe('5:45 AM');
      act(() => { vi.advanceTimersByTime(51_000); });
      expect(time()).toBe('5:46 AM');
      act(() => { vi.advanceTimersByTime(60_000); });
      expect(time()).toBe('5:47 AM');
    });
  });

  describe('Nepali (BS)', () => {
    it('shows the BS date, Nepali weekday and Devanagari 12-hour time', () => {
      vi.setSystemTime(new Date('2026-10-03T08:30:00Z')); // 14:15 on 3 Oct 2026 = 2083 Ashwin 17
      renderWithProviders(<NepalDateTime id="t" />, { locale: 'ne' });
      expect(date()).toBe('२०८३ आश्विन १७, शनिबार');
      expect(time()).toBe('२:१५ अपराह्न');
      expect(screen.getByText('मिति र समय')).toBeInTheDocument();
      expect(screen.getByText('नेपाल समय')).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'हालको मिति र समय' })).toBeInTheDocument();
    });

    it('shows no Latin digits', () => {
      vi.setSystemTime(new Date('2026-10-03T08:30:00Z'));
      renderWithProviders(<NepalDateTime id="t" />, { locale: 'ne' });
      expect(time()).not.toMatch(/[0-9]/);
      expect(date()).not.toMatch(/[0-9]/);
    });

    it('starts the BS new year on Baisakh 1', () => {
      vi.setSystemTime(new Date('2026-04-14T06:00:00Z')); // noon in Kathmandu
      renderWithProviders(<NepalDateTime id="t" />, { locale: 'ne' });
      expect(date()).toMatch(/^२०८३ बैशाख १, /);
    });

    it('moves the BS date at Nepal midnight, not UTC midnight', () => {
      vi.setSystemTime(new Date('2026-10-02T18:14:30Z')); // 23:59:30 on 2 Oct = Ashwin 16
      renderWithProviders(<NepalDateTime id="t" />, { locale: 'ne' });
      expect(date()).toBe('२०८३ आश्विन १६, शुक्रबार');
      act(() => { vi.advanceTimersByTime(31_000); });
      expect(date()).toBe('२०८३ आश्विन १७, शनिबार');
    });
  });

  it('keeps the card at least 44px tall', () => {
    vi.setSystemTime(new Date('2026-10-03T00:00:00Z'));
    renderWithProviders(<NepalDateTime id="t" />);
    expect(screen.getByTestId('nepal-time').parentElement.parentElement).toHaveClass('min-h-[44px]');
  });

  it('stops its timer when it is removed', () => {
    vi.setSystemTime(new Date('2026-10-03T00:00:00Z'));
    const { unmount } = renderWithProviders(<NepalDateTime id="t" />);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
