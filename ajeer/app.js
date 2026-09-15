
class StorageManager {
  static STORAGE_KEY = "ajeer_contracts";
  static TABLE_NAME = "contracts";
  static contractsCache = null;

  static isSupabaseAvailable() {
    return (
      typeof supabaseClient !== "undefined" &&
      supabaseClient !== null &&
      isSupabaseEnabled
    );
  }

  static async getContracts(forceRefresh = false) {
    if (this.contractsCache && !forceRefresh) {
      return this.contractsCache;
    }

    const localContracts = this.getContractsFromLocal();
    if (localContracts && localContracts.length > 0 && !forceRefresh && !this.contractsCache) {
      this.contractsCache = localContracts;

      if (this.isSupabaseAvailable()) {
        this.syncSupabaseInBackground();
      }

      return localContracts;
    }

    if (this.isSupabaseAvailable()) {
      try {
        const { data, error } = await supabaseClient
          .from(this.TABLE_NAME)
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        const normalized = (data || []).map((c) => this.normalizeContract(c));
        this.contractsCache = normalized;

        this.saveContractsToLocalBulk(normalized);

        return normalized;
      } catch (error) {
        console.error("Supabase error:", error);
        return localContracts;
      }
    }
    this.contractsCache = localContracts;
    return localContracts;
  }

  static saveContractsToLocalBulk(contracts) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(contracts));
  }

  static async syncSupabaseInBackground() {
    try {
      const { data, error } = await supabaseClient
        .from(this.TABLE_NAME)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      const normalized = (data || []).map((c) => this.normalizeContract(c));
      this.contractsCache = normalized;
      this.saveContractsToLocalBulk(normalized);

      window.dispatchEvent(new CustomEvent("contracts-synced", { detail: normalized }));
    } catch (err) {
      console.error("Background database sync error:", err);
    }
  }

  static async getContract(id) {
    const localContract = this.getContractFromLocal(id);
    if (this.isSupabaseAvailable()) {
      try {
        const { data, error } = await supabaseClient
          .from(this.TABLE_NAME)
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw error;
        const normalized = this.normalizeContract(data);
        if (localContract) {
          if (!normalized.birthDate && (localContract.birthDate || localContract.birth_date)) {
            normalized.birthDate = localContract.birthDate || localContract.birth_date;
          }
          if (!normalized.gender && localContract.gender) {
            normalized.gender = localContract.gender;
          }
          if (!normalized.permitType && (localContract.permitType || localContract.permit_type)) {
            normalized.permitType = localContract.permitType || localContract.permit_type;
          }
          if (!normalized.addNumber && (localContract.addNumber || localContract.add_number)) {
            normalized.addNumber = localContract.addNumber || localContract.add_number;
          }
        }
        return normalized;
      } catch (error) {
        console.error("Supabase error:", error);
        return localContract;
      }
    }
    return localContract;
  }

  static async saveContract(contract) {
    if (this.isSupabaseAvailable()) {
      try {

        const cleanContract = {
          contract_type:
            contract.contractType !== undefined
              ? contract.contractType
              : contract.contract_type || "تعاقد أجير",
          contract_number:
            contract.contractNumber !== undefined
              ? contract.contractNumber
              : contract.contract_number,
          worker_name:
            contract.workerName !== undefined
              ? contract.workerName
              : contract.worker_name,
          worker_profession:
            contract.workerProfession !== undefined
              ? contract.workerProfession
              : contract.worker_profession,
          worker_id_number:
            contract.workerIdNumber !== undefined
              ? contract.workerIdNumber
              : contract.worker_id_number,
          worker_nationality:
            contract.workerNationality !== undefined
              ? contract.workerNationality
              : contract.worker_nationality,
          provider_entity:
            contract.providerEntity !== undefined
              ? contract.providerEntity
              : contract.provider_entity,
          provider_hr_id:
            contract.providerHrId !== undefined
              ? contract.providerHrId
              : contract.provider_hr_id,
          beneficiary_entity:
            contract.beneficiaryEntity !== undefined
              ? contract.beneficiaryEntity
              : contract.beneficiary_entity,
          beneficiary_hr_id:
            contract.beneficiaryHrId !== undefined
              ? contract.beneficiaryHrId
              : contract.beneficiary_hr_id,
          contract_summary:
            contract.contractSummary !== undefined
              ? contract.contractSummary
              : contract.contract_summary,
          start_date:
            contract.startDate !== undefined
              ? contract.startDate || null
              : contract.start_date || null,
          end_date:
            contract.endDate !== undefined
              ? contract.endDate || null
              : contract.end_date || null,
          work_locations:
            contract.workLocations !== undefined
              ? contract.workLocations
              : contract.work_locations,
          is_blocked:
            contract.isBlocked !== undefined
              ? contract.isBlocked
              : contract.is_blocked || false,
          blocked_reason:
            contract.blockedReason !== undefined
              ? contract.blockedReason
              : contract.blocked_reason || null,
        };

        if (contract.id) {

          const { data, error } = await supabaseClient
            .from(this.TABLE_NAME)
            .update(cleanContract)
            .eq("id", contract.id)
            .select()
            .single();

          if (error) throw error;
          this.contractsCache = null;
          const normalized = this.normalizeContract(data);
          if (contract.birthDate || contract.birth_date) {
            normalized.birthDate = contract.birthDate || contract.birth_date;
          }
          if (contract.gender) normalized.gender = contract.gender;
          if (contract.permitType || contract.permit_type) {
            normalized.permitType = contract.permitType || contract.permit_type;
          }
          if (contract.addNumber || contract.add_number) {
            normalized.addNumber = contract.addNumber || contract.add_number;
          }
          this.saveContractToLocal(normalized);
          return normalized;
        } else {

          if (!cleanContract.contract_number || this.isDummyZeroNumber(cleanContract.contract_number)) {
            const nextNumber = await this.getNextContractNumber();
            cleanContract.contract_number = nextNumber;
          }

          const { data, error } = await supabaseClient
            .from(this.TABLE_NAME)
            .insert([cleanContract])
            .select()
            .single();

          if (error) throw error;
          this.contractsCache = null;
          const normalized = this.normalizeContract(data);
          if (contract.birthDate || contract.birth_date) {
            normalized.birthDate = contract.birthDate || contract.birth_date;
          }
          if (contract.gender) normalized.gender = contract.gender;
          if (contract.permitType || contract.permit_type) {
            normalized.permitType = contract.permitType || contract.permit_type;
          }
          if (contract.addNumber || contract.add_number) {
            normalized.addNumber = contract.addNumber || contract.add_number;
          }
          this.saveContractToLocal(normalized);
          return normalized;
        }
      } catch (error) {
        console.error("Supabase save error:", error);
        alert("خطأ في حفظ البيانات: " + error.message);
        throw error;
      }
    }

    this.contractsCache = null;
    return this.saveContractToLocal(contract);
  }

  static async deleteContract(id) {
    this.contractsCache = null;
    if (this.isSupabaseAvailable()) {
      try {
        const { error } = await supabaseClient
          .from(this.TABLE_NAME)
          .delete()
          .eq("id", id);

        if (error) throw error;
      } catch (error) {
        console.error("Supabase delete error:", error);
        throw error;
      }
    } else {
      this.deleteContractFromLocal(id);
    }
  }

  static normalizeContract(contract) {
    if (!contract) return null;

    let contractType = "تعاقد أجير";
    if (contract.contract_type && contract.contract_type.trim() !== "") {
      contractType = contract.contract_type;
    } else if (contract.contractType && contract.contractType.trim() !== "") {
      contractType = contract.contractType;
    }

    return {
      id: contract.id,
      contractType: contractType,
      contractNumber: contract.contract_number || contract.contractNumber,
      addNumber: contract.add_number || contract.addNumber,
      workerName: contract.worker_name || contract.workerName,
      workerProfession: contract.worker_profession || contract.workerProfession,
      workerIdNumber: contract.worker_id_number || contract.workerIdNumber,
      workerNationality:
        contract.worker_nationality || contract.workerNationality,
      birthDate: contract.birth_date || contract.birthDate || "",
      gender: contract.gender || "",
      permitType: contract.permit_type || contract.permitType,
      providerEntity: contract.provider_entity || contract.providerEntity,
      providerHrId: contract.provider_hr_id || contract.providerHrId,
      beneficiaryEntity:
        contract.beneficiary_entity || contract.beneficiaryEntity,
      beneficiaryHrId: contract.beneficiary_hr_id || contract.beneficiaryHrId,
      contractSummary: contract.contract_summary || contract.contractSummary,
      startDate: contract.start_date || contract.startDate,
      endDate: contract.end_date || contract.endDate,
      workLocations: contract.work_locations || contract.workLocations,
      isBlocked: (() => {
        if (contract.is_blocked || contract.isBlocked) return true;
        const rawEnd = contract.end_date || contract.endDate;
        if (rawEnd) {
          const end = new Date(rawEnd);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (end < today) return true;
        }
        return false;
      })(),
      blockedReason: (() => {
        if (contract.blocked_reason || contract.blockedReason) return contract.blocked_reason || contract.blockedReason;
        const rawEnd = contract.end_date || contract.endDate;
        if (rawEnd) {
          const end = new Date(rawEnd);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (end < today) return "انتهاء مدة العقد";
        }
        return null;
      })(),
      createdAt: contract.created_at || contract.createdAt,
    };
  }

  static getContractsFromLocal() {
    const data = localStorage.getItem(this.STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  static getContractFromLocal(id) {
    const contracts = this.getContractsFromLocal();
    return contracts.find((c) => c.id === id);
  }

  static saveContractToLocal(contract) {
    const contracts = this.getContractsFromLocal();

    if (contract.id) {
      const index = contracts.findIndex((c) => c.id === contract.id);
      if (index !== -1) {
        contracts[index] = { ...contracts[index], ...contract };
      } else {
        contracts.push(contract);
      }
    } else {
      contract.id = this.generateId();
      contract.createdAt = new Date().toISOString();
      if (!contract.contractNumber || this.isDummyZeroNumber(contract.contractNumber)) {
        contract.contractNumber = "TQ" + this.generateDiverseDigits(8);
      }
      if (!contract.addNumber || this.isDummyZeroNumber(contract.addNumber)) {
        const digits = contract.contractNumber.replace(/\D/g, "");
        contract.addNumber = "TW" + digits;
      }
      contracts.push(contract);
    }

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(contracts));
    return contract;
  }

  static deleteContractFromLocal(id) {
    let contracts = this.getContractsFromLocal();
    contracts = contracts.filter((c) => c.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(contracts));
  }

  static generateId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "id-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
  }

  static generateDiverseDigits(length = 8) {
    const first = Math.floor(Math.random() * 8) + 2; // 2 to 9
    let digits = String(first);
    for (let i = 1; i < length; i++) {
      digits += Math.floor(Math.random() * 10);
    }
    return digits;
  }

  static isDummyZeroNumber(val) {
    if (!val) return true;
    const str = String(val).trim();
    const digits = str.replace(/\D/g, "");
    if (!digits || digits === "0000001" || digits === "1" || /^0{3,}\d+$/.test(digits) || digits.length < 6) {
      return true;
    }
    return false;
  }

  static async getNextContractNumber() {
    try {
      if (this.isSupabaseAvailable()) {
        for (let attempts = 0; attempts < 5; attempts++) {
          const candidate = "TQ" + this.generateDiverseDigits(8);
          const { data, error } = await supabaseClient
            .from(this.TABLE_NAME)
            .select("contract_number")
            .eq("contract_number", candidate)
            .maybeSingle();

          if (!error && !data) return candidate;
        }
      }
      return "TQ" + this.generateDiverseDigits(8);
    } catch (error) {
      console.error("Error getting next contract number:", error);
      return "TQ" + this.generateDiverseDigits(8);
    }
  }

  static getNextLocalContractNumber(contracts) {
    return this.generateDiverseDigits(8);
  }

  static async getNextAddNumber() {
    return "TW" + this.generateDiverseDigits(8);
  }

  static async importDatabase() {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";

      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) {
          resolve({ imported: 0, skipped: 0 });
          return;
        }

        try {
          const text = await file.text();
          const parsed = JSON.parse(text);

          if (parsed.type !== "ajeer_contracts_backup") {
            throw new Error(
              "الملف غير متوافق - يجب أن يكون نسخة احتياطية من عقود أجير",
            );
          }

          const records = parsed.data || [];
          let imported = 0;
          let skipped = 0;

          this.contractsCache = null;

          if (this.isSupabaseAvailable()) {

            const { data: existing } = await supabaseClient
              .from(this.TABLE_NAME)
              .select("id");
            const existingIds = new Set((existing || []).map((r) => r.id));

            for (const contract of records) {
              if (!contract.id || existingIds.has(contract.id)) {
                skipped++;
                continue;
              }

              const cleanContract = {
                id: contract.id,
                contract_type: contract.contractType || "تعاقد أجير",
                contract_number: contract.contractNumber,
                worker_name: contract.workerName,
                worker_profession: contract.workerProfession,
                worker_id_number: contract.workerIdNumber,
                worker_nationality: contract.workerNationality,
                provider_entity: contract.providerEntity,
                provider_hr_id: contract.providerHrId,
                beneficiary_entity: contract.beneficiaryEntity,
                beneficiary_hr_id: contract.beneficiaryHrId,
                contract_summary: contract.contractSummary,
                start_date: contract.startDate,
                end_date: contract.endDate,
                work_locations: contract.workLocations,
                is_blocked: contract.isBlocked || false,
                blocked_reason: contract.blockedReason || null,
              };
              const { error } = await supabaseClient
                .from(this.TABLE_NAME)
                .insert([cleanContract]);
              if (!error) imported++;
              else {
                console.warn("Insert error:", error);
                skipped++;
              }
            }
          } else {

            const existing = this.getContractsFromLocal();
            const existingIds = new Set(existing.map((r) => r.id));
            const toAdd = records.filter((r) => r.id && !existingIds.has(r.id));
            skipped = records.length - toAdd.length;
            const merged = [...existing, ...toAdd];
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(merged));
            imported = toAdd.length;
          }

          resolve({ imported, skipped });
        } catch (err) {
          reject(err);
        }
      };

      input.click();
    });
  }

  static async backupDatabase() {
    try {
      const contracts = await this.getContracts();
      const backupData = {
        type: "ajeer_contracts_backup",
        version: "1.0",
        exportedAt: new Date().toISOString(),
        totalRecords: contracts.length,
        source: this.isSupabaseAvailable() ? "supabase" : "localstorage",
        data: contracts,
      };

      const json = JSON.stringify(backupData, null, 2);

      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const timeStr = `${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
      const filename = `ajeer_backup_${dateStr}_${timeStr}.json`;

      if (window.showSaveFilePicker) {
        try {
          const fileHandle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [
              {
                description: "ملف JSON للنسخة الاحتياطية",
                accept: { "application/json": [".json"] },
              },
            ],
          });
          const writable = await fileHandle.createWritable();
          await writable.write(json);
          await writable.close();
          return {
            success: true,
            count: contracts.length,
            filename: fileHandle.name,
          };
        } catch (pickerErr) {

          if (pickerErr.name === "AbortError") {
            return { success: false, cancelled: true, count: 0, filename };
          }

          console.warn("showSaveFilePicker failed, falling back:", pickerErr);
        }
      }

      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return { success: true, count: contracts.length, filename };
    } catch (error) {
      console.error("Backup error:", error);
      throw error;
    }
  }
}

function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function showToast(message, type = "success") {
  if (typeof Swal !== "undefined") {
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: type,
      title: message,
      showConfirmButton: false,
      timer: 3000,
    });
  } else {
    alert(message);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  if (StorageManager.isSupabaseAvailable()) {
    console.log("Supabase Mode: Active");
  } else {
    console.log("LocalStorage Mode: Active");
  }
  autoBlockExpiredContracts();
});

async function autoBlockExpiredContracts(contracts = null) {
  try {
    if (!contracts) {
      contracts = await StorageManager.getContracts();
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiredContracts = contracts.filter((contract) => {
      if (!contract.endDate) return false;
      const endDate = new Date(contract.endDate);
      endDate.setHours(0, 0, 0, 0);
      return endDate < today && !contract.isBlocked;
    });

    if (expiredContracts.length === 0) return false;

    const updatePromises = expiredContracts.map((contract) => {
      contract.isBlocked = true;
      contract.blockedReason = "انتهاء مدة العقد";
      return StorageManager.saveContract(contract);
    });

    await Promise.all(updatePromises);
    return true;
  } catch (error) {
    console.error("Error checking expired contracts:", error);
    return false;
  }
}

window.autoBlockExpiredContracts = autoBlockExpiredContracts;
