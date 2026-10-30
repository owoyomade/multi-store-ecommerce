// Errors that service functions throw for expected situations. Pages and
// actions turn these into friendly messages; anything else is a real bug.

/** The record doesn't exist, or exists in a store the caller can't access. */
export class NotFoundError extends Error {
  constructor(entity: string) {
    super(`${entity} not found`);
    this.name = "NotFoundError";
  }
}

/** Input was well-formed but clashes with existing data, e.g. a duplicate slug. */
export class FieldConflictError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "FieldConflictError";
  }
}

/** A business rule rejected the request, e.g. "only 2 left in stock". */
export class RuleViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleViolationError";
  }
}
