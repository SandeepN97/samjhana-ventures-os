import { describe, it, expect, vi, afterEach } from 'vitest';
import { fitWithin, mediaUrl, resolveMediaUrl, prepareImage } from './image';

describe('fitWithin', () => {
  it('leaves a small picture alone', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('shrinks a wide picture so its longest side is 1600', () => {
    expect(fitWithin(3200, 1600)).toEqual({ width: 1600, height: 800 });
  });

  it('shrinks a tall picture the same way and keeps its shape', () => {
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });

  it('never makes a picture bigger', () => {
    expect(fitWithin(10, 10, 1600)).toEqual({ width: 10, height: 10 });
  });
});

describe('picture addresses', () => {
  it('builds the public address from an id, and nothing from no id', () => {
    expect(mediaUrl('abc')).toBe('/api/public/media/abc');
    expect(mediaUrl('')).toBe('');
    expect(mediaUrl(null)).toBe('');
  });

  it('makes an API-relative path showable', () => {
    expect(resolveMediaUrl('/api/public/media/abc')).toBe('/api/public/media/abc');
    expect(resolveMediaUrl(undefined)).toBe('');
  });
});

describe('prepareImage', () => {
  afterEach(() => vi.unstubAllGlobals());

  const fakeFile = (type, size) => ({ type, size });

  function stubCanvas(blobSize, bitmap = { width: 3200, height: 1600 }) {
    const drawImage = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
    vi.spyOn(document, 'createElement').mockImplementation((tag) => (tag === 'canvas'
      ? { getContext: () => ({ drawImage }), toBlob: (cb, type) => cb({ type, size: blobSize }) }
      : document.createElement.wrappedMethod?.(tag)));
    return drawImage;
  }

  it('refuses a file that is not a JPEG, PNG or WebP picture', async () => {
    await expect(prepareImage(fakeFile('image/svg+xml', 10))).rejects.toThrow('type');
    await expect(prepareImage(fakeFile('application/pdf', 10))).rejects.toThrow('type');
    await expect(prepareImage(null)).rejects.toThrow('type');
  });

  it('draws a large photo smaller and returns the smaller JPEG', async () => {
    const draw = stubCanvas(200_000);
    const out = await prepareImage(fakeFile('image/jpeg', 5_000_000));
    expect(draw).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 800);
    expect(out).toEqual({ type: 'image/jpeg', size: 200_000 });
  });

  it('keeps a PNG as a PNG', async () => {
    stubCanvas(100_000);
    const out = await prepareImage(fakeFile('image/png', 4_000_000));
    expect(out.type).toBe('image/png');
  });

  it('keeps the original when it was already small and re-saving would make it bigger', async () => {
    stubCanvas(90_000, { width: 800, height: 600 });
    const original = fakeFile('image/jpeg', 50_000);
    expect(await prepareImage(original)).toBe(original);
  });

  it('refuses a picture that is still over 3 MB after shrinking', async () => {
    stubCanvas(3_500_000);
    await expect(prepareImage(fakeFile('image/jpeg', 9_000_000))).rejects.toThrow('size');
  });
});
