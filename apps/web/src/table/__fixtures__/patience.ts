import { configure } from '@testing-library/react';
import { vi } from 'vitest';

/**
 * Table screens load the real generated data (missions, catalogues) and the local database before they draw, and the
 * wizard tests tap through six steps. On a busy machine that takes longer than Testing Library's 1s wait and Vitest's
 * 5s per test. Imported for its effect by the Table's component tests.
 */
configure({ asyncUtilTimeout: 4000 });
vi.setConfig({ testTimeout: 15_000 });
