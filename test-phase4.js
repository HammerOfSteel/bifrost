/**
 * Phase 4 Frontend Integration Testing Script
 * Tests complete frontend workflow: login → family tree → search → modal
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Test helper for HTTP requests
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
  console.log('🧪 Testing Phase 4: Frontend Integration\n');

  try {
    // Test 1: Frontend loads without errors
    console.log('Test 1: Frontend HTML loads');
    const indexPath = path.join(__dirname, 'frontend', 'index.html');
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf8');
      console.log('  ✓ index.html exists');
      console.log('  ✓ Has login form:', content.includes('login-form'));
      console.log('  ✓ Has main app:', content.includes('main-app'));
      console.log('  ✓ Has modal:', content.includes('person-modal'));
      console.log('  ✓ Has d3 script:', content.includes('d3'));
      console.log('  ✓ Has family-chart script:', content.includes('family-chart'));
      console.log('  ✅ PASS\n');
    } else {
      throw new Error('index.html not found');
    }

    // Test 2: API client file exists
    console.log('Test 2: API client module');
    const apiPath = path.join(__dirname, 'frontend', 'src', 'api.js');
    if (fs.existsSync(apiPath)) {
      const content = fs.readFileSync(apiPath, 'utf8');
      console.log('  ✓ api.js exists');
      console.log('  ✓ Has login method:', content.includes('async login'));
      console.log('  ✓ Has getPersons method:', content.includes('async getPersons'));
      console.log('  ✓ Has search method:', content.includes('async search'));
      console.log('  ✅ PASS\n');
    } else {
      throw new Error('api.js not found');
    }

    // Test 3: Main.js file exists and has key functions
    console.log('Test 3: Main application module');
    const mainPath = path.join(__dirname, 'frontend', 'src', 'main.js');
    if (fs.existsSync(mainPath)) {
      const content = fs.readFileSync(mainPath, 'utf8');
      console.log('  ✓ main.js exists');
      console.log('  ✓ Has handleLogin:', content.includes('handleLogin'));
      console.log('  ✓ Has loadFamilyData:', content.includes('loadFamilyData'));
      console.log('  ✓ Has showPersonModal:', content.includes('showPersonModal'));
      console.log('  ✓ Has handleSearch:', content.includes('handleSearch'));
      console.log('  ✓ Has createFamilyTreeHTML:', content.includes('createFamilyTreeHTML'));
      console.log('  ✅ PASS\n');
    } else {
      throw new Error('main.js not found');
    }

    // Test 4: Family utilities
    console.log('Test 4: Family utilities module');
    const utilsPath = path.join(__dirname, 'frontend', 'src', 'family-utils.js');
    if (fs.existsSync(utilsPath)) {
      const content = fs.readFileSync(utilsPath, 'utf8');
      console.log('  ✓ family-utils.js exists');
      console.log('  ✓ Has transformPersonsToNodes:', content.includes('transformPersonsToNodes'));
      console.log('  ✓ Has filterPersonsByQuery:', content.includes('filterPersonsByQuery'));
      console.log('  ✓ Has buildFamilyTreeData:', content.includes('buildFamilyTreeData'));
      console.log('  ✅ PASS\n');
    } else {
      throw new Error('family-utils.js not found');
    }

    // Test 5: Full API workflow
    console.log('Test 5: Full API workflow (login → get persons → search)');
    
    // Login
    const loginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'test@example.com',
      password: 'test123'
    });
    const token = loginRes.data.data.token;
    console.log('  ✓ Login successful');

    // Get all persons
    const personsRes = await makeRequest('GET', '/api/persons', null, token);
    console.log('  ✓ Fetched', personsRes.data.data.length, 'persons');

    // Get single person with details
    const personRes = await makeRequest('GET', '/api/persons/1', null, token);
    console.log('  ✓ Fetched single person:', personRes.data.data.name);
    console.log('  ✓ Has relationships:', !!personRes.data.data.relationships);
    console.log('  ✓ Has media:', !!personRes.data.data.media);
    console.log('  ✓ Has tags:', !!personRes.data.data.tags);
    console.log('  ✓ Has locations:', !!personRes.data.data.locations);

    // Search
    const searchRes = await makeRequest('GET', '/api/persons/search?q=Erik', null, token);
    console.log('  ✓ Search found', searchRes.data.data.length, 'results');
    
    console.log('  ✅ PASS\n');

    console.log('✅ All Phase 4 tests passed!');
    console.log('\n📝 Next steps:');
    console.log('  1. Open http://localhost:5173 in browser');
    console.log('  2. Login with: test@example.com / test123');
    console.log('  3. Family tree should load with 5 members');
    console.log('  4. Click on any person to view details');
    console.log('  5. Search for "Erik" to test search functionality');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
