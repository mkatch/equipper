import { test, expect, describe } from '@jest/globals';
import { Schema } from '../src/schema.js';

describe('Schema.validate', () => {
	describe('primitive', () => {
		const primitives = {
			string: 'hello',
			number: 42,
			boolean: true,
		};

		for (const typeName in primitives) {
			const schema: Schema<any> = typeName as any;
			for (const [otherTypeName, exampleOtherValue] of Object.entries(primitives)) {
				if (typeName === otherTypeName) {
					test(`'${typeName}' accepts a ${typeName} value`, () => {
						expect(() => Schema.validate(schema, exampleOtherValue)).not.toThrow();
					});
				} else {
					test(`'${typeName}' rejects a ${otherTypeName} value`, () => {
						expect(() => Schema.validate(schema, exampleOtherValue))
							.toThrow(`expected a ${typeName}, got \`${otherTypeName}\``);
					});
				}
			}
		}
	});

	describe('array', () => {
		test('accepts an empty array', () => {
			expect(() => Schema.validate<[string]>(['string'], [])).not.toThrow();
		});

		test('rejects a primitive value', () => {
			expect(() => Schema.validate<[string]>(['string'], 42))
				.toThrow(/expected an array, got `number`/);
		});

		test('rejects a record', () => {
			expect(() => Schema.validate<[string]>(['string'], {}))
				.toThrow(/expected an array, got `object`/);
		});

		test('of primitives rejects an array with wrong item type', () => {
			expect(() => Schema.validate<[string]>(['string'], [42]))
				.toThrow(/expected a string, got `number`/);
		});

		test('of primitives accepts an array with correct item type', () => {
			expect(() => Schema.validate<[string]>(['string'], ['hello']))
				.not.toThrow();
		});

		test('of primitives accepts an array with correct item type', () => {
			expect(() => Schema.validate<[string]>(['string'], ['hello']))
				.not.toThrow();
		});

		test('of compound values rejects an array of non-conforming values', () => {
			expect(() => Schema.validate<[{ name: string }]>([{ name: 'string' }], [{ name: 42 }]))
				.toThrow(/expected a string, got `number`/);
		});

		test('of compound values accepts an array of conforming values', () => {
			expect(() => Schema.validate<[{ name: string }]>([{ name: 'string' }], [{ name: 'Alice' }, { name: 'Bob' }]))
				.not.toThrow();
		});
	})
});