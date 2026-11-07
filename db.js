const { MongoClient } = require('mongodb');
const crypto = require('crypto');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ajeer_db';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'ajeer_db';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://muqhdaktjljnptruanox.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_n-xcjOpXTq7nmKZAdHjE5g_4jnKHRev';

let client = null;
let db = null;
let isConnecting = false;
let connectPromise = null;

async function connectDB() {
    if (db) return db;
    if (isConnecting && connectPromise) return connectPromise;

    isConnecting = true;
    connectPromise = (async () => {
        try {
            client = new MongoClient(MONGODB_URI, {
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 10000,
            });
            await client.connect();
            db = client.db(MONGODB_DB_NAME);
            console.log(`[MongoDB] Connected successfully to database: ${MONGODB_DB_NAME}`);

            await initIndexes();
            return db;
        } catch (err) {
            console.error('[MongoDB] Connection error:', err.message);
            throw err;
        } finally {
            isConnecting = false;
        }
    })();

    return connectPromise;
}

function getDB() {
    return db;
}

async function initIndexes() {
    if (!db) return;
    try {
        const contractsCol = db.collection('contracts');
        await contractsCol.createIndex({ id: 1 }, { unique: true });
        await contractsCol.createIndex({ contract_number: 1 });
        await contractsCol.createIndex({ created_at: -1 });

        const usersCol = db.collection('users');
        await usersCol.createIndex({ username: 1 }, { unique: true });

        console.log('[MongoDB] Indexes verified successfully.');
    } catch (err) {
        console.warn('[MongoDB] Index creation warning:', err.message);
    }
}

function pickField(c, camelKey, snakeKey, defaultVal = '') {
    if (c[camelKey] !== undefined && c[snakeKey] !== undefined) {
        if (c[camelKey] !== c[snakeKey]) {
            return c[camelKey];
        }
        return c[camelKey];
    }
    if (c[camelKey] !== undefined) return c[camelKey];
    if (c[snakeKey] !== undefined) return c[snakeKey];
    return defaultVal;
}

function normalizeContract(c) {
    if (!c) return null;

    // Strictly preserve original ID from Supabase (c.id) or MongoDB (c._id)
    const rawId = (c.id !== undefined && c.id !== null && String(c.id).trim() !== '')
        ? String(c.id).trim()
        : ((c._id !== undefined && c._id !== null && String(c._id).trim() !== '')
            ? String(c._id).trim()
            : crypto.randomUUID());
    const id = rawId;
    const contractType = pickField(c, 'contractType', 'contract_type', 'تعاقد أجير') || 'تعاقد أجير';
    const contractNumber = pickField(c, 'contractNumber', 'contract_number', '');
    const addNumber = pickField(c, 'addNumber', 'add_number', (contractNumber ? 'TW' + String(contractNumber).replace(/\D/g, '') : ''));

    const workerName = pickField(c, 'workerName', 'worker_name', '');
    const workerProfession = pickField(c, 'workerProfession', 'worker_profession', '');
    const workerIdNumber = pickField(c, 'workerIdNumber', 'worker_id_number', '');
    const workerNationality = pickField(c, 'workerNationality', 'worker_nationality', '');
    const birthDate = pickField(c, 'birthDate', 'birth_date', '');
    const permitType = pickField(c, 'permitType', 'permit_type', '');
    const providerEntity = pickField(c, 'providerEntity', 'provider_entity', '');
    const providerHrId = pickField(c, 'providerHrId', 'provider_hr_id', '');
    const beneficiaryEntity = pickField(c, 'beneficiaryEntity', 'beneficiary_entity', '');
    const beneficiaryHrId = pickField(c, 'beneficiaryHrId', 'beneficiary_hr_id', '');
    const contractSummary = pickField(c, 'contractSummary', 'contract_summary', '');
    const startDate = pickField(c, 'startDate', 'start_date', '');
    const endDate = pickField(c, 'endDate', 'end_date', '');
    const workLocations = pickField(c, 'workLocations', 'work_locations', '');

    const isBlocked = (() => {
        if (c.isBlocked !== undefined && c.is_blocked !== undefined) {
            if (c.isBlocked !== c.is_blocked) return !!c.isBlocked;
            return !!c.isBlocked;
        }
        if (c.isBlocked !== undefined) return !!c.isBlocked;
        if (c.is_blocked !== undefined) return !!c.is_blocked;
        if (endDate) {
            const end = new Date(endDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (end < today) return true;
        }
        return false;
    })();

    const blockedReason = (() => {
        if (c.blockedReason !== undefined && c.blocked_reason !== undefined) {
            if (c.blockedReason !== c.blocked_reason) return c.blockedReason;
            return c.blockedReason;
        }
        if (c.blockedReason !== undefined) return c.blockedReason;
        if (c.blocked_reason !== undefined) return c.blocked_reason;
        if (isBlocked && endDate) {
            const end = new Date(endDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (end < today) return 'انتهاء مدة العقد';
        }
        return null;
    })();

    return {
        _id: String(id),
        id: String(id),
        contract_type: contractType,
        contractType: contractType,
        contract_number: contractNumber,
        contractNumber: contractNumber,
        add_number: addNumber,
        addNumber: addNumber,
        worker_name: workerName,
        workerName: workerName,
        worker_profession: workerProfession,
        workerProfession: workerProfession,
        worker_id_number: workerIdNumber,
        workerIdNumber: workerIdNumber,
        worker_nationality: workerNationality,
        workerNationality: workerNationality,
        birth_date: birthDate,
        birthDate: birthDate,
        gender: c.gender || '',
        permit_type: permitType,
        permitType: permitType,
        provider_entity: providerEntity,
        providerEntity: providerEntity,
        provider_hr_id: providerHrId,
        providerHrId: providerHrId,
        beneficiary_entity: beneficiaryEntity,
        beneficiaryEntity: beneficiaryEntity,
        beneficiary_hr_id: beneficiaryHrId,
        beneficiaryHrId: beneficiaryHrId,
        contract_summary: contractSummary,
        contractSummary: contractSummary,
        start_date: startDate,
        startDate: startDate,
        end_date: endDate,
        endDate: endDate,
        work_locations: workLocations,
        workLocations: workLocations,
        is_blocked: isBlocked,
        isBlocked: isBlocked,
        blocked_reason: blockedReason,
        blockedReason: blockedReason,
        created_at: c.created_at || c.createdAt || new Date().toISOString(),
        createdAt: c.created_at || c.createdAt || new Date().toISOString()
    };
}

function generateDiverseDigits(length = 8) {
    const first = Math.floor(Math.random() * 8) + 2; // 2 to 9
    let digits = String(first);
    for (let i = 1; i < length; i++) {
        digits += Math.floor(Math.random() * 10);
    }
    return digits;
}

function isDummyZeroNumber(val) {
    if (!val) return true;
    const str = String(val).trim();
    const digits = str.replace(/\D/g, '');
    if (!digits || digits === '0000001' || digits === '1' || /^0{3,}\d+$/.test(digits) || digits.length < 6) {
        return true;
    }
    return false;
}

async function getNextContractNumber() {
    const database = await connectDB();
    const col = database.collection('contracts');

    for (let attempts = 0; attempts < 10; attempts++) {
        const candidate = 'TQ' + generateDiverseDigits(8);
        const exists = await col.findOne({
            $or: [{ contract_number: candidate }, { contractNumber: candidate }]
        });
        if (!exists) return candidate;
    }
    return 'TQ' + generateDiverseDigits(8);
}

async function listContracts() {
    const database = await connectDB();
    const docs = await database.collection('contracts')
        .find({})
        .sort({ created_at: -1, createdAt: -1 })
        .toArray();

    return docs.map(normalizeContract);
}

async function getContract(id) {
    if (!id) return null;
    const database = await connectDB();
    const doc = await database.collection('contracts').findOne({
        $or: [
            { id: String(id) },
            { _id: String(id) },
            { contract_number: String(id) },
            { contractNumber: String(id) }
        ]
    });

    return normalizeContract(doc);
}

async function saveContract(contract) {
    const database = await connectDB();
    const col = database.collection('contracts');

    let normalized = normalizeContract(contract);

    if (!normalized.id || normalized.id === 'undefined') {
        normalized.id = crypto.randomUUID();
        normalized._id = normalized.id;
    } else {
        normalized.id = String(normalized.id);
        normalized._id = normalized.id;
    }

    if (contract.newId && String(contract.newId) !== normalized.id) {
        await col.deleteOne({ $or: [{ id: normalized.id }, { _id: normalized.id }] });
        normalized.id = String(contract.newId);
        normalized._id = normalized.id;
    }

    if (!normalized.contract_number || isDummyZeroNumber(normalized.contract_number)) {
        normalized.contract_number = await getNextContractNumber();
        normalized.contractNumber = normalized.contract_number;
    }

    if (!normalized.add_number || isDummyZeroNumber(normalized.add_number)) {
        const digits = normalized.contract_number.replace(/\D/g, '');
        normalized.add_number = 'TW' + digits;
        normalized.addNumber = normalized.add_number;
    }

    await col.updateOne(
        { $or: [{ id: normalized.id }, { _id: normalized.id }] },
        { $set: normalized },
        { upsert: true }
    );

    return normalized;
}

async function deleteContract(id) {
    if (!id) return false;
    const database = await connectDB();
    const res = await database.collection('contracts').deleteOne({
        $or: [
            { id: String(id) },
            { _id: String(id) },
            { contract_number: String(id) }
        ]
    });
    return res.deletedCount > 0;
}

async function checkContractNumberExists(num) {
    if (!num) return false;
    const database = await connectDB();
    const found = await database.collection('contracts').findOne({
        $or: [{ contract_number: String(num) }, { contractNumber: String(num) }]
    });
    return !!found;
}

async function checkContractIdExists(id) {
    if (!id) return false;
    const database = await connectDB();
    const found = await database.collection('contracts').findOne({
        $or: [{ id: String(id) }, { _id: String(id) }]
    }, { projection: { _id: 1, id: 1 } });
    return !!found;
}

async function bulkInsertContracts(records) {
    if (!Array.isArray(records) || records.length === 0) return { inserted: 0, skipped: 0 };
    const database = await connectDB();
    const col = database.collection('contracts');

    const operations = [];
    for (const item of records) {
        const norm = normalizeContract(item);
        if (norm && norm.id) {
            if (item.id) {
                norm._id = String(item.id).trim();
                norm.id = String(item.id).trim();
            }
            operations.push({
                updateOne: {
                    filter: { _id: norm._id },
                    update: { $set: norm },
                    upsert: true
                }
            });
        }
    }

    if (operations.length === 0) return { inserted: 0, skipped: 0 };

    const result = await col.bulkWrite(operations, { ordered: false });
    const inserted = (result.upsertedCount || 0) + (result.modifiedCount || 0);
    return { inserted, skipped: records.length - inserted, total: records.length };
}

async function seedDefaultUsers() {
    const database = await connectDB();
    const usersCol = database.collection('users');

    const count = await usersCol.countDocuments();
    if (count === 0) {
        const defaultUsers = [
            {
                id: crypto.randomUUID(),
                username: process.env.ADMIN_USERNAME || 'admin',
                password: process.env.ADMIN_PASSWORD || 'admin',
                full_name: 'مدير النظام',
                email: 'admin@system.local',
                created_at: new Date().toISOString()
            },
            {
                id: crypto.randomUUID(),
                username: 'ajeer',
                password: 'ajeer2025',
                full_name: 'مشرف نظام أجير',
                email: 'ajeer@system.local',
                created_at: new Date().toISOString()
            }
        ];

        for (const u of defaultUsers) {
            await usersCol.updateOne(
                { username: u.username },
                { $setOnInsert: u },
                { upsert: true }
            );
        }
        console.log('[MongoDB] Default users seeded into users collection.');
    }
}

async function authenticateUser(username, password) {
    if (!username || !password) return null;
    const database = await connectDB();
    const usersCol = database.collection('users');

    // 1. Try MongoDB users collection
    const dbUser = await usersCol.findOne({
        username: String(username).trim(),
        password: String(password)
    });

    if (dbUser) {
        return {
            id: dbUser.id || String(dbUser._id),
            username: dbUser.username,
            full_name: dbUser.full_name || dbUser.username,
            email: dbUser.email || `${dbUser.username}@system.local`
        };
    }

    // 2. Fallback to Supabase Auth if provided in environment (and auto-migrate authenticated user to MongoDB)
    const fetchFn = typeof fetch !== 'undefined' ? fetch : globalThis.fetch;
    if (fetchFn && SUPABASE_URL && SUPABASE_ANON_KEY) {
        try {
            const loginEmail = username.includes('@') ? username : `${username}@system.local`;
            const res = await fetchFn(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: loginEmail, password })
            });

            if (res.ok) {
                const data = await res.json();
                if (data && data.user) {
                    const u = {
                        id: data.user.id || crypto.randomUUID(),
                        username: username.includes('@') ? username.split('@')[0] : username,
                        full_name: (data.user.user_metadata && data.user.user_metadata.full_name) || (username.includes('@') ? username.split('@')[0] : username),
                        email: data.user.email || loginEmail,
                        password: String(password),
                        created_at: new Date().toISOString()
                    };
                    // Save to MongoDB for future logins
                    await usersCol.updateOne(
                        { username: u.username },
                        { $set: u },
                        { upsert: true }
                    );
                    return {
                        id: u.id,
                        username: u.username,
                        full_name: u.full_name,
                        email: u.email
                    };
                }
            }
        } catch (authErr) {
            // Ignore fallback failure
        }
    }

    return null;
}

async function migrateFromSupabaseIfNeeded(options = {}) {
    const database = await connectDB();
    const migrationsCol = database.collection('_migrations');
    const contractsCol = database.collection('contracts');

    const migrationRecord = await migrationsCol.findOne({ name: 'supabase_initial_migration' });
    const existingCount = await contractsCol.countDocuments();

    if (!options.force && migrationRecord && existingCount > 0) {
        console.log(`[Migration] Supabase migration already completed previously (${existingCount} contracts in MongoDB).`);
        return { alreadyCompleted: true, count: existingCount };
    }

    console.log('[Migration] Starting data migration from Supabase to MongoDB with ID preservation...');

    const fetchFn = typeof fetch !== 'undefined' ? fetch : globalThis.fetch;
    if (!fetchFn) {
        throw new Error('fetch is not available in environment');
    }

    let allContracts = [];
    let from = 0;
    const batchSize = 1000;

    try {
        while (true) {
            const to = from + batchSize - 1;
            console.log(`[Migration] Fetching contracts range ${from}-${to} from Supabase...`);
            const res = await fetchFn(`${SUPABASE_URL}/rest/v1/contracts?select=*`, {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Range': `${from}-${to}`
                }
            });

            if (!res.ok) {
                const errText = await res.text();
                console.error(`[Migration] Error fetching contracts from Supabase (${res.status}):`, errText);
                break;
            }

            const data = await res.json();
            if (!Array.isArray(data) || data.length === 0) {
                break;
            }

            allContracts = allContracts.concat(data);
            console.log(`[Migration] Fetched ${data.length} records. Cumulative total: ${allContracts.length}`);

            if (data.length < batchSize) {
                break;
            }
            from += batchSize;
        }

        console.log(`[Migration] Total contracts fetched from Supabase: ${allContracts.length}`);

        if (allContracts.length > 0) {
            const operations = allContracts.map(c => {
                const norm = normalizeContract(c);
                // GUARANTEE: Never overwrite or change the original Supabase UUID
                if (c.id) {
                    norm._id = String(c.id).trim();
                    norm.id = String(c.id).trim();
                }
                return {
                    updateOne: {
                        filter: { _id: norm._id },
                        update: { $set: norm },
                        upsert: true
                    }
                };
            });

            // Write in batches of 500
            const chunkSize = 500;
            for (let i = 0; i < operations.length; i += chunkSize) {
                const chunk = operations.slice(i, i + chunkSize);
                await contractsCol.bulkWrite(chunk, { ordered: false });
                console.log(`[Migration] Inserted chunk ${i + 1} to ${Math.min(i + chunkSize, operations.length)} into MongoDB.`);
            }
        }

        // Migrate any users if public.users exists
        try {
            const usersRes = await fetchFn(`${SUPABASE_URL}/rest/v1/users?select=*`, {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
            });
            if (usersRes.ok) {
                const usersData = await usersRes.json();
                if (Array.isArray(usersData) && usersData.length > 0) {
                    const usersCol = database.collection('users');
                    for (const u of usersData) {
                        await usersCol.updateOne(
                            { username: u.username },
                            { $set: u },
                            { upsert: true }
                        );
                    }
                    console.log(`[Migration] Migrated ${usersData.length} users from Supabase.`);
                }
            }
        } catch (uErr) {
            // users table may not exist
        }

        await seedDefaultUsers();

        const totalMigrated = await contractsCol.countDocuments();
        await migrationsCol.updateOne(
            { name: 'supabase_initial_migration' },
            {
                $set: {
                    name: 'supabase_initial_migration',
                    completedAt: new Date().toISOString(),
                    contractsCount: totalMigrated
                }
            },
            { upsert: true }
        );

        console.log(`[Migration] Migration successfully finished! Total contracts in MongoDB: ${totalMigrated}`);
        return { success: true, count: totalMigrated };
    } catch (err) {
        console.error('[Migration] Failed during migration:', err);
        throw err;
    }
}

async function closeDB() {
    if (client) {
        await client.close();
        client = null;
        db = null;
        console.log('[MongoDB] Connection closed.');
    }
}

module.exports = {
    connectDB,
    getDB,
    closeDB,
    initIndexes,
    normalizeContract,
    listContracts,
    getContract,
    saveContract,
    deleteContract,
    getNextContractNumber,
    checkContractNumberExists,
    checkContractIdExists,
    bulkInsertContracts,
    authenticateUser,
    seedDefaultUsers,
    migrateFromSupabaseIfNeeded
};
