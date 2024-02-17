/**
 * Type-safe schema of plain JavaScript objects.
 * 
 * A schema has to be written by hand, but the type construction ensures that
 * there is a very limited number of ways to do it correctly. If the schema
 * mismatches the corresponsind type, the typechecker will output a helpful
 * message.
 */
export type Schema<T>
	= T extends undefined ? 'undefined'
	: T extends null ? 'null'
	: T extends string ? 'string'
	: T extends number ? 'number'
	: T extends boolean ? 'boolean'
	: T extends [] ? Schema.Array<T>
	: T extends {} ? Schema.Record<T>
	: never;

export namespace Schema {
	/**
	 * Schema of an array type.
	 * 
	 * Has to be an array with a single element containing the schema for the
	 * elements.
	 * 
	 * Caveat: the typechecker does not check the length of the array.
	 **/
	export type Array<T extends []> = [Schema<T[0]>];

	/**
	 * Schema of a record type.
	 * 
	 * Can be one of the following:
	 *   1. A record of schemas for each property of the record. The keys have to
	 *     mirror the keys of the original record.
	 *   2. A {@link Union} schema for records that are discriminated unions.
	 *   3. A {@link UnionMember} schema for records that are members
	 *     discriminated union.
	 * 
	 * An example for a correct record schema in variant 1.:
	 * ```typescript
	 * type Foo = {
	 *   a: number,
	 *   bar: { b: string, c: boolean },
	 * };
	 * const schema: Schema<Foo> = {
	 *   a: 'number',
	 *   bar: { b: 'string', c: 'boolean' },
	 * };
	 * ```
	 * 
	 * Caveats: the typechecked will not enforce correct choice of any of these
	 * three. If your type is a union or a union member you have to use the
	 * correct option. Once you do, the typechecker will ensure that the unions
	 * are correctly specified.
	 */
	export type Record<T extends {}>
		= { [K in keyof T]-?: Schema<T[K]> }
		| Union<T, any>
		| UnionMember<T, any>;

	/**
	 * Schema of a union of records, discriminated by a string key.
	 * 
	 * For example, the correct schema for the following type:
	 * ```typescript
	 * type Foo = { kind: 'foo', a: number };
	 * type Bar = { kind: 'bar', b: string };
	 * type FooBar = Foo | Bar;
	 * ```
	 * is
	 * ```typescript
	 * const schema = new Schema.Union(
	 *   (_: FooBar) => 'kind', {
	 *   foo: fooSchema, // : Scene.UnionMember<Foo, 'kind'>
	 *   bar: barSchema, // : Scene.UnionMember<Bar, 'kind'>
	 * });
	 * ```
	 * 
	 * The peculiar `(_: FooBar) => 'kind'` function argument is a trick to make
	 * the typechecker infer all the generic arguments. Just remember: the
	 * argument has to be a function that has a single argument of the union type
	 * being described, and returns the literal name of the discriminating key.
	 * 
	 * Following is a record of members. Each entry has a key equal to the
	 * discriminating value for that type, and the value is the
	 * {@link UnionMember} schema for that member type.
	 */
	export class Union<
		T extends { [key in K]: string },
		K extends string,
	> {
		readonly discriminatorKey: string;

		constructor(
			discriminatorKey: (_: T) => K,
			public readonly members: {
				[value in T[K]]: UnionMember<Extract<T, { [key in K]: value }>, K>
			},
		) {
			this.discriminatorKey = discriminatorKey({} as T);
		}
	};

	/**
	 * Schema of a record that is a member of a discriminating union. Also serves
	 * as a stand-alone schema.
	 * 
	 * For example the correct schemas for the following types:
	 * ```typescript
	 * type Foo = { kind: 'foo', a: number };
	 * type Bar = { kind: 'bar', b: string, c: boolean };
	 * type FooBar = Foo | Bar;
	 * ```
	 * are
	 * ```typescript
	 * const fooSchema = new Schema.UnionMember(
	 *   (_: Foo) => ({ kind: 'foo' }), {
	 *   a: 'number',
	 * });
	 * const barSchema = new Schema.UnionMember(
	 *   (_: Bar) => ({ kind: 'bar' }), {
	 *   b: 'string',
	 *   c: 'boolean',
	 * });
	 * ```
	 * 
	 * The first argument in the constructor is a trick function similar to the
	 * one in {@link Union}. It has take a single argument of the member type
	 * being described and return a record with a single entry representing the
	 * discriminating key and value.
	 * 
	 * Following is an ordinary schema of the record, but without the
	 * dicriminating key.
	 **/
	export class UnionMember<
		T extends { [key in K]: string },
		K extends string,
	> {
		readonly discriminatorKey: string;
		readonly discriminatorValue: string;

		constructor(
			discriminator: (_: T) => Pick<T, K>,
			public readonly schema: Schema<Omit<T, K>>,
		) {
			const d = discriminator({} as T);
			this.discriminatorKey = Object.keys(d)[0];
			this.discriminatorValue = Object.values(d)[0]!.toString();
		}
	};

	/**
	 * Applies schema to an untyped value.
	 * 
	 * Throws when `obj` does not conform to the schema. Otherwise it can be
	 * safely promoted to to type `T`.
	 */
	export function validate<T>(schema: Schema<T>, obj: any): void {
		validateInternal(schema, obj, ['']);
	}

	function validateInternal(schema: Schema<any>, obj: any, c: string[]): void {
		if (schema !== 'undefined' && obj === undefined) {
			validationFailed(c, 'missing');
		}

		if (typeof schema === 'string') {
			if (
				(schema !== 'null' && typeof obj !== schema) ||
				(schema === 'null' && obj !== null)
			) {
				validationFailed(c, `expected a ${schema}, got \`${typeof obj}\``);
			}
			return
		}

		if (schema instanceof Array) {
			const subSchema = schema[0];
			if (!(obj instanceof Array)) {
				validationFailed(c, `expected an array, got \`${typeof obj}\``);
			}
			return obj.forEach((item, i) => validateInternal(subSchema, item, [...c, `[ ${i} ]`]));
		}

		if (!(obj instanceof Object)) {
			validationFailed(c, `expected an object, got \`${typeof obj}\``);
		}

		if (schema instanceof Union || schema instanceof UnionMember) {
			const discriminatorValue = obj[schema.discriminatorKey];
			const cKey = [...c, schema.discriminatorKey];
			validateInternal('string', discriminatorValue, cKey);

			if (schema instanceof Union) {
				const member = schema.members[discriminatorValue];
				if (!member) {
					validationFailed(cKey, `expected one of \`${Object.keys(schema.members).join(' | ')}\`, got \`${discriminatorValue}\``);
				}
				return validateInternal(member, obj, c);
			} else {
				if (discriminatorValue !== schema.discriminatorValue) {
					validationFailed(cKey, `expected \`${schema.discriminatorValue}\`, got \`${discriminatorValue}\``);
				}
				return validateInternal(schema.schema, obj, c);
			}
		}

		if (schema instanceof Object) {
			for (const key in schema) {
				validateInternal(schema[key], obj[key], [...c, key]);
			}
			return;
		}

		const exhaustive: never = schema;
		throw new Error('Invalid schama ' + exhaustive);
	}

	function validationFailed(context: string[], message: string): never {
		const path = context
			.map((segment, i) => '.   '.repeat(i) + segment)
			.join('\n');
		throw new Error('\n' + path + '\n\n' + message);
	}
}