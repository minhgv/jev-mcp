import { JevValidationError } from "./errors.js";

export function assertThresholdOrder(input: {
  autoAccept?: number;
  reviewAt?: number;
  blockAt?: number;
}): void {
  if (input.autoAccept !== undefined && input.reviewAt !== undefined && input.reviewAt > input.autoAccept) {
    throw new JevValidationError("review threshold must be <= auto-accept threshold");
  }
  if (input.reviewAt !== undefined && input.blockAt !== undefined && input.reviewAt > input.blockAt) {
    throw new JevValidationError("review threshold must be <= block threshold");
  }
}
