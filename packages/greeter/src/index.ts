// TEMPLATE:REPLACE this composition example with the second domain capability after cloning or forking.
import { greet } from '@dev-ledger/hello';

export type Announcement = {
  message: string;
};

export function announce(name: string, occasion: string): Announcement {
  const trimmedOccasion = occasion.trim();

  if (trimmedOccasion.length === 0) {
    throw new Error('occasion must not be empty');
  }

  const { message } = greet(name);
  return { message: `${message} Welcome to ${trimmedOccasion}.` };
}
