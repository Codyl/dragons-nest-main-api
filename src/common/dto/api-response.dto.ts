/**
 * Standard API response wrapper. All endpoints should return this shape
 * with a typed data payload.
 *
 * Defined as a class so Nest Swagger can reflect on it.
 */
export class ApiResponseDto<T = object> {
  message!: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data!: T;
}

/**
 * Use for endpoints that return no payload (e.g. logout, delete, update).
 * Kept as an empty class so the `data` property is still an object.
 */
export class EmptyDataDto {}
