import { buildContainer } from './src/container.js';

interface UserAcuInfo {
  userId: string;
  name: string;
  email: string;
  acuLimit: number;
  org: string;
}

async function getHighAcuUsers() {
  const { membershipService, acuLimitService, orgRegistry } = buildContainer();
  
  // Get all organizations
  const allOrgs = await orgRegistry.get();
  
  // Filter organizations starting with "ServiceNow-DT-"
  const targetOrgs = allOrgs.filter(org => org.name.startsWith('ServiceNow-DT-'));
  
  console.log(`Found ${targetOrgs.length} organizations starting with "ServiceNow-DT-":`);
  targetOrgs.forEach(org => console.log(`  - ${org.name} (${org.org_id})`));
  
  const results: Record<string, UserAcuInfo[]> = {};
  
  // Process each organization
  for (const org of targetOrgs) {
    console.log(`\nProcessing ${org.name}...`);
    
    try {
      // Get all users in the organization
      const users = await membershipService.listOrgUsers(org.org_id);
      console.log(`  Found ${users.length} users`);
      
      const orgUsers: UserAcuInfo[] = [];
      
      // Get ACU limit for each user
      for (const user of users) {
        try {
          const acuData = await acuLimitService.getUser(user.user_id);
          const acuLimit = acuData.local_agent?.cycle_acu_limit || 0;
          
          // Only include users with ACU limit > 40
          if (acuLimit > 40) {
            orgUsers.push({
              userId: user.user_id,
              name: user.name || 'Unknown',
              email: user.email || 'No email',
              acuLimit,
              org: org.name
            });
            console.log(`  ✓ ${user.email}: ${acuLimit} ACUs`);
          }
        } catch (error) {
          console.log(`  ✗ ${user.email}: Error - ${(error as Error).message}`);
        }
      }
      
      // Sort by ACU limit (highest first)
      orgUsers.sort((a, b) => b.acuLimit - a.acuLimit);
      
      // Keep top 10
      results[org.name] = orgUsers.slice(0, 10);
      
      console.log(`  Found ${orgUsers.length} users with >40 ACUs`);
    } catch (error) {
      console.error(`  Error processing ${org.name}: ${(error as Error).message}`);
    }
  }
  
  // Generate report
  console.log('\n========================================');
  console.log('HIGH ACU USERS REPORT');
  console.log('========================================\n');
  
  let totalUsers = 0;
  
  for (const [orgName, users] of Object.entries(results)) {
    if (users.length === 0) {
      console.log(`\n${orgName}:`);
      console.log('  No users with >40 ACUs found');
      continue;
    }
    
    console.log(`\n${orgName}:`);
    console.log('Rank | Name                    | Email                           | ACU Limit');
    console.log('-----|-------------------------|----------------------------------|----------');
    
    users.forEach((user, index) => {
      const rank = index + 1;
      const name = user.name.substring(0, 23).padEnd(23);
      const email = user.email.substring(0, 32).padEnd(32);
      console.log(`${rank.toString().padStart(4)} | ${name} | ${email} | ${user.acuLimit}`);
    });
    
    totalUsers += users.length;
  }
  
  console.log('\n========================================');
  console.log(`Total users with >40 ACUs across all ServiceNow-DT- orgs: ${totalUsers}`);
  console.log('========================================\n');
}

getHighAcuUsers().catch(console.error);
