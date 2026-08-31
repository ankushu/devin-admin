import type { MembersApi } from '../api/MembersApi.js';

const USER_ID_PREFIX = /^user-/;

export class UserResolver {
  constructor(
    private readonly membersApi: MembersApi,
    private readonly emailDomain?: string
  ) {}

  // Accepts a user's email, an explicit user_id (user-…), or a full name.
  // Email → queries listEnterpriseMembers and returns the user_id.
  // user_id (user-…) → returned as-is (no network call).
  // Full name (e.g. "Ankush Agrawal") → converted to "ankush.agrawal@<domain>"
  // using USER_EMAIL_DOMAIN, then resolved the same way as an email.
  async resolveId(input: string): Promise<string> {
    const trimmed = input.trim();
    if (trimmed.includes('@')) return this.resolveByEmail(trimmed);
    if (USER_ID_PREFIX.test(trimmed)) return trimmed;
    return this.resolveByEmail(this.nameToEmail(trimmed));
  }

  private nameToEmail(name: string): string {
    if (!this.emailDomain) {
      throw new Error(
        `Cannot resolve "${name}" as a name — set USER_EMAIL_DOMAIN in .env (e.g. servicenow.com) ` +
          'to enable name-based lookup, or pass an email/user_id instead.'
      );
    }
    const local = name.toLowerCase().split(/\s+/).join('.');
    return `${local}@${this.emailDomain}`;
  }

  private async resolveByEmail(email: string): Promise<string> {
    const users = await this.membersApi.listEnterpriseMembers(email);
    if (users.length === 0) throw new Error(`No user found with email: ${email}`);
    return users[0].user_id;
  }
}
