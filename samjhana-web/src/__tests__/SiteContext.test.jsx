import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../api/api.js', () => ({ siteApi: { get: vi.fn() } }));
import { siteApi } from '../api/api.js';
import { SiteProvider, useSite } from '../site/SiteContext';

function Probe() {
  const { site, error, stale, retry } = useSite();
  return <div>
    <p>{site ? site.identity.name : 'no site'}</p>
    {error && <p>error</p>}{stale && <p>stale</p>}
    <button onClick={retry}>retry</button>
  </div>;
}
const data = { identity: { name: 'Fresh Name' } };

describe('SiteProvider', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

  it('loads the content and saves a copy', async () => {
    siteApi.get.mockResolvedValue(data);
    render(<SiteProvider><Probe /></SiteProvider>);
    expect(await screen.findByText('Fresh Name')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('mv-site-cache')).identity.name).toBe('Fresh Name');
  });
  it('falls back to the saved copy when the server is down', async () => {
    localStorage.setItem('mv-site-cache', JSON.stringify({ identity: { name: 'Saved Name' } }));
    siteApi.get.mockRejectedValue(new Error('down'));
    render(<SiteProvider><Probe /></SiteProvider>);
    expect(await screen.findByText('stale')).toBeInTheDocument();
    expect(screen.getByText('Saved Name')).toBeInTheDocument();
    expect(screen.queryByText('error')).not.toBeInTheDocument();
  });
  it('reports an error when there is nothing saved, and retries', async () => {
    siteApi.get.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(data);
    render(<SiteProvider><Probe /></SiteProvider>);
    expect(await screen.findByText('error')).toBeInTheDocument();
    await userEvent.click(screen.getByText('retry'));
    await waitFor(() => expect(screen.getByText('Fresh Name')).toBeInTheDocument());
  });
  it('ignores a corrupt saved copy', async () => {
    localStorage.setItem('mv-site-cache', '{not json');
    siteApi.get.mockResolvedValue(data);
    render(<SiteProvider><Probe /></SiteProvider>);
    expect(await screen.findByText('Fresh Name')).toBeInTheDocument();
  });
});
