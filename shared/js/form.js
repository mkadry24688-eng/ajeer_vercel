
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

  if (id) {
    const titleEl = document.getElementById("formTitle");
    if (titleEl) {
      titleEl.innerHTML = '<i class="bi bi-pencil-square"></i><span>تعديل العقد</span>';
    }
    loadContractData(id);
  } else {
    // New contract: prefill with diverse numbers
    generateNewNumbers();
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

  const form = document.getElementById("contractForm");
  if (form) {
    Object.keys(contract).forEach((key) => {
      const input = form.elements[key];
      if (input) {
        input.value = contract[key];
      }
    });

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

  if (!data.birthDate || data.birthDate.trim() === "") {
    delete data.birthDate;
  }
  if (!data.gender || data.gender.trim() === "") {
    delete data.gender;
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

  if (!data.id) delete data.id;

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
