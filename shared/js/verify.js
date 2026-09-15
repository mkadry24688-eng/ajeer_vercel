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
function onCaptchaSuccess() {
  const modal = document.getElementById("captchaModal");
  if (modal) {
    modal.style.display = "none";
  }
}

function goHome() {
  window.location.href = "https://ajeer.qiwa.sa/landing/";
}

document.addEventListener("DOMContentLoaded", async () => {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    const modal = document.getElementById("captchaModal");
    if (modal) {
      modal.style.display = "none";
    }
  }

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
    <div class="info-card">
        <div class="card-header">
            معلومات التصريح
        </div>
        <div class="card-content">
            <div class="data-row">
                <span class="label">اسم الموظف</span>
                <span class="value">${contract.workerName || "-"}</span>
            </div>
            <div class="data-row">
                <span class="label">حالة التصريح</span>
                <span class="value">
                    <span class="status-badge ${isBlocked ? "blocked" : ""}">
                        ${isBlocked ? "موقوف" : "ساري"}
                    </span>
                </span>
            </div>
            <div class="data-row">
                <span class="label">تاريخ بداية التصريح</span>
                <span class="value">${formatDate(contract.startDate)}</span>
            </div>
            <div class="data-row">
                <span class="label">تاريخ انتهاء التصريح</span>
                <span class="value">${formatDate(contract.endDate)}</span>
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
                <span class="value">${contract.beneficiaryEntity || "-"}</span>
            </div>
            <div class="data-row">
                <span class="label">رقم المنشأة</span>
                <span class="value">${contract.beneficiaryHrId || "-"}</span>
            </div>
        </div>
    </div>
    <div class="info-card">
        <div class="card-header">
            شركة الاستقدام
        </div>
        <div class="card-content">
            <div class="data-row">
                <span class="label">اسم المنشأة</span>
                <span class="value">${contract.providerEntity || "-"}</span>
            </div>
            <div class="data-row">
                <span class="label">رقم المنشأة</span>
                <span class="value">${contract.providerHrId || "-"}</span>
            </div>
        </div>
    </div>
    <div class="action-btn-container">
        <button class="action-btn" onclick="copyLink()">
            <span>نسخ رابط الصفحة</span>
            <i class="bi bi-link-45deg"></i>
        </button>
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
              <p class="text-muted mt-2">${message}</p>
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
