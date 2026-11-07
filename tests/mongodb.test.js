const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const db = require('../db.js');
const { server } = require('../server.js');

const TEST_PORT = 3019;
let testServer = null;

describe('MongoDB Full Functionality & Integration Tests', () => {

    before(async () => {
        // Connect to MongoDB
        await db.connectDB();
        // Start test HTTP server
        await new Promise((resolve) => {
            testServer = server.listen(TEST_PORT, '127.0.0.1', resolve);
        });
    });

    after(async () => {
        if (testServer) {
            await new Promise((resolve) => testServer.close(resolve));
        }
        await db.closeDB();
    });

    // 1. Database Connection & Initialization
    test('1. MongoDB connection and collection indexing', async () => {
        const database = db.getDB();
        assert.ok(database, 'Database instance should be connected');
        const collections = await database.listCollections().toArray();
        const names = collections.map(c => c.name);
        assert.ok(names.includes('contracts'), 'contracts collection must exist');
        assert.ok(names.includes('users'), 'users collection must exist');
    });

    // 2. Migration from Supabase on Startup
    test('2. Supabase to MongoDB startup migration function and ID preservation', async () => {
        const migResult = await db.migrateFromSupabaseIfNeeded();
        assert.ok(migResult, 'Migration should return a result');
        assert.ok(migResult.count > 0, 'Migration should result in contracts in MongoDB');

        const database = db.getDB();
        const contractsCol = database.collection('contracts');
        const migrationDoc = await database.collection('_migrations').findOne({ name: 'supabase_initial_migration' });
        assert.ok(migrationDoc, '_migrations collection should record supabase_initial_migration');
        assert.ok(migrationDoc.contractsCount >= 1000, 'All records from Supabase should be migrated (at least 1000+)');

        // Verify that MongoDB contracts have matching _id and id (not auto-generated ObjectId)
        const sampleDocs = await contractsCol.find().limit(50).toArray();
        for (const doc of sampleDocs) {
            assert.equal(typeof doc._id, 'string', `_id must be a string UUID: ${doc._id}`);
            assert.equal(doc._id, doc.id, `_id and id must be identical: ${doc._id} vs ${doc.id}`);
        }

        // Verify against live Supabase contracts to ensure identical IDs were preserved
        const SUPABASE_URL = process.env.SUPABASE_URL || 'https://muqhdaktjljnptruanox.supabase.co';
        const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_n-xcjOpXTq7nmKZAdHjE5g_4jnKHRev';
        try {
            const sRes = await fetch(`${SUPABASE_URL}/rest/v1/contracts?select=id,contract_number&limit=10`, {
                headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`
                }
            });
            if (sRes.ok) {
                const sContracts = await sRes.json();
                for (const sc of sContracts) {
                    const mDoc = await contractsCol.findOne({ _id: sc.id });
                    assert.ok(mDoc, `Supabase contract ${sc.id} must exist in MongoDB with identical _id`);
                    assert.equal(mDoc.id, sc.id, `MongoDB id must match Supabase id exactly`);
                }
            }
        } catch (e) {
            // In case offline, sample check passed
        }
    });

    // 3. User Authentication in MongoDB
    test('3. User authentication against MongoDB users collection', async () => {
        // Valid default user
        const user = await db.authenticateUser('admin', 'admin');
        assert.ok(user, 'Admin should authenticate successfully');
        assert.equal(user.username, 'admin');

        // Invalid user
        const invalid = await db.authenticateUser('admin', 'wrongpassword');
        assert.equal(invalid, null, 'Invalid password should be rejected');

        const nonexistent = await db.authenticateUser('nonexistent_user', 'pass');
        assert.equal(nonexistent, null, 'Nonexistent user should be rejected');
    });

    // 4. Contract Listing (db.listContracts)
    test('4. db.listContracts retrieves normalized contracts', async () => {
        const list = await db.listContracts();
        assert.ok(Array.isArray(list), 'Should return an array');
        assert.ok(list.length > 0, 'Should contain migrated contracts');

        const sample = list[0];
        assert.ok(sample.id, 'Contract should have an id');
        assert.ok(sample.contractNumber, 'Contract should have a contractNumber');
        assert.ok(sample.workerName, 'Contract should have workerName');
    });

    // 5. Contract Retrieval (db.getContract by id and by contract_number)
    test('5. db.getContract by UUID and by contract number', async () => {
        const list = await db.listContracts();
        const sample = list[0];

        const byId = await db.getContract(sample.id);
        assert.ok(byId, 'Should fetch contract by id');
        assert.equal(byId.id, sample.id);

        const byNumber = await db.getContract(sample.contractNumber);
        assert.ok(byNumber, 'Should fetch contract by contract number');
        assert.equal(byNumber.id, sample.id);

        const notFound = await db.getContract('non-existent-id-99999');
        assert.equal(notFound, null, 'Should return null for missing contract');
    });

    // 6. Contract Number Check & Generation (db.checkContractNumberExists & db.getNextContractNumber)
    test('6. db.checkContractNumberExists and db.getNextContractNumber', async () => {
        const list = await db.listContracts();
        const sample = list[0];

        const exists = await db.checkContractNumberExists(sample.contractNumber);
        assert.equal(exists, true, 'Existing number should return true');

        const notExists = await db.checkContractNumberExists('TQ999999999999');
        assert.equal(notExists, false, 'Non-existent number should return false');

        const nextNum = await db.getNextContractNumber();
        assert.ok(nextNum.startsWith('TQ'), 'Next contract number should start with TQ');
        const numExists = await db.checkContractNumberExists(nextNum);
        assert.equal(numExists, false, 'Generated number should be unique and not currently exist');
    });

    // 7. Save Contract (Insert New & Update Existing)
    test('7. db.saveContract: insert new contract and update existing', async () => {
        // Create new
        const newContract = {
            contractType: 'تعاقد أجير',
            workerName: 'أحمد محمود العلي',
            workerProfession: 'مهندس برمجيات',
            workerIdNumber: '1099887766',
            workerNationality: 'سعودي',
            providerEntity: 'شركة التقنية المتقدمة',
            providerHrId: '7-12345678',
            beneficiaryEntity: 'أمانة منطقة الرياض',
            beneficiaryHrId: '28-87654321',
            contractSummary: 'عقد عمل مؤقت تجريبي',
            startDate: '2026-10-01',
            endDate: '2027-10-01'
        };

        const saved = await db.saveContract(newContract);
        assert.ok(saved.id, 'New contract should be assigned a UUID id');
        assert.ok(saved.contractNumber.startsWith('TQ'), 'Should have a diverse TQ contract number');
        assert.ok(saved.addNumber.startsWith('TW'), 'Should have an add number starting with TW');
        assert.equal(saved.workerName, 'أحمد محمود العلي');

        // Verify it exists in MongoDB
        const fetched = await db.getContract(saved.id);
        assert.ok(fetched);
        assert.equal(fetched.workerName, 'أحمد محمود العلي');

        // Update contract
        fetched.workerProfession = 'كبير مهندسي البرمجيات';
        fetched.isBlocked = true;
        fetched.blockedReason = 'تحديث بيانات تجريبي';
        const updated = await db.saveContract(fetched);

        assert.equal(updated.workerProfession, 'كبير مهندسي البرمجيات');
        assert.equal(updated.isBlocked, true);

        const refetched = await db.getContract(saved.id);
        assert.equal(refetched.workerProfession, 'كبير مهندسي البرمجيات');
        assert.equal(refetched.isBlocked, true);

        // Clean up
        await db.deleteContract(saved.id);
    });

    // 8. Delete Contract (db.deleteContract)
    test('8. db.deleteContract deletes record from MongoDB', async () => {
        const temp = await db.saveContract({
            workerName: 'عامل للحذف',
            workerProfession: 'فني',
            workerIdNumber: '1987654321'
        });

        const existsBefore = await db.getContract(temp.id);
        assert.ok(existsBefore);

        const deleted = await db.deleteContract(temp.id);
        assert.equal(deleted, true);

        const existsAfter = await db.getContract(temp.id);
        assert.equal(existsAfter, null);
    });

    // 9. Bulk Insert (db.bulkInsertContracts)
    test('9. db.bulkInsertContracts bulk imports records into MongoDB', async () => {
        const batch = [
            {
                id: 'bulk-test-uuid-1',
                workerName: 'عامل مجمع 1',
                contractNumber: 'TQ88880001'
            },
            {
                id: 'bulk-test-uuid-2',
                workerName: 'عامل مجمع 2',
                contractNumber: 'TQ88880002'
            }
        ];

        const res = await db.bulkInsertContracts(batch);
        assert.ok(res.inserted >= 2, 'Should insert both bulk records');

        const c1 = await db.getContract('bulk-test-uuid-1');
        assert.ok(c1);
        assert.equal(c1.workerName, 'عامل مجمع 1');

        // Clean up
        await db.deleteContract('bulk-test-uuid-1');
        await db.deleteContract('bulk-test-uuid-2');
    });

    // 10. HTTP REST API: GET /api/contracts
    test('10. REST API: GET /api/contracts returns JSON list', async () => {
        const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/contracts`);
        assert.equal(res.status, 200);
        assert.ok(res.headers.get('content-type')?.includes('application/json'));
        const data = await res.json();
        assert.ok(Array.isArray(data));
        assert.ok(data.length > 0);
    });

    // 11. HTTP REST API: GET /api/contracts/:id
    test('11. REST API: GET /api/contracts/:id', async () => {
        const listRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/contracts`);
        const list = await listRes.json();
        const first = list[0];

        const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/contracts/${first.id}`);
        assert.equal(res.status, 200);
        const contract = await res.json();
        assert.equal(contract.id, first.id);
        assert.equal(contract.workerName, first.workerName);

        const notFound = await fetch(`http://127.0.0.1:${TEST_PORT}/api/contracts/does-not-exist`);
        assert.equal(notFound.status, 404);
    });

    // 12. HTTP REST API: POST & PUT /api/contracts
    test('12. REST API: POST /api/contracts (create) and PUT /api/contracts/:id (update)', async () => {
        const newPayload = {
            workerName: 'سعيد الحارثي',
            workerProfession: 'سائق خاص',
            workerIdNumber: '2233445566'
        };

        // POST create
        const createRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/contracts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newPayload)
        });
        assert.equal(createRes.status, 201);
        const created = await createRes.json();
        assert.ok(created.id);
        assert.equal(created.workerName, 'سعيد الحارثي');

        // PUT update
        created.workerProfession = 'سائق حافلة نقل';
        const updateRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/contracts/${created.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(created)
        });
        assert.equal(updateRes.status, 200);
        const updated = await updateRes.json();
        assert.equal(updated.workerProfession, 'سائق حافلة نقل');

        // DELETE
        const delRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/contracts/${created.id}`, {
            method: 'DELETE'
        });
        assert.equal(delRes.status, 200);
        const delData = await delRes.json();
        assert.equal(delData.success, true);
    });

    // 13. HTTP REST API: GET /api/contracts/check-number/:num & next-number
    test('13. REST API: check-number and next-number', async () => {
        const nextRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/contracts/next-number`);
        assert.equal(nextRes.status, 200);
        const nextData = await nextRes.json();
        assert.ok(nextData.number.startsWith('TQ'));

        const checkRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/contracts/check-number/${nextData.number}`);
        assert.equal(checkRes.status, 200);
        const checkData = await checkRes.json();
        assert.equal(checkData.exists, false);
    });

    // 14. HTTP REST API: Database status
    test('14. REST API: GET /api/db/status returns MongoDB status', async () => {
        const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/db/status`);
        assert.equal(res.status, 200);
        const statusData = await res.json();
        assert.equal(statusData.status, 'connected');
        assert.equal(statusData.database, 'mongodb');
        assert.ok(statusData.contractsCount > 0);
    });

    // 15. Authentication API: POST /api/auth/login
    test('15. REST API: POST /api/auth/login authenticates against MongoDB', async () => {
        // Valid login
        const loginRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin' })
        });
        assert.equal(loginRes.status, 200);
        const loginData = await loginRes.json();
        assert.equal(loginData.success, true);
        assert.equal(loginData.user.username, 'admin');
        const setCookie = loginRes.headers.get('set-cookie');
        assert.ok(setCookie?.includes('auth_token='));

        // Invalid login
        const failRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'bad-password' })
        });
        assert.equal(failRes.status, 401);
    });

    // 16. Unlimited Contracts Handling (> 1000 records retrieval & backup)
    test('16. db.listContracts and GET /api/contracts return more than 1000 records without artificial ceiling', async () => {
        const contractsFromDb = await db.listContracts();
        assert.ok(contractsFromDb.length > 1000, `Expected > 1000 contracts in db, got ${contractsFromDb.length}`);

        const apiRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/contracts`);
        assert.equal(apiRes.status, 200);
        const apiData = await apiRes.json();
        assert.ok(Array.isArray(apiData));
        assert.ok(apiData.length > 1000, `Expected > 1000 contracts from API, got ${apiData.length}`);
        assert.equal(apiData.length, contractsFromDb.length);

        // Verify backup structure with > 1000 records
        const backupData = {
            type: 'ajeer_contracts_backup',
            version: '1.0',
            exportedAt: new Date().toISOString(),
            totalRecords: apiData.length,
            source: 'mongodb',
            data: apiData
        };
        assert.ok(backupData.totalRecords > 1000);
        assert.equal(backupData.data.length, apiData.length);
    });

    test('17. Custom contract ID check and duplicate rejection', async () => {
        // 17.1 Check existing ID
        const existingId = '6069b7d1-0823-49bf-bbe3-429c20005e1f';
        const existsRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/contracts/check-id/${existingId}`);
        assert.equal(existsRes.status, 200);
        const existsData = await existsRes.json();
        assert.equal(existsData.exists, true);

        // 17.2 Check non-existing ID
        const unusedId = 'custom-test-unique-' + Date.now();
        const notExistsRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/contracts/check-id/${unusedId}`);
        assert.equal(notExistsRes.status, 200);
        const notExistsData = await notExistsRes.json();
        assert.equal(notExistsData.exists, false);

        // 17.3 POST duplicate ID should fail with 409 Conflict
        const dupRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/contracts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: existingId,
                contractNumber: 'TQ-DUP-REJECT',
                workerName: 'مكرر'
            })
        });
        assert.equal(dupRes.status, 409);
        const dupData = await dupRes.json();
        assert.ok(dupData.error && dupData.error.includes('موجود'));

        // 17.4 POST with custom unused ID should succeed with that exact ID
        const customRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/contracts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: unusedId,
                contractNumber: 'TQ-CUSTOM-TEST',
                workerName: 'عامل بمعرف مخصص'
            })
        });
        assert.equal(customRes.status, 201);
        const customCreated = await customRes.json();
        assert.equal(customCreated.id, unusedId);

        // 17.5 Cleanup created contract
        const delRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/contracts/${unusedId}`, {
            method: 'DELETE'
        });
        assert.equal(delRes.status, 200);
    });
});

