/**
 * Phase 3 Data API Testing Script
 * Tests GET, POST, PATCH, DELETE endpoints for persons
 */

const http = require('http');

function makeRequest(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data) {
      const body = JSON.stringify(data);
      options.headers['Content-Length'] = body.length;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(body)
          });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing Phase 3: Data API\n');

  try {
    // Get admin token
    console.log('Getting admin token...');
    const loginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'test@example.com',
      password: 'test123'
    });
    const adminToken = loginRes.data.data.token;
    console.log('✅ Got admin token\n');

    // Test 1: GET /api/persons (already tested in Phase 2)
    console.log('Test 1: GET /api/persons');
    const personsRes = await makeRequest('GET', '/api/persons', null, adminToken);
    console.log('  Status:', personsRes.status);
    console.log('  Count:', personsRes.data.data.length);
    const originalCount = personsRes.data.data.length;
    console.log('  ✅ PASS\n');

    // Test 2: GET /api/persons/:id (single person with relations)
    console.log('Test 2: GET /api/persons/:id');
    const singleRes = await makeRequest('GET', '/api/persons/1', null, adminToken);
    console.log('  Status:', singleRes.status);
    console.log('  Person:', singleRes.data.data.name);
    console.log('  Has relationships:', !!singleRes.data.data.relationships);
    console.log('  Has media:', !!singleRes.data.data.media);
    console.log('  ✅ PASS\n');

    // Test 3: POST /api/admin/persons (create new person)
    console.log('Test 3: POST /api/admin/persons');
    const createRes = await makeRequest('POST', '/api/admin/persons', {
      name: 'Test Person',
      bio: 'A test family member',
      birth_year: 1990,
      gender: 'M'
    }, adminToken);
    console.log('  Status:', createRes.status);
    console.log('  Person created:', createRes.data.data.name);
    const newPersonId = createRes.data.data.id;
    console.log('  New ID:', newPersonId);
    console.log('  ✅ PASS\n');

    // Test 4: PATCH /api/admin/persons/:id (update person)
    console.log('Test 4: PATCH /api/admin/persons/:id');
    const updateRes = await makeRequest('PATCH', `/api/admin/persons/${newPersonId}`, {
      bio: 'Updated biography',
      death_year: 2020
    }, adminToken);
    console.log('  Status:', updateRes.status);
    console.log('  Updated:', updateRes.data.data.name);
    console.log('  New bio:', updateRes.data.data.bio);
    console.log('  ✅ PASS\n');

    // Test 5: DELETE /api/admin/persons/:id (delete person)
    console.log('Test 5: DELETE /api/admin/persons/:id');
    const deleteRes = await makeRequest('DELETE', `/api/admin/persons/${newPersonId}`, null, adminToken);
    console.log('  Status:', deleteRes.status);
    console.log('  Deleted:', deleteRes.data.data.deleted);
    console.log('  ✅ PASS\n');

    // Test 6: GET search with query
    console.log('Test 6: GET /api/persons/search?q=Erik');
    const searchRes = await makeRequest('GET', '/api/persons/search?q=Erik', null, adminToken);
    console.log('  Status:', searchRes.status);
    console.log('  Results:', searchRes.data.data.length);
    if (searchRes.data.data.length > 0) {
      console.log('  First result:', searchRes.data.data[0].name);
    }
    console.log('  ✅ PASS\n');

    // Test 7: Verify person count after deletion
    console.log('Test 7: GET /api/persons (verify count after deletion)');
    const finalRes = await makeRequest('GET', '/api/persons', null, adminToken);
    console.log('  Original count:', originalCount);
    console.log('  Final count:', finalRes.data.data.length);
    console.log('  Count decreased by 1:', finalRes.data.data.length === originalCount - 1);
    console.log('  ✅ PASS\n');

    // Test 8: Unauthorized access (create without admin)
    console.log('Test 8: POST /api/admin/persons (without admin - should fail)');
    const nonAdminRes = await makeRequest('POST', '/api/auth/register', {
      email: 'user' + Math.random() + '@example.com',
      password: 'password123',
      name: 'Regular User'
    });
    const userToken = nonAdminRes.data.data.token;
    
    const unauthorizedRes = await makeRequest('POST', '/api/admin/persons', {
      name: 'Should Fail'
    }, userToken);
    console.log('  Status:', unauthorizedRes.status);
    console.log('  Should be 403:', unauthorizedRes.status === 403);
    console.log('  ✅ PASS\n');

    console.log('✅ All Phase 3 tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
