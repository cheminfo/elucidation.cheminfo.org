import { afterEach, expect, test, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

/**
 * The site as a deployment stamped it, loaded fresh so its mount is read again.
 * @param baseUri - What `document.baseURI` reads on the page handed out.
 * @returns The module, bound to that mount.
 */
async function siteMountedAt(baseUri: string) {
  vi.stubGlobal('document', { baseURI: baseUri });
  vi.resetModules();
  return import('../site.ts');
}

test('a deployment on a host of its own writes its addresses unchanged', async () => {
  const site = await siteMountedAt('https://elucidation.cheminfo.org/');

  expect(site.BASE_PATH).toBe('');
  expect(site.withBase('/')).toBe('/');
  expect(site.withBase('/examples')).toBe('/examples');
  expect(site.pathWithoutBase('/examples')).toBe('/examples');
});

test('a deployment mounted under a path writes every address under it', async () => {
  const site = await siteMountedAt('https://eln.epfl.ch/cheminfo/elucidation/');

  expect(site.BASE_PATH).toBe('/cheminfo/elucidation');
  expect(site.withBase('/')).toBe('/cheminfo/elucidation/');
  expect(site.withBase('/examples')).toBe('/cheminfo/elucidation/examples');
  expect(site.pathWithoutBase('/cheminfo/elucidation/examples')).toBe(
    '/examples',
  );
  expect(site.pathWithoutBase('/cheminfo/elucidation')).toBe('/');
});

test('the same build serves both addresses, because the mount is not built in', async () => {
  const own = await siteMountedAt('https://elucidation.cheminfo.org/');
  const shared = await siteMountedAt(
    'https://eln.epfl.ch/cheminfo/elucidation/',
  );

  expect(own.withBase('/about')).toBe('/about');
  expect(shared.withBase('/about')).toBe('/cheminfo/elucidation/about');
});

test('a page of another tool on the shared host is not read as one of ours', async () => {
  const site = await siteMountedAt('https://eln.epfl.ch/cheminfo/elucidation/');

  expect(site.pathWithoutBase('/cheminfo/surge/exercises')).toBe(
    '/cheminfo/surge/exercises',
  );
  expect(site.pathWithoutBase('/cheminfo/elucidationx')).toBe(
    '/cheminfo/elucidationx',
  );
});
