const { seedData } = require('./seedData.js');

// Run the seed data function
seedData().then(() => {
    console.log('Seed script completed');
    process.exit(0);
}).catch((error) => {
    console.error('Seed script failed:', error);
    process.exit(1);
});
