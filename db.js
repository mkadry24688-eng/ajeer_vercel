const crypto = require('crypto');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || '';

let connected = false;

function requireConfig() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        throw new Error('SUPABASE_URL and a Supabase API key are required');
    }
}

function apiHeaders(prefer = '') {
    const headers = {
        apikey: SUPABASE_KEY,
        Accept: 'application/json',
        'Content-Type': 'application/json'
    };
    if (!SUPABASE_KEY.startsWith('sb_')) {
        headers.Authorization = `Bearer ${SUPABASE_KEY}`;
    }
    if (prefer) headers.Prefer = prefer;
    return headers;
}

async function supabaseRequest(table, options = {}) {
    requireConfig();
    const query = options.query ? `?${options.query}` : '';
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
        method: options.method || 'GET',
        headers: apiHeaders(options.prefer || ''),
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });

    const text = await response.text();
    let payload = null;
    if (text) {
        try {
            payload = JSON.parse(text);
        } catch {
            payload = text;
        }
    }

    if (!response.ok) {
        const detail = payload && typeof payload === 'object'
            ? payload.message || payload.details || payload.hint || JSON.stringify(payload)
            : String(payload || response.statusText);
        throw new Error(`Supabase ${response.status}: ${detail}`);
    }
    return payload;
}

function pickField(contract, camelKey, snakeKey, defaultValue = '') {
    if (contract[camelKey] !== undefined) return contract[camelKey];
    if (contract[snakeKey] !== undefined) return contract[snakeKey];
    return defaultValue;
}

function normalizeContract(contract) {
    if (!contract) return null;

    const id = String(contract.id || contract._id || crypto.randomUUID()).trim();
    const contractNumber = pickField(contract, 'contractNumber', 'contract_number', '');
    const addNumber = pickField(
        contract,
        'addNumber',
        'add_number',
        contractNumber ? `TW${String(contractNumber).replace(/\D/g, '')}` : ''
    );
    const endDate = pickField(contract, 'endDate', 'end_date', '');

    let isBlocked = Boolean(pickField(contract, 'isBlocked', 'is_blocked', false));
    if (!isBlocked && endDate) {
        const end = new Date(endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (!Number.isNaN(end.getTime()) && end < today) isBlocked = true;
    }

    let blockedReason = pickField(contract, 'blockedReason', 'blocked_reason', null);
    if (!blockedReason && isBlocked && endDate) {
        const end = new Date(endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (!Number.isNaN(end.getTime()) && end < today) blockedReason = 'انتهاء مدة العقد';
    }

    return {
        _id: id,
        id,
        contract_type: pickField(contract, 'contractType', 'contract_type', 'تعاقد أجير'),
        contractType: pickField(contract, 'contractType', 'contract_type', 'تعاقد أجير'),
        contract_number: contractNumber,
        contractNumber,
        add_number: addNumber,
        addNumber,
        worker_name: pickField(contract, 'workerName', 'worker_name', ''),
        workerName: pickField(contract, 'workerName', 'worker_name', ''),
        worker_profession: pickField(contract, 'workerProfession', 'worker_profession', ''),
        workerProfession: pickField(contract, 'workerProfession', 'worker_profession', ''),
        worker_id_number: pickField(contract, 'workerIdNumber', 'worker_id_number', ''),
        workerIdNumber: pickField(contract, 'workerIdNumber', 'worker_id_number', ''),
        worker_nationality: pickField(contract, 'workerNationality', 'worker_nationality', ''),
        workerNationality: pickField(contract, 'workerNationality', 'worker_nationality', ''),
        birth_date: pickField(contract, 'birthDate', 'birth_date', ''),
        birthDate: pickField(contract, 'birthDate', 'birth_date', ''),
        gender: contract.gender || '',
        permit_type: pickField(contract, 'permitType', 'permit_type', ''),
        permitType: pickField(contract, 'permitType', 'permit_type', ''),
        provider_entity: pickField(contract, 'providerEntity', 'provider_entity', ''),
        providerEntity: pickField(contract, 'providerEntity', 'provider_entity', ''),
        provider_hr_id: pickField(contract, 'providerHrId', 'provider_hr_id', ''),
        providerHrId: pickField(contract, 'providerHrId', 'provider_hr_id', ''),
        beneficiary_entity: pickField(contract, 'beneficiaryEntity', 'beneficiary_entity', ''),
        beneficiaryEntity: pickField(contract, 'beneficiaryEntity', 'beneficiary_entity', ''),
        beneficiary_hr_id: pickField(contract, 'beneficiaryHrId', 'beneficiary_hr_id', ''),
        beneficiaryHrId: pickField(contract, 'beneficiaryHrId', 'beneficiary_hr_id', ''),
        contract_summary: pickField(contract, 'contractSummary', 'contract_summary', ''),
        contractSummary: pickField(contract, 'contractSummary', 'contract_summary', ''),
        start_date: pickField(contract, 'startDate', 'start_date', ''),
        startDate: pickField(contract, 'startDate', 'start_date', ''),
        end_date: endDate,
        endDate,
        work_locations: pickField(contract, 'workLocations', 'work_locations', ''),
        workLocations: pickField(contract, 'workLocations', 'work_locations', ''),
        is_blocked: isBlocked,
        isBlocked,
        blocked_reason: blockedReason,
        blockedReason,
        created_at: contract.created_at || contract.createdAt || new Date().toISOString(),
        createdAt: contract.created_at || contract.createdAt || new Date().toISOString()
    };
}

function toDatabaseRecord(contract) {
    const item = normalizeContract(contract);
    return {
        id: item.id,
        contract_type: item.contract_type,
        contract_number: item.contract_number || null,
        add_number: item.add_number || null,
        worker_name: item.worker_name,
        worker_profession: item.worker_profession,
        worker_id_number: item.worker_id_number,
        worker_nationality: item.worker_nationality,
        birth_date: item.birth_date || null,
        gender: item.gender || null,
        permit_type: item.permit_type || null,
        provider_entity: item.provider_entity,
        provider_hr_id: item.provider_hr_id,
        beneficiary_entity: item.beneficiary_entity,
        beneficiary_hr_id: item.beneficiary_hr_id,
        contract_summary: item.contract_summary,
        start_date: item.start_date,
        end_date: item.end_date,
        work_locations: item.work_locations,
        is_blocked: item.is_blocked,
        blocked_reason: item.blocked_reason,
        created_at: item.created_at
    };
}

function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function filterQuery(field, value) {
    const params = new URLSearchParams();
    params.set('select', '*');
    params.set(field, `eq.${value}`);
    params.set('limit', '1');
    return params.toString();
}

async function connectDB() {
    await supabaseRequest('contracts', { query: 'select=id&limit=1' });
    connected = true;
    console.log('[Supabase] Connected successfully.');
    return { provider: 'supabase' };
}

function getDB() {
    return connected ? { provider: 'supabase' } : null;
}

async function closeDB() {
    connected = false;
}

async function initIndexes() {
    return true;
}

async function listContracts() {
    const rows = await supabaseRequest('contracts', { query: 'select=*&order=created_at.desc' });
    return Array.isArray(rows) ? rows.map(normalizeContract) : [];
}

async function getContract(id) {
    if (!id) return null;
    const field = isUuid(id) ? 'id' : 'contract_number';
    const rows = await supabaseRequest('contracts', { query: filterQuery(field, String(id)) });
    return Array.isArray(rows) && rows.length ? normalizeContract(rows[0]) : null;
}

async function checkContractNumberExists(number) {
    if (!number) return false;
    const rows = await supabaseRequest('contracts', {
        query: filterQuery('contract_number', String(number))
    });
    return Array.isArray(rows) && rows.length > 0;
}

async function checkContractIdExists(id) {
    if (!id || !isUuid(id)) return false;
    const rows = await supabaseRequest('contracts', { query: filterQuery('id', String(id)) });
    return Array.isArray(rows) && rows.length > 0;
}

function generateDiverseDigits(length = 8) {
    let digits = String(Math.floor(Math.random() * 8) + 2);
    while (digits.length < length) digits += Math.floor(Math.random() * 10);
    return digits;
}

async function getNextContractNumber() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const candidate = `TQ${generateDiverseDigits(8)}`;
        if (!(await checkContractNumberExists(candidate))) return candidate;
    }
    return `TQ${generateDiverseDigits(8)}`;
}

async function saveContract(contract) {
    const source = { ...contract };
    const oldId = source.id || source._id;
    if (source.newId && String(source.newId) !== String(oldId || '')) {
        if (oldId && isUuid(oldId)) await deleteContract(oldId);
        source.id = String(source.newId);
        source._id = source.id;
    }
    if (!source.id && !source._id) source.id = crypto.randomUUID();
    if (!pickField(source, 'contractNumber', 'contract_number', '')) {
        source.contract_number = await getNextContractNumber();
    }

    const record = toDatabaseRecord(source);
    if (!record.add_number) {
        record.add_number = `TW${String(record.contract_number || '').replace(/\D/g, '')}`;
    }
    const rows = await supabaseRequest('contracts', {
        method: 'POST',
        query: 'on_conflict=id',
        prefer: 'resolution=merge-duplicates,return=representation',
        body: record
    });
    return normalizeContract(Array.isArray(rows) && rows.length ? rows[0] : record);
}

async function deleteContract(id) {
    if (!id) return false;
    const field = isUuid(id) ? 'id' : 'contract_number';
    const params = new URLSearchParams();
    params.set(field, `eq.${id}`);
    await supabaseRequest('contracts', {
        method: 'DELETE',
        query: params.toString(),
        prefer: 'return=minimal'
    });
    return true;
}

async function bulkInsertContracts(records) {
    if (!Array.isArray(records) || records.length === 0) {
        return { inserted: 0, skipped: 0, total: 0 };
    }
    const prepared = [];
    for (const item of records) {
        const source = { ...item };
        if (!source.id && !source._id) source.id = crypto.randomUUID();
        if (!pickField(source, 'contractNumber', 'contract_number', '')) {
            source.contract_number = await getNextContractNumber();
        }
        prepared.push(toDatabaseRecord(source));
    }
    const rows = await supabaseRequest('contracts', {
        method: 'POST',
        query: 'on_conflict=id',
        prefer: 'resolution=merge-duplicates,return=representation',
        body: prepared
    });
    const inserted = Array.isArray(rows) ? rows.length : prepared.length;
    return { inserted, skipped: records.length - inserted, total: records.length };
}

async function authenticateUser(username, password) {
    if (!username || !password) return null;
    const params = new URLSearchParams();
    params.set('select', 'id,username,full_name,email');
    params.set('username', `eq.${String(username).trim()}`);
    params.set('password', `eq.${String(password)}`);
    params.set('limit', '1');

    const rows = await supabaseRequest('users', { query: params.toString() });
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const user = rows[0];
    return {
        id: user.id,
        username: user.username,
        full_name: user.full_name || user.username,
        email: user.email || `${user.username}@system.local`
    };
}

async function seedDefaultUsers() {
    return { seeded: false };
}

async function migrateFromSupabaseIfNeeded() {
    const contracts = await listContracts();
    return { success: true, count: contracts.length, provider: 'supabase' };
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
