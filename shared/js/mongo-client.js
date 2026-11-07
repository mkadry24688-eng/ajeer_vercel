/**
 * MongoDB Client for Balady / Ajeer System
 * Communicates with the server-side MongoDB database via REST API.
 */
(function(window) {
    'use strict';

    const mongoClient = {
        isMongoAvailable: true,

        /**
         * Fetch all contracts from MongoDB
         */
        async getContracts() {
            try {
                const res = await fetch('/api/contracts');
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                return Array.isArray(data) ? data : [];
            } catch (err) {
                console.error('[mongoClient] Error fetching contracts:', err);
                throw err;
            }
        },

        /**
         * Fetch a single contract by id or contract number
         */
        async getContract(id) {
            if (!id) return null;
            try {
                const res = await fetch('/api/contracts/' + encodeURIComponent(id));
                if (res.status === 404) return null;
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return await res.json();
            } catch (err) {
                console.error('[mongoClient] Error fetching contract ' + id + ':', err);
                throw err;
            }
        },

        /**
         * Save or update a contract in MongoDB
         */
        async saveContract(contract) {
            if (!contract) throw new Error('Contract object required');
            try {
                const id = contract.id || contract._id;
                const isCreate = Boolean(contract._isNew);
                const method = (id && !isCreate) ? 'PUT' : 'POST';
                const url = (id && !isCreate) ? '/api/contracts/' + encodeURIComponent(id) : '/api/contracts';

                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(contract)
                });

                if (!res.ok) {
                    const errJson = await res.json().catch(() => ({}));
                    throw new Error(errJson.error || ('HTTP ' + res.status));
                }
                return await res.json();
            } catch (err) {
                console.error('[mongoClient] Error saving contract:', err);
                throw err;
            }
        },

        /**
         * Check if contract ID already exists in MongoDB
         */
        async checkIdExists(id) {
            if (!id) return false;
            try {
                const res = await fetch('/api/contracts/check-id/' + encodeURIComponent(id));
                if (!res.ok) return false;
                const data = await res.json();
                return !!data.exists;
            } catch (err) {
                console.warn('[mongoClient] Error checking contract id:', err);
                return false;
            }
        },

        /**
         * Delete a contract by id from MongoDB
         */
        async deleteContract(id) {
            if (!id) return false;
            try {
                const res = await fetch('/api/contracts/' + encodeURIComponent(id), {
                    method: 'DELETE'
                });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                return !!data.success;
            } catch (err) {
                console.error('[mongoClient] Error deleting contract ' + id + ':', err);
                throw err;
            }
        },

        /**
         * Check if contract number already exists in MongoDB
         */
        async checkNumberExists(num) {
            if (!num) return false;
            try {
                const res = await fetch('/api/contracts/check-number/' + encodeURIComponent(num));
                if (!res.ok) return false;
                const data = await res.json();
                return !!data.exists;
            } catch (err) {
                console.warn('[mongoClient] Error checking contract number:', err);
                return false;
            }
        },

        /**
         * Generate next unique contract number from MongoDB
         */
        async getNextContractNumber() {
            try {
                const res = await fetch('/api/contracts/next-number');
                if (res.ok) {
                    const data = await res.json();
                    if (data.number) return data.number;
                }
            } catch (err) {
                console.warn('[mongoClient] Error fetching next contract number:', err);
            }
            const digits = String(Math.floor(Math.random() * 80000000) + 20000000);
            return 'TQ' + digits;
        },

        /**
         * Bulk insert / import contracts into MongoDB
         */
        async bulkInsert(records) {
            try {
                const res = await fetch('/api/contracts/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(records)
                });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return await res.json();
            } catch (err) {
                console.error('[mongoClient] Error bulk importing contracts:', err);
                throw err;
            }
        }
    };

    window.mongoClient = mongoClient;

    // Full compatibility shim for any legacy supabaseClient calls
    window.supabaseClient = {
        from: function(tableName) {
            return {
                select: function(cols) {
                    return {
                        order: function(col, opts) {
                            return mongoClient.getContracts().then(function(data) {
                                return { data: data, error: null };
                            }).catch(function(err) {
                                return { data: null, error: err };
                            });
                        },
                        eq: function(col, val) {
                            return {
                                single: function() {
                                    return mongoClient.getContract(val).then(function(data) {
                                        return { data: data, error: data ? null : new Error('Not found') };
                                    }).catch(function(err) {
                                        return { data: null, error: err };
                                    });
                                },
                                maybeSingle: function() {
                                    return mongoClient.checkNumberExists(val).then(function(exists) {
                                        return { data: exists ? { contract_number: val } : null, error: null };
                                    }).catch(function(err) {
                                        return { data: null, error: err };
                                    });
                                }
                            };
                        },
                        then: function(resolve, reject) {
                            return mongoClient.getContracts().then(function(data) {
                                return resolve({ data: data, error: null });
                            }, reject);
                        }
                    };
                },
                insert: function(records) {
                    return {
                        select: function() {
                            return {
                                single: function() {
                                    const rec = Array.isArray(records) ? records[0] : records;
                                    return mongoClient.saveContract(rec).then(function(data) {
                                        return { data: data, error: null };
                                    }).catch(function(err) {
                                        return { data: null, error: err };
                                    });
                                }
                            };
                        },
                        then: function(resolve, reject) {
                            const recs = Array.isArray(records) ? records : [records];
                            return mongoClient.bulkInsert(recs).then(function(data) {
                                return resolve({ data: data, error: null });
                            }, reject);
                        }
                    };
                },
                update: function(fields) {
                    return {
                        eq: function(col, val) {
                            return {
                                select: function() {
                                    return {
                                        single: function() {
                                            const rec = Object.assign({ id: val }, fields);
                                            return mongoClient.saveContract(rec).then(function(data) {
                                                return { data: data, error: null };
                                            }).catch(function(err) {
                                                return { data: null, error: err };
                                            });
                                        }
                                    };
                                },
                                then: function(resolve, reject) {
                                    const rec = Object.assign({ id: val }, fields);
                                    return mongoClient.saveContract(rec).then(function(data) {
                                        return resolve({ data: data, error: null });
                                    }, reject);
                                }
                            };
                        }
                    };
                },
                delete: function() {
                    return {
                        eq: function(col, val) {
                            return mongoClient.deleteContract(val).then(function(res) {
                                return { data: res, error: null };
                            }).catch(function(err) {
                                return { data: null, error: err };
                            });
                        }
                    };
                }
            };
        },
        auth: {
            signInWithPassword: async function(creds) {
                try {
                    const res = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: creds.email, password: creds.password })
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data && data.success && data.user) {
                            return { data: { user: data.user }, error: null };
                        }
                    }
                    return { data: null, error: new Error('Invalid credentials') };
                } catch (e) {
                    return { data: null, error: e };
                }
            }
        }
    };

    console.log('[MongoDB] Client initialized successfully.');
})(window);
