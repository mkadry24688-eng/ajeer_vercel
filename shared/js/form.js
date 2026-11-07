function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function convertArabicDigitsToEnglish(str) {
  if (!str) return "";
  return String(str)
    .replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 1632)
    .replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 1776);
}

function formatYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateForInput(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr).slice(0, 10);
    return formatYMD(d);
  } catch (_) {
    return String(dateStr).slice(0, 10);
  }
}

function initDefaultDates() {
  const startInput = document.getElementById("startDate") || document.querySelector('input[name="startDate"]');
  const endInput = document.getElementById("endDate") || document.querySelector('input[name="endDate"]');

  if (startInput && !startInput.value) {
    const today = new Date();
    startInput.value = formatYMD(today);

    if (endInput && !endInput.value) {
      const sixMonths = new Date(today);
      sixMonths.setMonth(sixMonths.getMonth() + 6);
      endInput.value = formatYMD(sixMonths);
    }
  }

  if (startInput) {
    startInput.addEventListener("change", () => {
      if (startInput.value) {
        const newStart = new Date(startInput.value);
        if (!isNaN(newStart.getTime())) {
          const newEnd = new Date(newStart);
          newEnd.setMonth(newEnd.getMonth() + 6);
          if (endInput) {
            endInput.value = formatYMD(newEnd);
          }
        }
      }
    });
  }
}

function generateNewNumbers() {
  const digits = typeof StorageManager !== "undefined" && StorageManager.generateDiverseDigits
    ? StorageManager.generateDiverseDigits(8)
    : String(Math.floor(Math.random() * 80000000) + 20000000);
  const contractInput = document.getElementById("contractNumber");
  const addInput = document.getElementById("addNumber");
  if (contractInput) contractInput.value = "TQ" + digits;
  if (addInput) addInput.value = "TW" + digits;
}
window.generateNewNumbers = generateNewNumbers;

let globalRecentProviders = [];
let globalRecentBeneficiaries = [];

function populateEntitySelect(selectEl, entities, currentValue = "") {
  if (!selectEl) return;
  const isOther = currentValue && currentValue !== "" && !entities.some((e) => e.name === currentValue);

  selectEl.innerHTML = '<option value="">اختر المنشأة...</option>';
  entities.forEach((ent) => {
    const opt = document.createElement("option");
    opt.value = ent.name;
    opt.textContent = ent.name;
    opt.setAttribute("data-hr-id", ent.hrId || "");
    if (ent.name === currentValue) {
      opt.selected = true;
    }
    selectEl.appendChild(opt);
  });

  const otherOpt = document.createElement("option");
  otherOpt.value = "أخرى";
  otherOpt.textContent = "أخرى";
  if (isOther || currentValue === "أخرى") {
    otherOpt.selected = true;
  }
  selectEl.appendChild(otherOpt);
}

function updateProviderUI() {
  const provSelect = document.getElementById("providerEntitySelect");
  const provCustom = document.getElementById("providerEntityCustom");
  const provWrapper = document.getElementById("providerEntityCustomWrapper");
  const provHrIdInput = document.getElementById("providerHrId");

  if (!provSelect) return;

  if (provSelect.value === "أخرى") {
    if (provWrapper) provWrapper.classList.remove("d-none");
    if (provCustom) {
      provCustom.focus();
    }
  } else if (provSelect.value) {
    if (provWrapper) provWrapper.classList.add("d-none");
    const matched = globalRecentProviders.find((p) => p.name === provSelect.value);
    if (matched && provHrIdInput) {
      provHrIdInput.value = matched.hrId || "";
    }
  } else {
    if (provWrapper) provWrapper.classList.add("d-none");
  }
}

function updateBeneficiaryUI() {
  const benSelect = document.getElementById("beneficiaryEntitySelect");
  const benCustom = document.getElementById("beneficiaryEntityCustom");
  const benWrapper = document.getElementById("beneficiaryEntityCustomWrapper");
  const benHrIdInput = document.getElementById("beneficiaryHrId");

  if (!benSelect) return;

  if (benSelect.value === "أخرى") {
    if (benWrapper) benWrapper.classList.remove("d-none");
    if (benCustom) {
      benCustom.focus();
    }
  } else if (benSelect.value) {
    if (benWrapper) benWrapper.classList.add("d-none");
    const matched = globalRecentBeneficiaries.find((b) => b.name === benSelect.value);
    if (matched && benHrIdInput) {
      benHrIdInput.value = matched.hrId || "";
    }
  } else {
    if (benWrapper) benWrapper.classList.add("d-none");
  }
}

async function initRecentEntities(existingContract = null) {
  let contracts = [];
  try {
    if (typeof StorageManager !== "undefined") {
      contracts = await StorageManager.getContracts();
    }
  } catch (err) {
    console.warn("Could not fetch contracts for entities:", err);
  }

  if (!contracts || contracts.length === 0) {
    try {
      const local = localStorage.getItem("ajeer_contracts");
      if (local) contracts = JSON.parse(local);
    } catch (_) {}
  }

  // Extract up to 5 unique recent providers
  const providers = [];
  const seenP = new Set();
  for (const c of contracts) {
    const name = (c.providerEntity || c.provider_entity || "").trim();
    const hrId = (c.providerHrId || c.provider_hr_id || "").trim();
    if (name && !seenP.has(name)) {
      seenP.add(name);
      providers.push({ name, hrId });
      if (providers.length === 5) break;
    }
  }
  globalRecentProviders = providers;

  // Extract up to 5 unique recent beneficiaries
  const beneficiaries = [];
  const seenB = new Set();
  for (const c of contracts) {
    const name = (c.beneficiaryEntity || c.beneficiary_entity || "").trim();
    const hrId = (c.beneficiaryHrId || c.beneficiary_hr_id || "").trim();
    if (name && !seenB.has(name)) {
      seenB.add(name);
      beneficiaries.push({ name, hrId });
      if (beneficiaries.length === 5) break;
    }
  }
  globalRecentBeneficiaries = beneficiaries;

  const provSelect = document.getElementById("providerEntitySelect");
  const benSelect = document.getElementById("beneficiaryEntitySelect");

  const currentProv = existingContract
    ? (existingContract.providerEntity || existingContract.provider_entity || "")
    : (provSelect ? provSelect.value : "");
  const currentBen = existingContract
    ? (existingContract.beneficiaryEntity || existingContract.beneficiary_entity || "")
    : (benSelect ? benSelect.value : "");

  populateEntitySelect(provSelect, globalRecentProviders, currentProv);
  populateEntitySelect(benSelect, globalRecentBeneficiaries, currentBen);

  updateProviderUI();
  updateBeneficiaryUI();
}

document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");

  const contractInput = document.getElementById("contractNumber");
  const addInput = document.getElementById("addNumber");

  if (contractInput && addInput) {
    contractInput.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      const digits = val.replace(/\D/g, "");
      if (digits) {
        addInput.value = "TW" + digits;
      }
    });
  }

  // Real-time conversion of Arabic numerals to English numerals in workerIdNumber
  const workerIdInput = document.getElementById("workerIdNumber") || document.querySelector('input[name="workerIdNumber"]');
  if (workerIdInput) {
    const normalizeWorkerId = () => {
      const orig = workerIdInput.value;
      const converted = convertArabicDigitsToEnglish(orig);
      if (orig !== converted) {
        const start = workerIdInput.selectionStart;
        const end = workerIdInput.selectionEnd;
        workerIdInput.value = converted;
        if (start !== null && end !== null) {
          try {
            workerIdInput.setSelectionRange(start, end);
          } catch (_) {}
        }
      }
    };

    workerIdInput.addEventListener("input", normalizeWorkerId);
    workerIdInput.addEventListener("paste", () => setTimeout(normalizeWorkerId, 0));
    workerIdInput.addEventListener("change", normalizeWorkerId);
  }

  // Default gender to 'ذكر' for new contracts
  const genderSelect = document.getElementById("gender") || document.querySelector('select[name="gender"]');
  if (!id && genderSelect) {
    genderSelect.value = "ذكر";
  }

  // Handle workerProfession dropdown and 'أخرى' custom input
  const profSelect = document.getElementById("workerProfessionSelect");
  const profCustom = document.getElementById("workerProfessionCustom");
  const profWrapper = document.getElementById("workerProfessionCustomWrapper");

  function updateProfessionUI() {
    if (!profSelect) return;
    if (profSelect.value === "أخرى") {
      if (profWrapper) profWrapper.classList.remove("d-none");
      if (profCustom) {
        profCustom.required = true;
        profCustom.focus();
      }
    } else {
      if (profWrapper) profWrapper.classList.add("d-none");
      if (profCustom) {
        profCustom.required = false;
      }
    }
  }

  if (profSelect) {
    profSelect.addEventListener("change", updateProfessionUI);
  }

  // Handle workerNationality dropdown and 'أخرى' custom input
  const natSelect = document.getElementById("workerNationalitySelect");
  const natCustom = document.getElementById("workerNationalityCustom");
  const natWrapper = document.getElementById("workerNationalityCustomWrapper");

  function updateNationalityUI() {
    if (!natSelect) return;
    if (natSelect.value === "أخرى") {
      if (natWrapper) natWrapper.classList.remove("d-none");
      if (natCustom) {
        natCustom.required = true;
        natCustom.focus();
      }
    } else {
      if (natWrapper) natWrapper.classList.add("d-none");
      if (natCustom) {
        natCustom.required = false;
      }
    }
  }

  if (natSelect) {
    natSelect.addEventListener("change", updateNationalityUI);
  }

  // Handle provider & beneficiary selects
  const provSelect = document.getElementById("providerEntitySelect");
  if (provSelect) {
    provSelect.addEventListener("change", updateProviderUI);
  }

  const benSelect = document.getElementById("beneficiaryEntitySelect");
  if (benSelect) {
    benSelect.addEventListener("change", updateBeneficiaryUI);
  }

  // Handle workLocations dropdown and 'أخرى' custom input
  const locSelect = document.getElementById("workLocationsSelect");
  const locCustom = document.getElementById("workLocationsCustom");
  const locWrapper = document.getElementById("workLocationsCustomWrapper");

  function updateWorkLocationsUI() {
    if (!locSelect) return;
    if (locSelect.value === "أخرى") {
      if (locWrapper) locWrapper.classList.remove("d-none");
      if (locCustom) {
        locCustom.focus();
      }
    } else {
      if (locWrapper) locWrapper.classList.add("d-none");
    }
  }

  if (locSelect) {
    locSelect.addEventListener("change", updateWorkLocationsUI);
  }

  if (id) {
    const titleEl = document.getElementById("formTitle");
    if (titleEl) {
      titleEl.innerHTML = '<i class="bi bi-pencil-square"></i><span>تعديل العقد</span>';
    }
    loadContractData(id);
  } else {
    // New contract: prefill with diverse numbers, init recent entities, and default dates
    generateNewNumbers();
    initRecentEntities();
    initDefaultDates();
  }

  const contractForm = document.getElementById("contractForm");
  if (contractForm) {
    contractForm.addEventListener("submit", handleSave);
  }
});

async function loadContractData(id) {
  const contract = await StorageManager.getContract(id);
  if (!contract) {
    Swal.fire({
      icon: "error",
      title: "خطأ",
      text: "العقد غير موجود",
      confirmButtonText: "حسناً",
      confirmButtonColor: "#3b82f6",
    }).then(() => {
      window.location.href = "/ajeer";
    });
    return;
  }

  // Load recent entities with existing contract selected
  await initRecentEntities(contract);

  const form = document.getElementById("contractForm");
  if (form) {
    Object.keys(contract).forEach((key) => {
      const input = form.elements[key];
      if (input) {
        input.value = contract[key];
      }
    });

    // Populate Profession select / custom
    const profSelect = document.getElementById("workerProfessionSelect");
    const profCustom = document.getElementById("workerProfessionCustom");
    const profWrapper = document.getElementById("workerProfessionCustomWrapper");
    const contractProf = contract.workerProfession || contract.worker_profession;
    if (contractProf && profSelect) {
      if (Array.from(profSelect.options).some(option => option.value === contractProf && option.value !== "أخرى")) {
        profSelect.value = contractProf;
        if (profWrapper) profWrapper.classList.add("d-none");
        if (profCustom) {
          profCustom.value = "";
          profCustom.required = false;
        }
      } else {
        profSelect.value = "أخرى";
        if (profWrapper) profWrapper.classList.remove("d-none");
        if (profCustom) {
          profCustom.value = contractProf;
          profCustom.required = true;
        }
      }
    }

    // Populate Nationality select / custom
    const natSelect = document.getElementById("workerNationalitySelect");
    const natCustom = document.getElementById("workerNationalityCustom");
    const natWrapper = document.getElementById("workerNationalityCustomWrapper");
    const standardNationalities = [
      "اليمن",
      "مصر",
      "بنجلاديش",
      "الهند",
      "الفلبين"
    ];
    const contractNat = contract.workerNationality || contract.worker_nationality;
    if (contractNat && natSelect) {
      if (standardNationalities.includes(contractNat)) {
        natSelect.value = contractNat;
        if (natWrapper) natWrapper.classList.add("d-none");
        if (natCustom) {
          natCustom.value = "";
          natCustom.required = false;
        }
      } else {
        natSelect.value = "أخرى";
        if (natWrapper) natWrapper.classList.remove("d-none");
        if (natCustom) {
          natCustom.value = contractNat;
          natCustom.required = true;
        }
      }
    }

    // Set providerEntity and providerHrId
    const provSelect = document.getElementById("providerEntitySelect");
    const provCustom = document.getElementById("providerEntityCustom");
    const provWrapper = document.getElementById("providerEntityCustomWrapper");
    const provHrIdInput = document.getElementById("providerHrId");
    const contractProv = contract.providerEntity || contract.provider_entity || "";
    const contractProvHr = contract.providerHrId || contract.provider_hr_id || "";

    if (provSelect && contractProv) {
      const matchP = globalRecentProviders.find((p) => p.name === contractProv);
      if (matchP) {
        provSelect.value = contractProv;
        if (provWrapper) provWrapper.classList.add("d-none");
        if (provCustom) provCustom.value = "";
      } else {
        provSelect.value = "أخرى";
        if (provWrapper) provWrapper.classList.remove("d-none");
        if (provCustom) provCustom.value = contractProv;
      }
    }
    if (provHrIdInput && contractProvHr) {
      provHrIdInput.value = contractProvHr;
    }

    // Set beneficiaryEntity and beneficiaryHrId
    const benSelect = document.getElementById("beneficiaryEntitySelect");
    const benCustom = document.getElementById("beneficiaryEntityCustom");
    const benWrapper = document.getElementById("beneficiaryEntityCustomWrapper");
    const benHrIdInput = document.getElementById("beneficiaryHrId");
    const contractBen = contract.beneficiaryEntity || contract.beneficiary_entity || "";
    const contractBenHr = contract.beneficiaryHrId || contract.beneficiary_hr_id || "";

    if (benSelect && contractBen) {
      const matchB = globalRecentBeneficiaries.find((b) => b.name === contractBen);
      if (matchB) {
        benSelect.value = contractBen;
        if (benWrapper) benWrapper.classList.add("d-none");
        if (benCustom) benCustom.value = "";
      } else {
        benSelect.value = "أخرى";
        if (benWrapper) benWrapper.classList.remove("d-none");
        if (benCustom) benCustom.value = contractBen;
      }
    }
    if (benHrIdInput && contractBenHr) {
      benHrIdInput.value = contractBenHr;
    }

    // Set gender with fallback to 'ذكر'
    const genderSelect = document.getElementById("gender") || form.elements["gender"];
    if (genderSelect) {
      genderSelect.value = contract.gender || "ذكر";
    }

    // Set workerIdNumber converted if needed
    const workerIdInput = document.getElementById("workerIdNumber") || form.elements["workerIdNumber"];
    if (workerIdInput && contract.workerIdNumber) {
      workerIdInput.value = convertArabicDigitsToEnglish(contract.workerIdNumber);
    }

    // Set startDate and endDate
    const startInput = document.getElementById("startDate") || form.elements["startDate"];
    const endInput = document.getElementById("endDate") || form.elements["endDate"];
    if (startInput && contract.startDate) {
      startInput.value = formatDateForInput(contract.startDate);
    }
    if (endInput && contract.endDate) {
      endInput.value = formatDateForInput(contract.endDate);
    }

    // Set workLocations
    const locSelect = document.getElementById("workLocationsSelect");
    const locCustom = document.getElementById("workLocationsCustom");
    const locWrapper = document.getElementById("workLocationsCustomWrapper");
    const contractLoc = contract.workLocations || contract.work_locations || "";

    if (locSelect && contractLoc) {
      if (Array.from(locSelect.options).some(option => option.value === contractLoc && option.value !== "أخرى")) {
        locSelect.value = contractLoc;
        if (locWrapper) locWrapper.classList.add("d-none");
        if (locCustom) locCustom.value = "";
      } else {
        locSelect.value = "أخرى";
        if (locWrapper) locWrapper.classList.remove("d-none");
        if (locCustom) locCustom.value = contractLoc;
      }
    }

    // Set customId
    const customIdInput = document.getElementById("customId");
    if (customIdInput && contract.id) {
      customIdInput.value = contract.id;
    }

    const contractInput = document.getElementById("contractNumber");
    const addInput = document.getElementById("addNumber");

    // If existing contract had dummy 0000001, upgrade it to diverse digits
    const isDummy = (val) => {
      if (!val) return true;
      const digits = String(val).replace(/\D/g, "");
      return !digits || digits === "0000001" || /^0{3,}\d+$/.test(digits) || digits.length < 6;
    };

    if (contractInput && isDummy(contractInput.value)) {
      const digits = typeof StorageManager !== "undefined" && StorageManager.generateDiverseDigits
        ? StorageManager.generateDiverseDigits(8)
        : String(Math.floor(Math.random() * 80000000) + 20000000);
      contractInput.value = "TQ" + digits;
      if (addInput) addInput.value = "TW" + digits;
    } else if (contractInput && addInput && (!addInput.value || isDummy(addInput.value))) {
      const digits = contractInput.value.replace(/\D/g, "");
      addInput.value = "TW" + digits;
    }
  }
}

async function handleSave(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  // Convert workerIdNumber to standard English numerals
  if (data.workerIdNumber) {
    data.workerIdNumber = convertArabicDigitsToEnglish(data.workerIdNumber).trim();
  }

  // Ensure default gender is 'ذكر'
  if (!data.gender || data.gender.trim() === "") {
    data.gender = "ذكر";
  }

  // Resolve workerProfession from select or custom input
  const profSelect = document.getElementById("workerProfessionSelect");
  const profCustom = document.getElementById("workerProfessionCustom");
  let professionValue = "";
  if (profSelect) {
    if (profSelect.value === "أخرى") {
      professionValue = profCustom ? profCustom.value.trim() : "";
    } else {
      professionValue = (profSelect.value || "").trim();
    }
  }

  // Resolve workerNationality from select or custom input
  const natSelect = document.getElementById("workerNationalitySelect");
  const natCustom = document.getElementById("workerNationalityCustom");
  let nationalityValue = "";
  if (natSelect) {
    if (natSelect.value === "أخرى") {
      nationalityValue = natCustom ? natCustom.value.trim() : "";
    } else {
      nationalityValue = (natSelect.value || "").trim();
    }
  }

  data.workerProfession = professionValue;
  data.workerNationality = nationalityValue;

  delete data.workerProfessionSelect;
  delete data.workerNationalitySelect;
  delete data.workerProfessionCustom;
  delete data.workerNationalityCustom;

  // Resolve providerEntity from select or custom input
  const provSelect = document.getElementById("providerEntitySelect");
  const provCustom = document.getElementById("providerEntityCustom");
  let providerEntityVal = "";
  if (provSelect) {
    if (provSelect.value === "أخرى") {
      providerEntityVal = provCustom ? provCustom.value.trim() : "";
    } else {
      providerEntityVal = (provSelect.value || "").trim();
    }
  }
  data.providerEntity = providerEntityVal;
  delete data.providerEntitySelect;
  delete data.providerEntityCustom;

  // Resolve beneficiaryEntity from select or custom input
  const benSelect = document.getElementById("beneficiaryEntitySelect");
  const benCustom = document.getElementById("beneficiaryEntityCustom");
  let beneficiaryEntityVal = "";
  if (benSelect) {
    if (benSelect.value === "أخرى") {
      beneficiaryEntityVal = benCustom ? benCustom.value.trim() : "";
    } else {
      beneficiaryEntityVal = (benSelect.value || "").trim();
    }
  }
  data.beneficiaryEntity = beneficiaryEntityVal;
  delete data.beneficiaryEntitySelect;
  delete data.beneficiaryEntityCustom;

  // Resolve workLocations from select or custom input
  const locSelect = document.getElementById("workLocationsSelect");
  const locCustom = document.getElementById("workLocationsCustom");
  let workLocationsVal = "";
  if (locSelect) {
    if (locSelect.value === "أخرى") {
      workLocationsVal = locCustom ? locCustom.value.trim() : "";
    } else {
      workLocationsVal = (locSelect.value || "").trim();
    }
  }
  data.workLocations = workLocationsVal;
  delete data.workLocationsSelect;
  delete data.workLocationsCustom;

  if (!data.birthDate || data.birthDate.trim() === "") {
    delete data.birthDate;
  }

  console.log("Birth Date:", data.birthDate);
  console.log("Gender:", data.gender);

  const requiredWorkerFields = [
    { name: "workerName", label: "اسم العامل" },
    { name: "workerProfession", label: "المهنة" },
    { name: "workerIdNumber", label: "رقم الهوية" },
    { name: "workerNationality", label: "الجنسية" },
  ];

  const missingFields = requiredWorkerFields.filter(
    (field) => !data[field.name] || data[field.name].trim() === ""
  );

  if (missingFields.length > 0) {
    const fieldNames = missingFields.map((f) => f.label).join("، ");
    Swal.fire({
      icon: "warning",
      title: "بيانات ناقصة",
      html: `أكمل البيانات:<br><strong>${fieldNames}</strong>`,
      confirmButtonText: "حسناً",
      confirmButtonColor: "#3b82f6",
    });
    return;
  }

  // Handle optional custom contract ID (_id)
  const customIdInput = document.getElementById("customId");
  const customIdVal = customIdInput ? customIdInput.value.trim() : "";
  delete data.customId;

  const isEditing = Boolean(data.id && data.id.trim() !== "");

  if (!isEditing) {
    if (customIdVal) {
      // Check if custom ID already exists in MongoDB
      const exists = typeof StorageManager !== "undefined" && StorageManager.checkIdExists
        ? await StorageManager.checkIdExists(customIdVal)
        : (typeof mongoClient !== "undefined" && mongoClient.checkIdExists
            ? await mongoClient.checkIdExists(customIdVal)
            : await fetch('/api/contracts/check-id/' + encodeURIComponent(customIdVal)).then(r => r.json()).then(r => r.exists).catch(() => false));

      if (exists) {
        Swal.fire({
          icon: "error",
          title: "معرّف العقد موجود مسبقاً",
          html: `المعرّف <code>${escapeHtml(customIdVal)}</code> مسجل لعقد آخر مسبقاً في النظام.<br>يرجى اختيار معرّف آخر أو تركه فارغاً ليقوم النظام بتوليده تلقائياً.`,
          confirmButtonText: "حسناً",
          confirmButtonColor: "#3b82f6",
        });
        return;
      }

      data.id = customIdVal;
      data._id = customIdVal;
      data._isNew = true;
    } else {
      delete data.id;
      delete data._id;
    }
  } else {
    if (customIdVal && customIdVal !== data.id) {
      const exists = typeof StorageManager !== "undefined" && StorageManager.checkIdExists
        ? await StorageManager.checkIdExists(customIdVal)
        : (typeof mongoClient !== "undefined" && mongoClient.checkIdExists
            ? await mongoClient.checkIdExists(customIdVal)
            : await fetch('/api/contracts/check-id/' + encodeURIComponent(customIdVal)).then(r => r.json()).then(r => r.exists).catch(() => false));

      if (exists) {
        Swal.fire({
          icon: "error",
          title: "معرّف العقد الجديد موجود مسبقاً",
          html: `المعرّف <code>${escapeHtml(customIdVal)}</code> مسجل لعقد آخر بالفعل في النظام.`,
          confirmButtonText: "حسناً",
          confirmButtonColor: "#3b82f6",
        });
        return;
      }
      data.newId = customIdVal;
    }
  }

  try {
    const savedContract = await StorageManager.saveContract(data);
    Swal.fire({
      icon: "success",
      title: "تم الحفظ!",
      text: "تم حفظ بيانات العقد بنجاح",
      showConfirmButton: false,
      timer: 1500,
    }).then(() => {
      window.location.href = `/ajeer/contract.html?id=${savedContract.id}`;
    });
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "خطأ",
      text: "حدث خطأ أثناء الحفظ",
      confirmButtonColor: "#3b82f6",
    });
    console.error(error);
  }
}
