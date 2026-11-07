// Escape untrusted values only at HTML rendering boundaries.
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const contractId = urlParams.get("id");
  const container = document.getElementById("main-content") || document.getElementById("verifyCardContainer");

  if (!container) return;

  if (!contractId) {
    renderError(container, "لم يتم توفير شناسة عقد للتحقق");
    return;
  }

  try {
    const contract = await StorageManager.getContract(contractId);
    if (!contract) {
      renderError(container, "العقد المطلوب غير موجود أو تم إزالته من النظام");
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = contract.endDate ? new Date(contract.endDate) : null;
    const isExpired = end ? end < today : false;

    if (contract.isBlocked || contract.is_blocked || isExpired) {
      window.location.href = `/ajeer/blocked.html?id=${contract.id}`;
      return;
    }

    renderVerification(container, contract);
  } catch (error) {
    console.error("Verification loading error:", error);
    renderError(container, "تعذر قراءة بيانات العقد في الوقت الحالي");
  }
});

function renderVerification(container, contract) {
  const isBlocked = contract.isBlocked || false;

  container.innerHTML = `
    <div class="verify-container">
      <div class="info-card">
          <div class="card-header d-flex justify-content-between align-items-center">
              <span>معلومات التصريح</span>
              <span class="status-badge ${isBlocked ? "blocked" : ""}">
                  ${isBlocked ? "موقوف / غير فعال" : "ساري / فعال"}
              </span>
          </div>
          <div class="card-content">
              <div class="data-row">
                  <span class="label">اسم الموظف</span>
                  <span class="value">${escapeHtml(contract.workerName || "-")}</span>
              </div>
              <div class="data-row">
                  <span class="label">رقم الهوية / الإقامة</span>
                  <span class="value">${escapeHtml(contract.workerIdNumber || "-")}</span>
              </div>
              <div class="data-row">
                  <span class="label">المهنة</span>
                  <span class="value">${escapeHtml(contract.workerProfession || "-")}</span>
              </div>
              <div class="data-row">
                  <span class="label">تاريخ بداية التصريح</span>
                  <span class="value">${escapeHtml(formatDate(contract.startDate))}</span>
              </div>
              <div class="data-row">
                  <span class="label">تاريخ انتهاء التصريح</span>
                  <span class="value">${escapeHtml(formatDate(contract.endDate))}</span>
              </div>
          </div>
      </div>

      <div class="info-card">
          <div class="card-header">
              المنشأة المستفيدة
          </div>
          <div class="card-content">
              <div class="data-row">
                  <span class="label">اسم المنشأة</span>
                  <span class="value">${escapeHtml(contract.beneficiaryEntity || "-")}</span>
              </div>
              <div class="data-row">
                  <span class="label">رقم المنشأة</span>
                  <span class="value">${escapeHtml(contract.beneficiaryHrId || "-")}</span>
              </div>
          </div>
      </div>

      <div class="info-card">
          <div class="card-header">
              شركة الاستقدام / المزودة
          </div>
          <div class="card-content">
              <div class="data-row">
                  <span class="label">اسم المنشأة</span>
                  <span class="value">${escapeHtml(contract.providerEntity || "-")}</span>
              </div>
              <div class="data-row">
                  <span class="label">رقم المنشأة</span>
                  <span class="value">${escapeHtml(contract.providerHrId || "-")}</span>
              </div>
          </div>
      </div>

      <div class="action-btn-container">
          <button class="action-btn" onclick="copyLink()">
              <span>نسخ رابط الصفحة</span>
              <i class="bi bi-link-45deg"></i>
          </button>
      </div>
    </div>
  `;
}

function renderError(container, message) {
  container.innerHTML = `
    <div class="verify-container">
      <div class="info-card text-center py-5">
          <div class="card-content">
              <i class="bi bi-exclamation-triangle text-danger" style="font-size: 3rem;"></i>
              <h4 class="mt-3 fw-bold text-slate-800">تعذر التحقق من البيانات</h4>
              <p class="text-muted mt-2">${escapeHtml(message)}</p>
          </div>
      </div>
    </div>
  `;
}

function copyLink() {
  navigator.clipboard.writeText(window.location.href).then(() => {
    const btn = document.querySelector(".action-btn");
    if (!btn) return;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span>تم النسخ بنجاح</span> <i class="bi bi-check2"></i>';
    btn.style.backgroundColor = "#22c55e";
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.style.backgroundColor = "#1e3a8a";
    }, 2000);
  });
}
