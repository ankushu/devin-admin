import { buildContainer } from './src/container.js';

interface UserConsumption {
  userId: string;
  name: string;
  email: string;
  totalAcus: number;
  org: string;
  byProduct: Record<string, number>;
}

async function getTopConsumers() {
  const { membershipService, monitoringService } = buildContainer();
  
  // Get users from both organizations
  const etgUsers = await membershipService.listOrgUsers('ServiceNow-DT-ETG');
  const aiUsers = await membershipService.listOrgUsers('ServiceNow-DT-AI');
  
  console.log('ServiceNow-DT-ETG: Found', etgUsers.length, 'users');
  console.log('ServiceNow-DT-AI: Found', aiUsers.length, 'users');
  
  // Get consumption for all users
  const period = { start: '2026-07-13', end: '2026-07-13' };
  
  const etgConsumption: UserConsumption[] = [];
  const aiConsumption: UserConsumption[] = [];
  
  // Process ETG users
  console.log('\nProcessing ServiceNow-DT-ETG users...');
  for (const user of etgUsers) {
    try {
      const result = await monitoringService.monitorUser(user.user_id, period);
      etgConsumption.push({
        userId: user.user_id,
        name: user.name,
        email: user.email,
        totalAcus: result.totalAcus,
        org: 'ServiceNow-DT-ETG',
        byProduct: result.byProduct
      });
      console.log(`  ${user.email}: ${result.totalAcus.toFixed(2)} ACUs`);
    } catch (error) {
      console.log(`  ${user.email}: Error - ${(error as Error).message}`);
    }
  }
  
  // Process AI users
  console.log('\nProcessing ServiceNow-DT-AI users...');
  for (const user of aiUsers) {
    try {
      const result = await monitoringService.monitorUser(user.user_id, period);
      aiConsumption.push({
        userId: user.user_id,
        name: user.name,
        email: user.email,
        totalAcus: result.totalAcus,
        org: 'ServiceNow-DT-AI',
        byProduct: result.byProduct
      });
      console.log(`  ${user.email}: ${result.totalAcus.toFixed(2)} ACUs`);
    } catch (error) {
      console.log(`  ${user.email}: Error - ${(error as Error).message}`);
    }
  }
  
  // Sort by consumption (highest first)
  etgConsumption.sort((a, b) => b.totalAcus - a.totalAcus);
  aiConsumption.sort((a, b) => b.totalAcus - a.totalAcus);
  
  // Combine both orgs and get top 3
  const allConsumption = [...etgConsumption, ...aiConsumption];
  allConsumption.sort((a, b) => b.totalAcus - a.totalAcus);
  const top3 = allConsumption.slice(0, 3);
  
  // Display top 3 with product distribution
  console.log('\n========================================');
  console.log('TOP 3 CONSUMERS (BOTH ORGS) WITH PRODUCT DISTRIBUTION');
  console.log('========================================\n');
  
  top3.forEach((user, index) => {
    console.log(`${index + 1}. ${user.name} (${user.email})`);
    console.log(`   Org: ${user.org}`);
    console.log(`   Total ACUs: ${user.totalAcus.toFixed(2)}`);
    console.log('   Product Distribution:');
    
    const productEntries = Object.entries(user.byProduct).filter(([_, v]) => v != null && v > 0);
    if (productEntries.length > 0) {
      productEntries.forEach(([product, acus]) => {
        const percentage = ((acus / user.totalAcus) * 100).toFixed(1);
        console.log(`     ${product}: ${acus.toFixed(2)} ACUs (${percentage}%)`);
      });
    } else {
      console.log('     No product breakdown available');
    }
    console.log('');
  });
  
  // Display top 10 for each org
  console.log('\n========================================');
  console.log('TOP CONSUMERS - ServiceNow-DT-ETG');
  console.log('========================================');
  console.log('Rank | Name                    | Email                           | ACU Usage');
  console.log('-----|-------------------------|----------------------------------|----------');
  etgConsumption.slice(0, 10).forEach((user, index) => {
    const rank = index + 1;
    const name = user.name.substring(0, 23).padEnd(23);
    const email = user.email.substring(0, 32).padEnd(32);
    console.log(`${rank.toString().padStart(4)} | ${name} | ${email} | ${user.totalAcus.toFixed(2)}`);
  });
  
  console.log('\n========================================');
  console.log('TOP CONSUMERS - ServiceNow-DT-AI');
  console.log('========================================');
  console.log('Rank | Name                    | Email                           | ACU Usage');
  console.log('-----|-------------------------|----------------------------------|----------');
  aiConsumption.slice(0, 10).forEach((user, index) => {
    const rank = index + 1;
    const name = user.name.substring(0, 23).padEnd(23);
    const email = user.email.substring(0, 32).padEnd(32);
    console.log(`${rank.toString().padStart(4)} | ${name} | ${email} | ${user.totalAcus.toFixed(2)}`);
  });
}

getTopConsumers().catch(console.error);