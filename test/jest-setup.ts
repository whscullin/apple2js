import { toMatchImageSnapshot } from 'jest-image-snapshot';
import '@testing-library/jest-dom';

expect.extend({ toMatchImageSnapshot });
