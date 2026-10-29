import type { Membership } from '../../../workspace/index.js';

/** A membership with the member's name and email (API Design §7.1). */
export interface MemberView {
  membership: Membership;
  displayName: string;
  email: string;
}

export interface MemberPage {
  members: MemberView[];
  nextCursor: string | null;
}
