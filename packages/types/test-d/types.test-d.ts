import { type NonEmptyArray, type AtLeastOne, type AtMostOne } from '../src/types.js';

// The purpose of this file is to assert compile-time types only (no runtime).

// ==================== NonEmptyArray Tests ====================

// Valid: NonEmptyArray with at least one element
const validNonEmptyArray: NonEmptyArray<string> = ['first'];
const validNonEmptyArray2: NonEmptyArray<number> = [1, 2, 3];

// Invalid: Empty array should not be allowed
// @ts-expect-error - empty array is not a NonEmptyArray
const invalidEmpty: NonEmptyArray<string> = [];

// ==================== AtLeastOne Tests ====================

type TestAtLeastOne = {
  a?: string;
  b?: number;
  c?: boolean;
};

// Valid: At least one property is provided
const validAtLeastOne1: AtLeastOne<TestAtLeastOne> = { a: 'hello' };
const validAtLeastOne2: AtLeastOne<TestAtLeastOne> = { b: 42 };
const validAtLeastOne3: AtLeastOne<TestAtLeastOne> = { a: 'hello', b: 42 };
const validAtLeastOne4: AtLeastOne<TestAtLeastOne> = { a: 'hello', b: 42, c: true };

// Invalid: No properties provided
// @ts-expect-error - at least one property must be provided
const invalidAtLeastOne: AtLeastOne<TestAtLeastOne> = {};

// ==================== AtMostOne Tests ====================

type TestAtMostOne = {
  x?: string;
  y?: number;
  z?: boolean;
};

// Valid: No properties provided
const validAtMostOne0: AtMostOne<TestAtMostOne> = {};

// Valid: Exactly one property provided
const validAtMostOne1: AtMostOne<TestAtMostOne> = { x: 'hello' };
const validAtMostOne2: AtMostOne<TestAtMostOne> = { y: 42 };
const validAtMostOne3: AtMostOne<TestAtMostOne> = { z: true };

// Invalid: More than one property provided
// @ts-expect-error - at most one property can be provided
const invalidAtMostOne1: AtMostOne<TestAtMostOne> = { x: 'hello', y: 42 };

// @ts-expect-error - at most one property can be provided
const invalidAtMostOne2: AtMostOne<TestAtMostOne> = { x: 'hello', z: true };

// @ts-expect-error - at most one property can be provided
const invalidAtMostOne3: AtMostOne<TestAtMostOne> = { y: 42, z: true };

// @ts-expect-error - at most one property can be provided
const invalidAtMostOne4: AtMostOne<TestAtMostOne> = { x: 'hello', y: 42, z: true };
