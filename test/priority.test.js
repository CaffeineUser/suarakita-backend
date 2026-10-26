import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePriorityScore } from '../src/utils/priority.js';

test('calculatePriorityScore calculates each urgency weight with zero supports', () => {
  assert.equal(calculatePriorityScore('rendah'), 15);
  assert.equal(calculatePriorityScore('sedang'), 30);
  assert.equal(calculatePriorityScore('tinggi'), 45);
  assert.equal(calculatePriorityScore('kritis'), 60);
});

test('calculatePriorityScore includes support count and rounds to two decimals', () => {
  assert.equal(calculatePriorityScore('tinggi', 10), 65);
  assert.equal(calculatePriorityScore('sedang', 1), 32);
  assert.equal(calculatePriorityScore('rendah', 3), 21);
});

test('calculatePriorityScore caps support influence at 20 supports', () => {
  assert.equal(calculatePriorityScore('rendah', 20), 55);
  assert.equal(calculatePriorityScore('rendah', 100), 55);
});

test('calculatePriorityScore treats negative or non-numeric support counts as zero', () => {
  assert.equal(calculatePriorityScore('tinggi', -1), 45);
  assert.equal(calculatePriorityScore('tinggi', 'invalid'), 45);
});

test('calculatePriorityScore rejects unknown urgency', () => {
  assert.throws(() => calculatePriorityScore('darurat'), /tidak valid/);
});
