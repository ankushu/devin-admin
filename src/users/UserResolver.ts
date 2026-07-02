import type { MembersApi } from '../api/MembersApi.js';

export class UserResolver {
  constructor(private readonly membersApi: MembersApi) {}

  // Accepts a user's email or an explicit user_id (no @ sign).
  // Email → queries listEnterpriseMembers and returns the user_id.
  // user_id → returned as-is (no network call).
  async resolveId(emailOrId: string): Promise<string> {
    if (!emailOrId.includes('@')) return emailOrId;

    const users = await this.membersApi.listEnterpriseMembers(emailOrId);
    if (users.length === 0) throw new Error(`No user found with email: ${emailOrId}`);
    return users[0].user_id;
  }
}
