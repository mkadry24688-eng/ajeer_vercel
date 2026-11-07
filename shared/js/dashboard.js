// Escape untrusted values only at HTML rendering boundaries.
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}


let cachedContracts = [];
let displayedLimit = 24;
let currentlyRenderedCount = 0;

function setGreeting() {
  const hour = new Date().getHours();
  const greetingEl = document.getElementById("greetingMessage");
  if (!greetingEl) return;
  const iconEl = greetingEl.querySelector(".greeting-icon");
  const textEl = greetingEl.querySelector(".greeting-text");

  let greeting, icon;

  if (hour >= 5 && hour < 12) {
    greeting = "صباح الخير";
    icon = "☀️";
  } else if (hour >= 12 && hour < 17) {
    greeting = "مساء الورد";
    icon = "🌸";
  } else if (hour >= 17 && hour < 21) {
    greeting = "مساء الورد";
    icon = "🌹";
  } else {
    greeting = "مساء النور";
    icon = "🌙";
  }

  if (iconEl) iconEl.textContent = icon;
  if (textEl) textEl.textContent = greeting;
}

document.addEventListener('mouseover', function(e) {
  const tooltipTrigger = e.target.closest('[data-bs-toggle="tooltip"]');
  if (tooltipTrigger && !bootstrap.Tooltip.getInstance(tooltipTrigger)) {
    new bootstrap.Tooltip(tooltipTrigger).show();
  }
});

async function loadDashboard() {
  try {
    const contracts = await StorageManager.getContracts(true);
    cachedContracts = contracts;

    await renderCards(contracts);
    await updateStats(contracts);

    autoBlockExpiredContracts(contracts).then(async (didUpdate) => {
      if (didUpdate) {
        const freshContracts = await StorageManager.getContracts(true);
        cachedContracts = freshContracts;
        await renderCards(freshContracts);
        await updateStats(freshContracts);
      }
    });
  } catch (error) {
    console.error("Error loading dashboard:", error);
  }
}

function createContractCardElement(contract, index, isNewBatch = false) {
  const isBlocked = contract.isBlocked || false;
  const contractType = contract.contractType || "تعاقد أجير";
  const isAjeer = contractType === "تعاقد أجير";
  const themeColor = isAjeer ? "primary" : "info";

  const col = document.createElement("div");
  col.className = "col-12 col-md-6 col-lg-3 d-flex pb-3";
  if (isNewBatch) {
    col.style.animation = `fadeInUp 0.15s ease-out forwards`;
  } else {
    const animDelay = Math.min((index % 24) * 0.015, 0.15);
    col.style.animation = `fadeInUp 0.2s ease-out ${animDelay}s forwards`;
  }
  col.style.opacity = "0";

  col.innerHTML = `
    <div class="card data-card border-top-${themeColor} w-100 border-0">
        <div class="card-inner">

            <div class="d-flex justify-content-between align-items-center mb-3">
                <span class="badge-custom bg-${themeColor}-soft">
                    ${escapeHtml(contractType)}
                </span>
                ${
                  isBlocked
                    ? '<span class="badge-custom bg-danger-soft">موقوف</span>'
                    : '<span class="badge-custom bg-success-soft">نشط</span>'
                }
            </div>

            <div class="text-center mb-3">
                <div class="avatar-wrapper">
                    <div class="avatar-ring"></div>
                    <div class="avatar avatar-xl bg-white rounded-circle d-flex align-items-center justify-content-center mx-auto shadow-sm card-avatar-box">
                        <i class="bi bi-person-fill text-slate-300 card-avatar-icon"></i>
                    </div>
                    ${!isBlocked ? '<div class="position-absolute translate-middle bg-white rounded-circle shadow border d-flex align-items-center justify-content-center card-verified-badge"><i class="bi bi-patch-check-fill card-verified-icon"></i></div>' : ""}
                </div>

                <h4 class="fw-bold text-slate-900 mb-1 card-worker-title">${escapeHtml(contract.workerName || "-")}</h4>
                <span class="badge-id card-badge-id">
                    <i class="bi bi-hash me-1"></i>${escapeHtml(contract.contractNumber || "-")}
                </span>
            </div>

            <div class="info-grid">
                <div class="info-item">
                    <div class="info-icon">
                        <i class="bi bi-building"></i>
                    </div>
                    <div class="overflow-hidden">
                        <small class="d-block text-slate-400 fw-bold mb-0.5 card-info-label">المنشأة المستفيدة</small>
                        <div class="fw-bold text-slate-800 text-truncate card-info-val">${escapeHtml(contract.beneficiaryEntity || "-")}</div>
                    </div>
                </div>

                <div class="d-flex gap-2 mt-1">
                    <div class="info-item flex-grow-1 mb-0 p-2">
                        <div class="text-center w-100">
                            <small class="d-block text-slate-400 fw-bold mb-0.5 card-info-label">بداية العقد</small>
                            <div class="fw-bold text-slate-700 card-info-date">${escapeHtml(formatDate(contract.startDate))}</div>
                        </div>
                    </div>
                    <div class="info-item flex-grow-1 mb-0 p-2">
                        <div class="text-center w-100">
                            <small class="d-block text-slate-400 fw-bold mb-0.5 card-info-label">نهاية العقد</small>
                            <div class="fw-bold text-slate-700 card-info-date">${escapeHtml(formatDate(contract.endDate))}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="d-flex align-items-center gap-2 mt-auto pt-3">
                <a href="/ajeer/contract.html?id=${escapeHtml(encodeURIComponent(contract.id))}" class="btn btn-card-action ${isAjeer ? 'bg-primary-gradient' : 'bg-info-gradient'} flex-grow-1 d-flex align-items-center justify-content-center gap-1 btn-card-details">
                    <span>التفاصيل</span>
                    <i class="bi bi-arrow-left"></i>
                </a>

                <div class="d-flex gap-1.5">
                    <a href="/ajeer/form.html?id=${escapeHtml(encodeURIComponent(contract.id))}" class="micro-btn micro-btn-blue shadow-sm" data-bs-toggle="tooltip" title="تعديل">
                        <i class="bi bi-pencil-square"></i>
                    </a>

                    <button data-action="toggle" class="micro-btn ${isBlocked ? "micro-btn-emerald" : "micro-btn-amber"} shadow-sm" data-bs-toggle="tooltip" title="${isBlocked ? "تفعيل" : "إيقاف"}">
                        <i class="bi ${isBlocked ? "bi-unlock" : "bi-lock"}"></i>
                    </button>

                    <button data-action="delete" class="micro-btn micro-btn-rose shadow-sm" data-bs-toggle="tooltip" title="حذف">
                        <i class="bi bi-trash3"></i>
                    </button>
                </div>
            </div>

        </div>
    </div>
  `;

  const toggle = col.querySelector('[data-action="toggle"]');
  toggle.onclick = () => toggleBlock(contract.id, Boolean(contract.isBlocked), toggle);
  col.querySelector('[data-action="delete"]').onclick = () => confirmDelete(contract.id);
  return col;
}

async function renderCards(contractsList = null, searchTerm = "", typeFilter = "", isAppend = false) {
  let contracts = contractsList;
  if (!contracts) {
    contracts = cachedContracts.length > 0 ? cachedContracts : await StorageManager.getContracts();
  }
  cachedContracts = contracts;

  const grid = document.getElementById("contractsGrid");
  const emptyState = document.getElementById("emptyState");

  const filtered = contracts.filter((c) => {
    const matchesSearch = !searchTerm || [
      c.workerName, c.workerIdNumber,
      c.providerEntity, c.providerHrId,
      c.beneficiaryEntity, c.beneficiaryHrId,
    ].some(value => String(value ?? "").toLowerCase().includes(searchTerm));
    const contractType = c.contractType || "تعاقد أجير";
    const matchesType = !typeFilter || contractType === typeFilter;
    return matchesSearch && matchesType;
  });

  if (filtered.length === 0) {
    grid.innerHTML = "";
    currentlyRenderedCount = 0;
    grid.classList.add("d-none");
    emptyState.classList.remove("d-none");
    removeShowMoreButton();
    return;
  }

  grid.classList.remove("d-none");
  emptyState.classList.add("d-none");

  if (!isAppend) {
    grid.innerHTML = "";
    currentlyRenderedCount = 0;
  }

  const contractsToRender = filtered.slice(currentlyRenderedCount, displayedLimit);

  contractsToRender.forEach((contract, index) => {
    const col = createContractCardElement(contract, currentlyRenderedCount + index, isAppend);
    grid.appendChild(col);
  });

  currentlyRenderedCount = Math.min(displayedLimit, filtered.length);

  if (filtered.length > displayedLimit) {
    renderShowMoreButton(filtered.length);
  } else {
    removeShowMoreButton();
  }
}

function renderShowMoreButton(totalCount) {
  let showMoreContainer = document.getElementById("showMoreContainer");
  if (!showMoreContainer) {
    showMoreContainer = document.createElement("div");
    showMoreContainer.id = "showMoreContainer";
    showMoreContainer.className = "text-center my-5 fade-up-effect";
    showMoreContainer.innerHTML = `
      <button id="showMoreBtn" onclick="handleShowMore()" class="btn btn-outline-primary btn-lg rounded-pill px-5 shadow-sm">
        <i class="bi bi-arrow-down-short fs-5"></i>
        <span>عرض المزيد من العقود</span>
      </button>
    `;
    const contractsContent = document.getElementById("contractsContent");
    contractsContent.appendChild(showMoreContainer);
  }
}

function removeShowMoreButton() {
  const showMoreContainer = document.getElementById("showMoreContainer");
  if (showMoreContainer) {
    showMoreContainer.remove();
  }
}

function handleShowMore() {
  displayedLimit += 24;
  applyFilters(true);
}

function applyFilters(isAppend = false) {
  const searchTerm = document.getElementById("searchInput").value.trim().toLowerCase();
  const typeFilter = document.getElementById("filterType").value;
  renderCards(null, searchTerm, typeFilter, isAppend);
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    const Toast = Swal.mixin({
      toast: true,
      position: "bottom-end",
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: false,
    });
    Toast.fire({
      icon: "success",
      title: "تم نسخ رقم العقد",
    });
  });
}

async function updateStats(contractsList = null) {
  let contracts = contractsList;
  if (!contracts) {
    contracts = cachedContracts.length > 0 ? cachedContracts : await StorageManager.getContracts(true);
  }
  cachedContracts = contracts;

  const total = contracts.length;
  const active = contracts.filter((c) => !c.isBlocked).length;

  let ajeerCount = 0;
  let loanCount = 0;

  contracts.forEach((c) => {
    const type = c.contractType || "تعاقد أجير";
    if (type === "تعاقد أجير") {
      ajeerCount++;
    } else if (
      type === "إعارة" ||
      type === "تعاقد إعارة" ||
      type === "استعارة"
    ) {
      loanCount++;
    }
  });

  animateValue("stat-total", 0, total, 500);
  animateValue("stat-active", 0, active, 500);
  animateValue("stat-ajeer", 0, ajeerCount, 500);
  animateValue("stat-loan", 0, loanCount, 500);
}

function animateValue(id, start, end, duration) {
  const obj = document.getElementById(id);
  if (!obj) return;
  const range = end - start;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const currentVal = Math.floor(start + range * easeOut);
    obj.textContent = (progress >= 1 ? end : currentVal).toLocaleString('en-US');

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  requestAnimationFrame(update);
}

async function toggleBlock(id, currentBlockState, button) {

  if (button) {
    const newState = !currentBlockState;
    button.onclick = () => toggleBlock(id, newState, button);
    button.className = `micro-btn ${newState ? "micro-btn-emerald" : "micro-btn-amber"} shadow-sm`;
    button.setAttribute("title", newState ? "تفعيل" : "إيقاف");
    button.innerHTML = `<i class="bi ${newState ? "bi-unlock" : "bi-lock"}"></i>`;

    const card = button.closest(".card");
    if (card) {
      const badges = card.querySelectorAll(".badge-custom");
      const statusBadge = badges[badges.length - 1];

      if (statusBadge) {
        statusBadge.textContent = newState ? "موقوف" : "نشط";
        statusBadge.className = `badge-custom ${
          newState ? "bg-danger-soft text-danger" : "bg-success-soft text-success"
        }`;
      }
    }
  }

  try {
    const contract = await StorageManager.getContract(id);
    contract.isBlocked = !currentBlockState;
    await StorageManager.saveContract(contract);

    const index = cachedContracts.findIndex((c) => c.id === id);
    if (index !== -1) {
      cachedContracts[index].isBlocked = contract.isBlocked;
    }
  } catch (error) {
    console.error("Error updating contract:", error);
    await loadDashboard();
  }
}

async function confirmDelete(id) {
  Swal.fire({
    title: "هل أنت متأكد؟",
    text: "لن تتمكن من التراجع عن هذا!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#64748b",
    confirmButtonText: '<i class="bi bi-trash ms-1"></i> نعم، حذف',
    cancelButtonText: '<i class="bi bi-x-lg ms-1"></i> إلغاء',
  }).then(async (result) => {
    if (result.isConfirmed) {
      await StorageManager.deleteContract(id);
      cachedContracts = cachedContracts.filter((c) => c.id !== id);
      await loadDashboard();
      Swal.fire({
        icon: "success",
        title: "تم الحذف!",
        text: "تم حذف العقد بنجاح.",
        showConfirmButton: false,
        timer: 1500,
      });
    }
  });
}

async function backupContracts() {
  const btn = document.getElementById("backupBtn");
  btn.disabled = true;
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> جاري التصدير...';

  try {
    const { blob, count, filename } = await StorageManager.backupDatabase();
    const url = URL.createObjectURL(blob);
    const content = document.createElement("div");
    const description = document.createElement("p");
    description.className = "backup-dialog__description";
    description.textContent = "النسخة الاحتياطية جاهزة للتنزيل";
    const details = document.createElement("p");
    details.className = "backup-dialog__details";
    details.textContent = new Intl.NumberFormat("ar").format(count) + " عقد";
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.className = "btn btn-primary backup-dialog__download";
    downloadLink.textContent = "تنزيل ملف النسخة الاحتياطية";
    content.append(description, details, downloadLink);

    try {
      await Swal.fire({
        title: "النسخ الاحتياطي",
        html: content,
        customClass: { popup: "backup-dialog" },
        width: "min(400px, calc(100vw - 32px))",
        showConfirmButton: false,
        showCloseButton: true,
        closeButtonAriaLabel: "إغلاق",
      });
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "خطأ في التصدير",
      text: "حدث خطأ أثناء إنشاء النسخة الاحتياطية. الرجاء المحاولة مجدداً.",
      confirmButtonColor: "#0d6efd",
    });
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

async function importContracts() {
  const confirm = await Swal.fire({
    title: "استيراد البيانات",
    html: 'سيتم استيراد العقود من ملف النسخة الاحتياطية.<br><small class="text-muted">العقود الموجودة مسبقاً لن تتكرر وسيتم تخطيها.</small>',
    icon: "info",
    showCancelButton: true,
    confirmButtonText: "اختر الملف",
    cancelButtonText: "إلغاء",
    confirmButtonColor: "#198754",
  });

  if (!confirm.isConfirmed) return;

  const btn = document.getElementById("importBtn");
  btn.disabled = true;
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> جاري الاستيراد...';

  try {
    const result = await StorageManager.importDatabase();
    await loadDashboard();
    Swal.fire({
      icon: "success",
      title: "تم الاستيراد بنجاح!",
      html: `تم إضافة <strong>${escapeHtml(result.imported)}</strong> عقد جديد.<br>تم تخطي <strong>${escapeHtml(result.skipped)}</strong> عقد موجودة مسبقاً.`,
      confirmButtonColor: "#198754",
    });
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "خطأ في الاستيراد",
      text: error.message || "حدث خطأ أثناء قراءة الملف.",
      confirmButtonColor: "#0d6efd",
    });
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setGreeting();
  loadDashboard();

  window.addEventListener("contracts-synced", async (e) => {
    cachedContracts = e.detail;
    await renderCards(e.detail);
    await updateStats(e.detail);
  });

  let searchTimeout;
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        displayedLimit = 24;
        applyFilters();
      }, 300);
    });
  }

  const filterType = document.getElementById("filterType");
  if (filterType) {
    filterType.addEventListener("change", () => {
      displayedLimit = 24;
      applyFilters();
    });
  }

  window.addEventListener("scroll", () => {
    const navbar = document.querySelector(".navbar");
    if (navbar) {
      if (window.scrollY > 10) {
        navbar.classList.add("scrolled");
      } else {
        navbar.classList.remove("scrolled");
      }
    }
  });
});
