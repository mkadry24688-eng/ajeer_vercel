
const statusBox = document.getElementById("statusBox");

function showStatus(message, isSuccess) {
  if (statusBox) {
    statusBox.className = "status-box " + (isSuccess ? "success" : "error");
    statusBox.innerHTML = `<i class="bi bi-${isSuccess ? "check-circle-fill" : "exclamation-triangle-fill"
      }"></i>${message}`;
  }
}

function onScanSuccess(decodedText, decodedResult) {
  console.log(`تم مسح الكود: ${decodedText}`);

  if (window.html5QrcodeScanner) {
    window.html5QrcodeScanner.clear();
  }

  showStatus("تم مسح الباركود بنجاح! جاري التحويل...", true);

  setTimeout(() => {
    let url = decodedText;
    if (!url.startsWith("http")) {
      url = window.location.origin + url;
    }
    window.location.href = url;
  }, 1500);
}

function onScanFailure(error) {

}

document.addEventListener("DOMContentLoaded", () => {

  window.html5QrcodeScanner = new Html5QrcodeScanner(
    "reader",
    {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      rememberLastUsedCamera: true,
      aspectRatio: 1.0,
      showTorchButtonIfSupported: true,
    },
    false
  );

  window.html5QrcodeScanner.render(onScanSuccess, onScanFailure);

  setTimeout(() => {
    const errorElement = document.querySelector("#reader__status_span");
    if (
      errorElement &&
      errorElement.textContent.includes("NotAllowedError")
    ) {
      showStatus("يرجى السماح بالوصول إلى الكاميرا", false);
    }
  }, 2000);
});
