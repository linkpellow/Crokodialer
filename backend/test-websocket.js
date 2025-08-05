const jwt = require('jsonwebtoken');

// Generate a test JWT token
const payload = {
  email: 'test@example.com',
  userId: 'test-user-id'
};

const token = jwt.sign(payload, '7f41db3a78344878e86de1e7ed96e9d3d56f23a8449388ec1bffb70eaf6ce02e', { expiresIn: '1h' });

console.log('Test JWT Token:');
console.log(token);
console.log('\nWebSocket URL with token:');
console.log(`ws://localhost:3005/ws?token=${token}`); 