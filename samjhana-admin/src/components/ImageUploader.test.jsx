import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImageUploader from './ImageUploader';
import { renderWithProviders } from '../test/test-utils';
import api from '../utils/api';
import { prepareImage } from '../utils/image';

vi.mock('../utils/api', () => ({ default: { post: vi.fn() } }));
vi.mock('../utils/image', async (orig) => ({ ...(await orig()), prepareImage: vi.fn() }));

const file = (name = 'a.jpg', type = 'image/jpeg') => new File(['x'], name, { type });
const pick = (input, ...files) => fireEvent.change(input, { target: { files } });
const picker = () => document.querySelector('input[type="file"]');

describe('ImageUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepareImage.mockImplementation(async (f) => f);
  });

  it('shows an empty state and an add button when there are no pictures', () => {
    renderWithProviders(<ImageUploader value={[]} onChange={() => {}} />);
    expect(screen.getByText('No pictures yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add pictures' })).toHaveClass('min-h-[44px]');
  });

  it('uploads each picked file and adds the new ids after the existing ones', async () => {
    api.post.mockResolvedValueOnce({ data: { id: 'new-1' } }).mockResolvedValueOnce({ data: { id: 'new-2' } });
    const onChange = vi.fn();
    renderWithProviders(<ImageUploader value={['old']} onChange={onChange} />);

    pick(picker(), file('1.jpg'), file('2.jpg'));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['old', 'new-1', 'new-2']));
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(api.post.mock.calls[0][0]).toBe('/api/media');
    expect(api.post.mock.calls[0][1]).toBeInstanceOf(FormData);
  });

  it('shows the cover badge on the first picture and a make-cover button on the others', () => {
    renderWithProviders(<ImageUploader value={['a', 'b']} onChange={() => {}} />);
    expect(screen.getAllByText('Cover')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Make cover' })).toHaveLength(1);
    expect(screen.getByAltText('Picture 1')).toHaveAttribute('src', '/api/public/media/a');
  });

  it('moves a picture to the front when it is made the cover', async () => {
    const onChange = vi.fn();
    renderWithProviders(<ImageUploader value={['a', 'b', 'c']} onChange={onChange} />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Make cover' })[1]);   // picture 3
    expect(onChange).toHaveBeenCalledWith(['c', 'a', 'b']);
  });

  it('reorders with the earlier and later buttons, and disables them at the ends', async () => {
    const onChange = vi.fn();
    renderWithProviders(<ImageUploader value={['a', 'b']} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Move picture 1 earlier' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move picture 2 later' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Move picture 1 later' }));
    expect(onChange).toHaveBeenCalledWith(['b', 'a']);
  });

  it('takes a picture off the list without deleting the file', async () => {
    const onChange = vi.fn();
    renderWithProviders(<ImageUploader value={['a', 'b']} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove picture 1' }));
    expect(onChange).toHaveBeenCalledWith(['b']);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('stops at the limit and says so', async () => {
    renderWithProviders(<ImageUploader value={['a', 'b']} max={2} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Add pictures' })).toBeDisabled();
  });

  it('adds only what fits and explains the rest', async () => {
    api.post.mockResolvedValue({ data: { id: 'n' } });
    const onChange = vi.fn();
    renderWithProviders(<ImageUploader value={['a']} max={2} onChange={onChange} />);
    pick(picker(), file('1.jpg'), file('2.jpg'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['a', 'n']));
    expect(await screen.findByRole('alert')).toHaveTextContent('up to 2 pictures');
  });

  it('shows a message for a wrong file type, an oversize picture and a failed upload', async () => {
    renderWithProviders(<ImageUploader value={[]} onChange={() => {}} />);

    prepareImage.mockRejectedValueOnce(new Error('type'));
    pick(picker(), file('a.gif', 'image/gif'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a JPG, PNG or WebP picture.');

    prepareImage.mockRejectedValueOnce(new Error('size'));
    pick(picker(), file());
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('over 3 MB'));

    api.post.mockRejectedValueOnce({ response: { data: { message: 'Only JPEG, PNG or WebP pictures can be uploaded' } } });
    pick(picker(), file());
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Only JPEG, PNG or WebP'));
  });

  it('in single mode replaces the picture instead of adding, and has no cover or reorder controls', async () => {
    api.post.mockResolvedValue({ data: { id: 'fresh' } });
    const onChange = vi.fn();
    renderWithProviders(<ImageUploader value={['old']} single onChange={onChange} />);
    expect(screen.queryByText('Cover')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Move picture/ })).not.toBeInTheDocument();
    pick(picker(), file());
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['fresh']));
    expect(screen.getByRole('button', { name: 'Replace picture' })).toBeInTheDocument();
  });

  it('shows Nepali labels', () => {
    renderWithProviders(<ImageUploader value={['a']} onChange={() => {}} />, { locale: 'ne' });
    expect(screen.getByRole('button', { name: 'तस्बिर थप्नुहोस्' })).toBeInTheDocument();
    expect(screen.getByText('मुख्य')).toBeInTheDocument();
  });
});
