import { afterEach, expect, test, vi } from 'vitest';

import { recoverResult } from '../recoverResult.ts';

function stubFetch(status: number, body: unknown): string[] {
  const urls: string[] = [];
  vi.stubGlobal('fetch', (url: string) => {
    urls.push(url);
    return Promise.resolve(Response.json(body, { status }));
  });
  return urls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test('a run whose mapping expired is revived from the cache file', async () => {
  const urls = stubFetch(200, {
    results: [{ smiles: 'CCOC=C', score: 0.82 }],
    metadata: {
      job_id: 'abc',
      processing_time: 101,
      timestamp: 1784390512.18,
      task_id: 't1',
    },
  });

  const recovery = await recoverResult('abc');

  expect(urls).toStrictEqual(['/jobs/abc/result']);
  expect(recovery).toStrictEqual({
    kind: 'recovered',
    patch: {
      resultPayload: {
        results: [{ smiles: 'CCOC=C', score: 0.82 }],
        metadata: {
          job_id: 'abc',
          processing_time: 101,
          timestamp: 1784390512.18,
          task_id: 't1',
        },
      },
      state: 'success',
      // The run's own completion time, not the moment it was fetched back.
      completedAt: 1784390512180,
      error: undefined,
    },
  });
});

test('the base url is honoured', async () => {
  const urls = stubFetch(200, { results: [] });
  await recoverResult('abc', 'https://example.org');
  expect(urls).toStrictEqual(['https://example.org/jobs/abc/result']);
});

test('a bare candidate array is dated from the clock, which is all there is', async () => {
  stubFetch(200, [{ smiles: 'CCO', score: 0.4 }]);
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-15T10:00:00Z'));

  const recovery = await recoverResult('abc');

  expect(recovery).toStrictEqual({
    kind: 'recovered',
    patch: {
      resultPayload: [{ smiles: 'CCO', score: 0.4 }],
      state: 'success',
      completedAt: Date.parse('2026-08-15T10:00:00Z'),
      error: undefined,
    },
  });
  vi.useRealTimers();
});

test('404 means the server holds nothing for that id', async () => {
  stubFetch(404, { detail: 'Job not found' });
  await expect(recoverResult('abc')).resolves.toStrictEqual({ kind: 'gone' });
});

test('410 means a file exists but the run never completed', async () => {
  stubFetch(410, {
    detail: 'Job did not complete and its task is no longer tracked.',
  });
  await expect(recoverResult('abc')).resolves.toStrictEqual({ kind: 'gone' });
});

test('a still-running job is not written off', async () => {
  stubFetch(400, { detail: 'Job not completed. Current status: PROGRESS' });
  await expect(recoverResult('abc')).resolves.toStrictEqual({
    kind: 'unavailable',
  });
});

test('a server error is not written off either', async () => {
  stubFetch(500, { detail: 'boom' });
  await expect(recoverResult('abc')).resolves.toStrictEqual({
    kind: 'unavailable',
  });
});

test('a network failure leaves the run alone', async () => {
  vi.stubGlobal('fetch', () =>
    Promise.reject(new TypeError('Failed to fetch')),
  );
  await expect(recoverResult('abc')).resolves.toStrictEqual({
    kind: 'unavailable',
  });
});
