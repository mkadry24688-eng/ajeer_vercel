// Escape untrusted values only at HTML rendering boundaries.
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}


let currentContract = null;
let currentBarcodeType = "verify";
let contractMode = "ajeer";

function formatDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch (e) {
    return dateStr;
  }
}

function getRealisticBirthDate(idNumber) {
  if (!idNumber) return "1992-05-14";
  const digits = String(idNumber).replace(/\D/g, "");
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum = (sum * 31 + digits.charCodeAt(i)) % 100000;
  }
  const year = 1982 + (sum % 18);
  const month = String(1 + ((sum >> 3) % 12)).padStart(2, "0");
  const day = String(1 + ((sum >> 5) % 28)).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function loadContract(id) {
  currentContract = await StorageManager.getContract(id);
  if (!currentContract) {
    alert("العقد غير موجود");
    window.location.href = "ajeer-dashboard.html";
    return;
  }

  // Auto-block if expired
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = currentContract.endDate ? new Date(currentContract.endDate) : null;
  if (end && end < today && !currentContract.isBlocked) {
    currentContract.isBlocked = true;
    currentContract.is_blocked = true;
    currentContract.blockedReason = "انتهاء مدة العقد";
    try {
      StorageManager.saveContract(currentContract);
    } catch (e) {
      console.error("Auto block save error:", e);
    }
  }

  const contractTypeEl = document.getElementById("data-contractType");
  if (contractTypeEl && currentContract.contractType) {
    if (!currentContract.contractType.includes("تصريح أجير")) {
      if (
        currentContract.contractType.includes("إعارة") ||
        currentContract.contractType.includes("اعارة")
      ) {
        contractTypeEl.innerText = "تصريح أجير – الإعارة";
      } else {
        contractTypeEl.innerText = "تصريح أجير – " + currentContract.contractType;
      }
    } else {
      contractTypeEl.innerText = currentContract.contractType;
    }
  }

  const mobileContractType = document.getElementById("mobile-contract-type");
  if (mobileContractType && currentContract.contractType) {
    if (
      currentContract.contractType.includes("إعارة") ||
      currentContract.contractType.includes("اعارة")
    ) {
      mobileContractType.innerText = "تصريح أجير - الإعارة";
    } else {
      mobileContractType.innerText = currentContract.contractType;
    }
  }

  const isIstiaara =
    currentContract.contractType &&
    (currentContract.contractType.includes("إعارة") ||
      currentContract.contractType.includes("تعاقد إعارة") ||
      currentContract.contractType.includes("استعارة"));
  if (isIstiaara) {
    contractMode = "istiaara";
    const container = document.getElementById("contract-content");
    if (container) container.classList.add("istiaara");
    const modeText = document.getElementById("contract-mode-text");
    if (modeText) modeText.innerText = "إعارة";
    const modeButton = document.querySelector(".btn-toggle-type");
    if (modeButton) modeButton.classList.add("istiaara-btn");
  }

  if (!currentContract.contractNumber || isDummyZeroNumber(currentContract.contractNumber)) {
    const diverseNum = getContractAddNumber(currentContract);
    const digits = diverseNum.replace(/\D/g, "");
    currentContract.contractNumber = "TQ" + digits;
  }

  const contractNumberEl = document.getElementById("data-contractNumber");
  if (contractNumberEl && currentContract.contractNumber) {
    contractNumberEl.innerText = currentContract.contractNumber;
  }

  updateSmartRow(
    "row-workerName",
    "data-workerName",
    "data-workerProfession",
    currentContract.workerName,
    currentContract.workerProfession
  );
  updateSmartRow(
    "row-workerIdNumber",
    "data-workerIdNumber",
    "data-workerNationality",
    currentContract.workerIdNumber,
    currentContract.workerNationality
  );

  updateSmartRow(
    "row-providerEntity",
    "data-providerEntity",
    "data-providerHrId",
    currentContract.providerEntity,
    currentContract.providerHrId
  );

  updateSmartRow(
    "row-beneficiaryEntity",
    "data-beneficiaryEntity",
    "data-beneficiaryHrId",
    currentContract.beneficiaryEntity,
    currentContract.beneficiaryHrId
  );

  updateSmartRow(
    "row-dates",
    "data-startDate",
    "data-endDate",
    currentContract.startDate ? formatDate(currentContract.startDate) : null,
    currentContract.endDate ? formatDate(currentContract.endDate) : null
  );

  updateSmartRowSimple(
    "row-contractSummary",
    "data-contractSummary",
    currentContract.contractSummary
  );

  updateSmartRowSimple(
    "row-workLocations",
    "data-workLocations",
    currentContract.workLocations
  );

  updateBarcodeType(currentBarcodeType);
}

function updateSmartRow(rowId, val1Id, val2Id, val1Data, val2Data) {
  const row = document.getElementById(rowId);
  const el1 = document.getElementById(val1Id);
  const el2 = document.getElementById(val2Id);

  if (!row || !el1 || !el2) return;

  if (!val1Data && !val2Data) {
    row.style.display = "none";
    return;
  }

  row.style.display = "table-row";
  const label1 = el1.previousElementSibling;
  const label2 = el2.previousElementSibling;

  el1.innerText = val1Data || "";
  el2.innerText = val2Data || "";
  el1.colSpan = 1;
  el2.colSpan = 1;
  el1.style.display = "table-cell";
  el2.style.display = "table-cell";
  if (label1) label1.style.display = "table-cell";
  if (label2) label2.style.display = "table-cell";

  if (!val2Data) {
    el2.style.display = "none";
    if (label2) label2.style.display = "none";
    el1.colSpan = 3;
  }

  else if (!val1Data) {
    el1.style.display = "none";
    if (label1) label1.style.display = "none";
    el2.colSpan = 3;
  }

  const table = row.closest("table");
  if (table) table.style.display = "table";
}

function updateSmartRowSimple(rowId, valId, valData) {
  const row = document.getElementById(rowId);
  const el = document.getElementById(valId);
  if (!row || !el) return;

  if (!valData || valData.trim() === "") {
    row.style.display = "none";
    return;
  }

  row.style.display = "table-row";
  el.innerText = valData;

  const table = row.closest("table");
  if (table) table.style.display = "table";
}

function transliterate(text) {
  if (!text) return "-";
  const map = {
    ا: "a", أ: "a", إ: "e", آ: "a", ب: "b", ت: "t", ث: "th",
    ج: "g", ح: "h", خ: "kh", د: "d", ذ: "z", ر: "r", ز: "z",
    س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z", ع: "a",
    غ: "gh", ف: "f", ق: "q", ك: "k", ل: "l", م: "m", ن: "n",
    ه: "h", و: "w", ي: "y", ى: "a", ة: "a", ء: "", ئ: "e", ؤ: "o",
    " ": " ", ـ: ""
  };
  return text.split("").map((c) => map[c] || c).join("");
}

function toggleContractMode() {
  contractMode = contractMode === "ajeer" ? "istiaara" : "ajeer";

  const content = document.getElementById("contract-content");
  const title = document.getElementById("data-contractType");
  const modeText = document.getElementById("contract-mode-text");
  const modeButton = document.querySelector(".btn-toggle-type");

  if (contractMode === "istiaara") {
    if (content) content.classList.add("istiaara");
    if (title) title.innerText = "تصريح أجير – الإعارة";
    if (modeText) modeText.innerText = "إعارة";
    if (modeButton) modeButton.classList.add("istiaara-btn");
  } else {
    if (content) content.classList.remove("istiaara");
    if (title) title.innerText = "تصريح أجير – تعاقد أجير";
    if (modeText) modeText.innerText = "تعاقد أجير";
    if (modeButton) modeButton.classList.remove("istiaara-btn");
  }
}

function isDummyZeroNumber(val) {
  if (!val) return true;
  const str = String(val).trim();
  const digits = str.replace(/\D/g, "");
  if (!digits || digits === "0000001" || digits === "1" || /^0{3,}\d+$/.test(digits) || digits.length < 6) {
    return true;
  }
  return false;
}

function getConsistentDiverseNumber(seedStr = "", prefix = "TW", length = 8) {
  const str = String(seedStr || "ajeer-contract");
  let h1 = 0xdeadbeef, h2 = 0x41c64e6d;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  let num = Math.abs(h1);
  const firstDigit = (num % 8) + 2; // 2-9
  let digits = String(firstDigit);

  let state = Math.abs(h2) || 1234567;
  for (let i = 1; i < length; i++) {
    state = (Math.imul(state, 1103515245) + 12345) & 0x7fffffff;
    digits += (state % 10);
  }
  return `${prefix}${digits}`;
}

function generateRandomDiverseNumber(prefix = "TW", length = 8) {
  const first = Math.floor(Math.random() * 8) + 2; // 2-9
  let digits = String(first);
  for (let i = 1; i < length; i++) {
    digits += Math.floor(Math.random() * 10);
  }
  return `${prefix}${digits}`;
}

function getContractAddNumber(contract) {
  if (!contract) return generateRandomDiverseNumber("TW", 8);

  // 1. Check if contract has explicit addNumber that is not dummy
  if (contract.addNumber && String(contract.addNumber).trim()) {
    const raw = String(contract.addNumber).trim();
    if (!isDummyZeroNumber(raw)) {
      return /^TW/i.test(raw) ? raw : "TW" + raw.replace(/^[A-Za-z]+/, "");
    }
  }
  if (contract.add_number && String(contract.add_number).trim()) {
    const raw = String(contract.add_number).trim();
    if (!isDummyZeroNumber(raw)) {
      return /^TW/i.test(raw) ? raw : "TW" + raw.replace(/^[A-Za-z]+/, "");
    }
  }

  // 2. Check if contract has contractNumber that is not dummy
  if (contract.contractNumber && String(contract.contractNumber).trim()) {
    const raw = String(contract.contractNumber).trim();
    if (!isDummyZeroNumber(raw)) {
      if (/^TW/i.test(raw)) return raw;
      if (/^(WT|TQ)/i.test(raw)) return "TW" + raw.slice(2);
      if (/^[A-Za-z]{2}\d+$/.test(raw)) return "TW" + raw.slice(2);
      const digits = raw.replace(/\D/g, "");
      if (digits.length >= 7) return "TW" + digits.slice(-8);
      return "TW" + digits;
    }
  }

  // 3. If numbers are dummy (e.g. 0000001) or missing, generate a consistent diverse 8-digit number for this contract
  const seed = contract.id || contract.workerIdNumber || contract.workerName || "ajeer-contract";
  const diverseNum = getConsistentDiverseNumber(seed, "TW", 8);
  contract.addNumber = diverseNum;
  return diverseNum;
}

async function promptEditAddNumber() {
  if (!currentContract) return;
  const currentNum = getContractAddNumber(currentContract);

  if (typeof Swal !== "undefined") {
    const result = await Swal.fire({
      title: "رقم التحقق (تحت الباركود)",
      input: "text",
      inputValue: currentNum,
      inputLabel: "يمكنك كتابة رقم مخصص أو توليد رقم جديد متنوع:",
      inputPlaceholder: "مثال: TW78491024",
      showCancelButton: true,
      confirmButtonText: "حفظ الرقم",
      cancelButtonText: "إلغاء",
      showDenyButton: true,
      denyButtonText: "🎲 توليد رقم متنوع",
      denyButtonColor: "#4f46e5",
      confirmButtonColor: "#10b981",
      customClass: {
        popup: 'rounded-4'
      }
    });

    if (result.isDenied) {
      const generated = generateRandomDiverseNumber("TW", 8);
      await applyNewAddNumber(generated);
    } else if (result.isConfirmed && result.value) {
      const inputVal = result.value.trim();
      const finalNum = /^TW/i.test(inputVal) ? inputVal : "TW" + inputVal.replace(/^[A-Za-z]+/, "");
      await applyNewAddNumber(finalNum);
    }
  } else {
    const newNum = prompt("أدخل رقم التحقق الجديد (مثال: TW78491024):", currentNum);
    if (newNum && newNum.trim()) {
      const inputVal = newNum.trim();
      const finalNum = /^TW/i.test(inputVal) ? inputVal : "TW" + inputVal.replace(/^[A-Za-z]+/, "");
      applyNewAddNumber(finalNum);
    }
  }
}

async function applyNewAddNumber(newNum) {
  if (!currentContract) return;
  currentContract.addNumber = newNum;
  currentContract.add_number = newNum;

  // Also sync digits to contractNumber if appropriate
  const digits = newNum.replace(/\D/g, "");
  if (digits && (!currentContract.contractNumber || isDummyZeroNumber(currentContract.contractNumber))) {
    currentContract.contractNumber = "TQ" + digits;
  }

  try {
    if (typeof StorageManager !== "undefined") {
      const contracts = StorageManager.getContractsFromLocal();
      const idx = contracts.findIndex(c => c.id === currentContract.id);
      if (idx !== -1) {
        contracts[idx].addNumber = newNum;
        contracts[idx].contractNumber = currentContract.contractNumber;
        localStorage.setItem(StorageManager.STORAGE_KEY, JSON.stringify(contracts));
      }
      if (typeof StorageManager !== "undefined" && StorageManager.saveContract) {
        await StorageManager.saveContract(currentContract);
      }
    }
  } catch (e) {
    console.error("Error saving updated add number:", e);
  }

  updateContractNumberLabel();
  renderBarcode();

  if (typeof Swal !== "undefined") {
    Swal.fire({
      icon: "success",
      title: "تم تحديث رقم التحقق!",
      text: `الرقم الجديد: ${newNum}`,
      timer: 1500,
      showConfirmButton: false
    });
  }
}

async function promptEditContractNumber() {
  if (!currentContract) return;
  const currentNum = currentContract.contractNumber || "";

  if (typeof Swal !== "undefined") {
    const result = await Swal.fire({
      title: "تعديل رقم العقد",
      input: "text",
      inputValue: currentNum,
      inputLabel: "رقم العقد:",
      inputPlaceholder: "مثال: TQ78491024",
      showCancelButton: true,
      confirmButtonText: "حفظ",
      cancelButtonText: "إلغاء",
      showDenyButton: true,
      denyButtonText: "🎲 توليد رقم متنوع",
      denyButtonColor: "#4f46e5",
      confirmButtonColor: "#10b981",
    });

    if (result.isDenied) {
      const generated = generateRandomDiverseNumber("TQ", 8);
      currentContract.contractNumber = generated;
      applyNewAddNumber("TW" + generated.replace(/\D/g, ""));
    } else if (result.isConfirmed && result.value) {
      currentContract.contractNumber = result.value.trim();
      applyNewAddNumber("TW" + currentContract.contractNumber.replace(/\D/g, ""));
    }
  } else {
    const newNum = prompt("أدخل رقم العقد الجديد:", currentNum);
    if (newNum && newNum.trim()) {
      currentContract.contractNumber = newNum.trim();
      applyNewAddNumber("TW" + currentContract.contractNumber.replace(/\D/g, ""));
    }
  }
}

function updateContractNumberLabel() {
  const contractNumberEl = document.getElementById("data-contractNumber");
  if (!contractNumberEl || !currentContract) return;

  if (currentBarcodeType === "add") {
    const addNum = getContractAddNumber(currentContract);
    contractNumberEl.innerHTML = `
      <div class="add-barcode-number" title="انقر لتعديل أو توليد رقم التحقق" style="cursor: pointer;" onclick="promptEditAddNumber()">${escapeHtml(addNum)}</div>
      <div class="add-barcode-subtext">امسح للتحقق</div>
    `;
  } else {
    contractNumberEl.innerText = currentContract.contractNumber || "";
    contractNumberEl.title = "انقر لتعديل رقم العقد";
    contractNumberEl.style.cursor = "pointer";
    contractNumberEl.onclick = promptEditContractNumber;
  }
}

function applyVerifyLayout(type) {
  const page = document.getElementById("contract-page");
  if (!page) return;
  page.classList.remove("barcode-verify", "barcode-add");
  if (type === "verify" || type === "data") {
    page.classList.add("barcode-verify");
  } else if (type === "add") {
    page.classList.add("barcode-add");
  }
}

function updateBarcodeType(type) {
  currentBarcodeType = type;

  const addStyle = document.getElementById("addContractStyle");
  if (addStyle) {
    addStyle.disabled = false;
  }

  applyVerifyLayout(type);
  updateContractNumberLabel();
  renderBarcode();
}

function toggleMobileBarcode() {
  currentBarcodeType = currentBarcodeType === "verify" ? "data" : (currentBarcodeType === "data" ? "add" : "verify");

  const label = document.getElementById("mobile-barcode-label");
  if (label) {
    if (currentBarcodeType === "verify") label.innerText = "تغيير إلى البيانات";
    else if (currentBarcodeType === "data") label.innerText = "تغيير إلى الملحق";
    else label.innerText = "تغيير إلى التحقق";
  }

  const addStyle = document.getElementById("addContractStyle");
  if (addStyle) {
    addStyle.disabled = false;
  }

  applyVerifyLayout(currentBarcodeType);
  updateContractNumberLabel();
  renderBarcode();

  const selector = document.getElementById("barcodeType");
  if (selector) selector.value = currentBarcodeType;
}

function generateJWT(contract) {
  const header = { typ: "JWT", alg: "HS256" };
  const startAt = contract.startDate ? formatDate(contract.startDate) : "";
  const endAt = contract.endDate ? formatDate(contract.endDate) : "";

  const payload = {
    service: "tempwork",
    id: contract.id,
    iat: Math.floor(Date.now() / 1000),
    status: contract.isBlocked ? "invalid" : "valid",
    start_at: startAt,
    end_at: endAt
  };

  const base64UrlEncode = (obj) => {
    const str = JSON.stringify(obj);
    const base64 = btoa(unescape(encodeURIComponent(str)));
    return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  };

  const headerEncoded = base64UrlEncode(header);
  const payloadEncoded = base64UrlEncode(payload);
  const signature = "4_JmiQOTZYu_sG6IgurUvNJmUaIzS9NZKkvvW_sJmSc";

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

function renderBarcode() {
  if (!currentContract) return;

  const container = document.getElementById("qrcode-display");
  if (!container) return;

  const additionalRow = document.getElementById("row-birthDate");
  const birthDateEl = document.getElementById("data-birthDate");
  const permitTypeEl = document.getElementById("data-permitType");

  if (additionalRow) {
    additionalRow.style.display = "none";
  }

  container.innerHTML = "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = currentContract.endDate ? new Date(currentContract.endDate) : null;
  const isExpired = end ? end < today : false;
  const isBlocked = currentContract.isBlocked || currentContract.is_blocked || isExpired;
  const addNumber = getContractAddNumber(currentContract);
  const workerName = currentContract.workerName || "";
  const qrRedirectBase = "https://mkadry24688-eng.github.io/view/";

  const createQrRedirectUrl = (type = "", includeDetails = true) => {
    const url = new URL(qrRedirectBase);

    url.searchParams.set("id", currentContract.id);

    if (type) {
      url.searchParams.set("type", type);
    }

    if (includeDetails) {
      url.searchParams.set("num", addNumber);

      if (workerName) {
        url.searchParams.set("ref", workerName);
      }
    }

    if (currentContract.gender) {
      url.searchParams.set("gender", currentContract.gender);
    }

    return url.href;
  };

  const verifyUrl = createQrRedirectUrl();
  const blockedUrl = createQrRedirectUrl("blocked", false);

  let status = isBlocked ? "موقوف" : "ساري";

  let dataText;
  if (isBlocked) {
    dataText = "https://wa.me/966596759390";
  } else {
    dataText = "{" +
      `"id_number":"${currentContract.workerIdNumber || ""}", ` +
      `"occupation":"${currentContract.workerProfession || ""}", ` +
      `"status":"${status}", ` +
      `"issue_date":"${currentContract.startDate ? formatDate(currentContract.startDate) : ""}", ` +
      `"expiry_date":"${currentContract.endDate ? formatDate(currentContract.endDate) : ""}"`;

    if (currentBarcodeType === "add") {
      const bDate = currentContract.birthDate
        ? formatDate(currentContract.birthDate)
        : getRealisticBirthDate(currentContract.workerIdNumber);
      const gndr =
        currentContract.gender && String(currentContract.gender).trim() !== ""
          ? currentContract.gender
          : "ذكر";
      dataText +=
        `, "add_number":"${addNumber}", ` +
        `"birth_date":"${bDate}", ` +
        `"gender":"${gndr}", ` +
        `"contract_type":"تصريح إعارة أجير", ` +
        `"permit_type":"تصريح إعارة أجير"`;
    }
    dataText += "}";
  }

  let qrData;
  const eccParam = currentBarcodeType === "add" ? "H" : "M";
  let targetUrl = "";
  if (currentBarcodeType === "add") {
    const blockedReason = currentContract.blockedReason || currentContract.blocked_reason;
    const isManuallyBlocked = (currentContract.isBlocked || currentContract.is_blocked)
      && !(isExpired && blockedReason === "انتهاء مدة العقد");
    qrData = isManuallyBlocked
      ? createQrRedirectUrl("blocked", false)
      : createQrRedirectUrl("additional");
    targetUrl = qrData;
  } else if (currentBarcodeType === "verify") {
    qrData = isBlocked ? blockedUrl : verifyUrl;
    targetUrl = qrData;
  } else {
    qrData = dataText;
  }

  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&ecc=${eccParam}&data=${encodeURIComponent(qrData)}`;
  const qrImage = document.createElement("img");
  qrImage.src = qrImgUrl;
  qrImage.alt = "QR Code";
  container.replaceChildren(qrImage);
  if (currentBarcodeType === "verify" || currentBarcodeType === "add") {
    const url = new URL(targetUrl, window.location.origin);
    if (["http:", "https:"].includes(url.protocol)) {
      const link = document.createElement("a");
      link.href = url.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.style.cssText = "cursor: pointer; display: block; height: 100%;";
      link.appendChild(qrImage);
      container.replaceChildren(link);
    }
  }

  const img = container.querySelector("img");
  if (img) {
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.imageRendering = "pixelated";
  }
}

async function downloadPDF(evt) {
  const workerName = currentContract?.workerName || "عقد";
  const element = document.getElementById("contract-page");
  if (!element) return;

  const targetBtn = evt ? evt.target.closest("button") : (window.event ? window.event.target.closest("button") : null);
  const originalText = targetBtn ? targetBtn.innerHTML : "";
  if (targetBtn) {
    targetBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> جاري التحميل...';
    targetBtn.disabled = true;
  }

  const actionButtons = document.querySelector(".action-buttons");
  if (actionButtons) actionButtons.style.display = "none";

  try {
    const qrLink = document.querySelector("#qrcode-display a");
    const footerLink = document.querySelector(".footer a");
    const qrUrl = qrLink ? qrLink.href : null;
    const footerUrl = footerLink ? footerLink.href : null;

    await document.fonts.ready;

    const oldWidth = element.style.width;
    const oldMargin = element.style.margin;

    element.style.width = "210mm";
    element.style.margin = "0 auto";

    await new Promise((resolve) => setTimeout(resolve, 100));

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: element.scrollWidth,
      windowWidth: 1200,
      onclone: (clonedDoc) => {
        const clonedElement = clonedDoc.getElementById("contract-page");
        if (clonedElement) {
          clonedElement.style.width = "210mm";
          clonedElement.style.margin = "0 auto";
          clonedElement.style.direction = "rtl";
          clonedElement.style.fontFamily = "'Cairo', sans-serif";
        }
        const allElements = clonedDoc.querySelectorAll("#contract-page *");
        allElements.forEach((el) => {
          if (!el.classList.contains("contract-number")) {
            el.style.letterSpacing = "0";
            el.style.wordSpacing = "normal";
          }
        });
      },
    });

    const { jsPDF } = window.jspdf;
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const margin = 5;

    const destWidth = 210 - margin * 2;
    const destHeight = imgHeight * (destWidth / 210);
    const pageHeight = Math.max(297, destHeight + 10);

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [210, pageHeight],
      compress: true,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.98);

    pdf.addImage(imgData, "JPEG", margin, margin, destWidth, destHeight);

    canvas.width = 0;
    canvas.height = 0;

    if (qrUrl && qrLink) {
      const qrRect = qrLink.getBoundingClientRect();
      const containerRect = element.getBoundingClientRect();
      const scale = destWidth / containerRect.width;
      pdf.link(
        margin + (qrRect.left - containerRect.left) * scale,
        margin + (qrRect.top - containerRect.top) * scale,
        qrRect.width * scale,
        qrRect.height * scale,
        { url: qrUrl }
      );
    }

    if (footerUrl && footerLink) {
      const linkRect = footerLink.getBoundingClientRect();
      const containerRect = element.getBoundingClientRect();
      const scale = destWidth / containerRect.width;
      pdf.link(
        margin + (linkRect.left - containerRect.left) * scale,
        margin + (linkRect.top - containerRect.top) * scale,
        linkRect.width * scale,
        linkRect.height * scale,
        { url: footerUrl }
      );
    }

    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      const blob = pdf.output('blob');
      const newBlob = new Blob([blob], { type: 'application/octet-stream' });
      const blobUrl = URL.createObjectURL(newBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${workerName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } else {
      pdf.save(`${workerName}.pdf`);
    }
    element.style.width = oldWidth;
    element.style.margin = oldMargin;
  } catch (error) {
    console.error("PDF generation error:", error);
    alert("حدث خطأ أثناء إنشاء ملف PDF");
  } finally {
    if (targetBtn) {
      targetBtn.innerHTML = originalText;
      targetBtn.disabled = false;
    }
    if (actionButtons) actionButtons.style.display = "";
  }
}

async function downloadAddPDF(evt) {
  const workerName = currentContract?.workerName || "عقد";
  const element = document.getElementById("contract-page");
  if (!element) return;

  const targetBtn = evt ? evt.target.closest("button") : (window.event ? window.event.target.closest("button") : null);
  const originalText = targetBtn ? targetBtn.innerHTML : "";
  if (targetBtn) {
    targetBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> جاري التحميل...';
    targetBtn.disabled = true;
  }

  const actionButtons = document.querySelector(".action-buttons");
  if (actionButtons) actionButtons.style.display = "none";

  try {
    const qrLink = document.querySelector("#qrcode-display a");
    const footerLink = document.querySelector(".footer a");
    const qrUrl = qrLink ? qrLink.href : null;
    const footerUrl = footerLink ? footerLink.href : null;

    await document.fonts.ready;

    const pageWidth = 210;
    const marginLeft = 14;
    const marginRight = 11;
    const contentWidth = pageWidth - marginLeft - marginRight;

    const oldWidth = element.style.width;
    const oldMargin = element.style.margin;

    element.style.width = `${contentWidth}mm`;
    element.style.margin = "0 auto";

    await new Promise((resolve) => setTimeout(resolve, 100));

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: element.scrollWidth,
      windowWidth: 1200,
      onclone: (clonedDoc) => {
        const clonedElement = clonedDoc.getElementById("contract-page");
        if (clonedElement) {
          clonedElement.style.width = `${contentWidth}mm`;
          clonedElement.style.margin = "0 auto";
          clonedElement.style.direction = "rtl";
        }
        const allElements = clonedDoc.querySelectorAll("#contract-page *");
        allElements.forEach((el) => {
          if (!el.classList.contains("contract-number")) {
            el.style.letterSpacing = "0";
            el.style.wordSpacing = "normal";
          }
        });
      },
    });

    const { jsPDF } = window.jspdf;
    const imgData = canvas.toDataURL("image/jpeg", 0.98);

    const finalWidth = contentWidth;
    const finalHeight = (canvas.height * finalWidth) / canvas.width;
    const pageHeight = finalHeight + 7;

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [210, pageHeight],
      compress: true,
    });

    pdf.addImage(imgData, "JPEG", marginLeft, 5, finalWidth, finalHeight);

    canvas.width = 0;
    canvas.height = 0;

    if (qrUrl && qrLink) {
      const qrRect = qrLink.getBoundingClientRect();
      const containerRect = element.getBoundingClientRect();
      const scale = finalWidth / containerRect.width;
      pdf.link(
        marginLeft + (qrRect.left - containerRect.left) * scale,
        5 + (qrRect.top - containerRect.top) * scale,
        qrRect.width * scale,
        qrRect.height * scale,
        { url: qrUrl }
      );
    }

    if (footerUrl && footerLink) {
      const linkRect = footerLink.getBoundingClientRect();
      const containerRect = element.getBoundingClientRect();
      const scale = finalWidth / containerRect.width;
      pdf.link(
        marginLeft + (linkRect.left - containerRect.left) * scale,
        5 + (linkRect.top - containerRect.top) * scale,
        linkRect.width * scale,
        linkRect.height * scale,
        { url: footerUrl }
      );
    }

    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      const blob = pdf.output('blob');
      const newBlob = new Blob([blob], { type: 'application/octet-stream' });
      const blobUrl = URL.createObjectURL(newBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${workerName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } else {
      pdf.save(`${workerName}.pdf`);
    }
    element.style.width = oldWidth;
    element.style.margin = oldMargin;
  } catch (error) {
    console.error("PDF generation error:", error);
    alert("حدث خطأ أثناء إنشاء ملف PDF");
  } finally {
    if (targetBtn) {
      targetBtn.innerHTML = originalText;
      targetBtn.disabled = false;
    }
    if (actionButtons) actionButtons.style.display = "";
  }
}

function handlePDFDownload(event) {
  if (currentBarcodeType === "add" || currentBarcodeType === "verify") {
    downloadAddPDF(event);
  } else {
    downloadPDF(event);
  }
}

window.updateBarcodeType = updateBarcodeType;
window.toggleMobileBarcode = toggleMobileBarcode;
window.toggleContractMode = toggleContractMode;
window.handlePDFDownload = handlePDFDownload;
window.promptEditAddNumber = promptEditAddNumber;
window.promptEditContractNumber = promptEditContractNumber;
window.generateRandomDiverseNumber = generateRandomDiverseNumber;

document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");

  if (id) {
    loadContract(id);
  } else {
    alert("لا يوجد عقد محدد");
    window.location.href = "ajeer-dashboard.html";
  }

  const barcodeSelector = document.getElementById("barcodeType") || document.getElementById("barcode-selector");
  if (barcodeSelector) {
    barcodeSelector.addEventListener("change", (e) => {
      updateBarcodeType(e.target.value);
    });
  }
});

