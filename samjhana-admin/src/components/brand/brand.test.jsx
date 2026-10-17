import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Fuel } from 'lucide-react';
import { renderWithProviders } from '../../test/test-utils';
import { PageHeader, HeaderAction, Button, Card, StatusBadge, Wordmark } from './index';
import { UNIT_THEMES, unitTheme } from '../../brand/theme';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const setDesktop = (on) => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: on,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
};

describe('brand theme', () => {
  it('gives every business unit and core a complete theme', () => {
    const keys = Object.keys(UNIT_THEMES.core);
    for (const unit of ['core', 'petrol', 'ev', 'furniture', 'rental', 'loans']) {
      expect(Object.keys(UNIT_THEMES[unit])).toEqual(keys);
      expect(UNIT_THEMES[unit].header).toMatch(new RegExp(`^bg-${unit}-\\d+$`));
    }
  });

  it('falls back to core for an unknown unit', () => {
    expect(unitTheme('unknown')).toBe(UNIT_THEMES.core);
  });
});

describe('PageHeader', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => delete window.matchMedia);

  it('renders the title, subtitle and business colour', () => {
    renderWithProviders(<PageHeader unit="petrol" icon={Fuel} title="Petrol Pump" subtitle="Today" />);
    expect(screen.getByRole('heading', { name: 'Petrol Pump' })).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toHaveClass('bg-petrol-600');
  });

  it('goes back to the given page, with a 44px back button labelled in English', async () => {
    renderWithProviders(<PageHeader unit="ev" title="EV" backTo="/entry/ev" />);
    const back = screen.getByRole('button', { name: 'Go Back' });
    expect(back).toHaveClass('h-11', 'w-11', 'shrink-0');
    await userEvent.click(back);
    expect(mockNavigate).toHaveBeenCalledWith('/entry/ev');
  });

  it('labels the back button in Nepali', () => {
    renderWithProviders(<PageHeader title="EV" />, { locale: 'ne' });
    expect(screen.getByRole('button', { name: 'फिर्ता जानुहोस्' })).toBeInTheDocument();
  });

  it('uses a custom back handler instead of navigating', async () => {
    const onBack = vi.fn();
    renderWithProviders(<PageHeader title="Loans" onBack={onBack} />);
    await userEvent.click(screen.getByRole('button', { name: 'Go Back' }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('renders actions and tabs, and can hide the language toggle', () => {
    renderWithProviders(
      <PageHeader title="Rental" actions={<HeaderAction icon={Fuel} label="Tenants" onClick={() => {}} />} showLanguageToggle={false}>
        <div>tabs</div>
      </PageHeader>,
    );
    expect(screen.getByRole('button', { name: 'Tenants' })).toHaveClass('min-h-[44px]');
    expect(screen.getByText('tabs')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(2); // back + Tenants, no language toggle
  });

  it('removes a repeated sidebar title on desktop but keeps it for screen readers', () => {
    setDesktop(true);
    renderWithProviders(<PageHeader title="Records" hideWhenSidebarShows />);

    expect(screen.getByRole('heading', { name: 'Records' })).toHaveClass('sr-only');
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go Back' })).not.toBeInTheDocument();
  });

  it('keeps unique desktop controls when the repeated title is removed', () => {
    setDesktop(true);
    renderWithProviders(
      <PageHeader
        title="End of Day"
        subtitle="Today"
        hideWhenSidebarShows
        actions={<HeaderAction icon={Fuel} label="Review" onClick={() => {}} />}
      >
        <div>tabs</div>
      </PageHeader>,
    );

    expect(screen.getByRole('heading', { name: 'End of Day' })).toHaveClass('sr-only');
    expect(screen.getByText('Today')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Review' })).toBeVisible();
    expect(screen.getByText('tabs')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Go Back' })).not.toBeInTheDocument();
  });
});

describe('Button', () => {
  it('takes the business colour and is at least 44px tall', async () => {
    const onClick = vi.fn();
    renderWithProviders(<Button unit="furniture" onClick={onClick}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveClass('bg-furniture-600', 'min-h-[44px]');
    expect(button).toHaveAttribute('type', 'button');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not fire when disabled', async () => {
    const onClick = vi.fn();
    renderWithProviders(<Button disabled onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('looks the same for danger in every unit', () => {
    renderWithProviders(<Button unit="petrol" variant="danger">Delete</Button>);
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('bg-red-600');
  });
});

describe('Card, StatusBadge and Wordmark', () => {
  it('renders a card as any element', () => {
    renderWithProviders(<Card as="section" aria-label="details">Body</Card>);
    expect(screen.getByRole('region', { name: 'details' })).toHaveClass('bg-white', 'rounded-xl');
  });

  it('colours a status badge by tone, falling back to neutral', () => {
    renderWithProviders(<><StatusBadge tone="success">Paid</StatusBadge><StatusBadge tone="bogus">Other</StatusBadge></>);
    expect(screen.getByText('Paid')).toHaveClass('bg-green-100');
    expect(screen.getByText('Other')).toHaveClass('bg-gray-100');
  });

  it('shows the company name in English and Nepali', () => {
    const { unmount } = renderWithProviders(<Wordmark />);
    expect(screen.getByText('Samjhana Ventures')).toBeInTheDocument();
    unmount();
    renderWithProviders(<Wordmark />, { locale: 'ne' });
    expect(screen.getByText('सम्झना भेन्चर्स')).toBeInTheDocument();
  });
});
