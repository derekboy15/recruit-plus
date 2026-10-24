import { configure } from '@testing-library/react';

/**
 * Table screens load the real generated data (missions, catalogues) and the local database before they draw, which can
 * take longer than Testing Library's 1s on a busy machine. Imported for its effect by the Table's component tests.
 */
configure({ asyncUtilTimeout: 4000 });
