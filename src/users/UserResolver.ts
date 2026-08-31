import type { MembersApi } from '../api/MembersApi.js';

export class UserResolver {
  constructor(
    private readonly membersApi: MembersApi,
    private readonly emailDomain?: string
  ) {}

  // Accepts a user's email, an explicit user_id, or a full name.
  // Email → queries listEnterpriseMembers and returns the user_id.
  // A full name (e.g. "Ankush Agrawal", detected by whitespace) → converted to
  // "ankush.agrawal@<domain>" using USER_EMAIL_DOMAIN, then resolved like an email.
  // Anything else is treated as an explicit user_id and returned as-is (no network
  // call) — real ids come in more than one format (e.g. "user-…", "email|…"), so
  // there's no reliable prefix to match on.
  async resolveId(input: string): Promise<string> {
    const trimmed = input.trim();
    if (trimmed.includes('@')) return this.resolveByEmail(trimmed);
    if (/\s/.test(trimmed)) return this.resolveByEmail(this.toEmail(trimmed));
    return trimmed;
  }

  // Converts a full name to an email using USER_EMAIL_DOMAIN, without resolving it.
  toEmail(name: string): string {
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
