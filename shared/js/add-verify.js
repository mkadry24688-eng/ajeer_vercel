document.addEventListener("DOMContentLoaded", async function () {
  const params = new URLSearchParams(window.location.search);

  let dataParam = params.get("data");
  let contractId = params.get("id");
  let usingLocalCopy = false;
  if (contractId) {
    try {
      let contract = null;
      let lookupFailed = false;
      try {
        if (typeof mongoClient !== "undefined" && mongoClient.getContract) {
          contract = await mongoClient.getContract(contractId);
        } else {
          const res = await fetch('/api/contracts/' + encodeURIComponent(contractId));
          if (res.ok) contract = await res.json();
          else if (res.status !== 404) lookupFailed = true;
        }
      } catch (error) {
        lookupFailed = true;
        console.error("Error fetching contract:", error);
      }

      let localContract = null;
      try {
        if (typeof StorageManager !== "undefined" && StorageManager.getContractFromLocal) {
          localContract = StorageManager.getContractFromLocal(contractId);
        }
        if (!localContract) {
          const raw = localStorage.getItem("ajeer_contracts");
          if (raw) {
            const list = JSON.parse(raw);
            localContract = list.find((c) => c.id === contractId);
          }
        }
      } catch (e) {
        console.error("Local storage lookup error:", e);
      }

      if (!contract && localContract) {
        usingLocalCopy = lookupFailed;
        contract = {
          id: localContract.id,
          contract_number: localContract.contractNumber || localContract.contract_number,
          add_number: localContract.addNumber || localContract.add_number,
          contract_type: localContract.contractType || localContract.contract_type,
          worker_name: localContract.workerName || localContract.worker_name,
          worker_profession: localContract.workerProfession || localContract.worker_profession,
          worker_id_number: localContract.workerIdNumber || localContract.worker_id_number,
          worker_nationality: localContract.workerNationality || localContract.worker_nationality,
          birth_date: localContract.birthDate || localContract.birth_date,
          gender: localContract.gender,
          provider_entity: localContract.providerEntity || localContract.provider_entity,
          provider_hr_id: localContract.providerHrId || localContract.provider_hr_id,
          start_date: localContract.startDate || localContract.start_date,
          end_date: localContract.endDate || localContract.end_date,
          blocked_reason: localContract.blockedReason || localContract.blocked_reason,
          is_blocked: localContract.isBlocked || localContract.is_blocked
        };
      }

      if (!contract) {
        console.error("Contract not found:", contractId);
        showError(lookupFailed ? "خدمة التحقق غير متاحة حاليًا. حاول مرة أخرى لاحقًا." : undefined);
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = contract.end_date ? new Date(contract.end_date) : null;
      const isExpired = end ? end < today : false;

      const blockedReason = contract.blocked_reason || contract.blockedReason;
      const isManuallyBlocked = (contract.is_blocked || contract.isBlocked)
        && !(isExpired && blockedReason === "انتهاء مدة العقد");
      if (isManuallyBlocked && !usingLocalCopy) {
        window.location.href = `/ajeer/blocked.html?id=${contractId}`;
        return;
      }

      const numFromParam = params.get("num");
      const permitNum =
        numFromParam ||
        contract.add_number ||
        (contract.contract_number
          ? "TW" + String(contract.contract_number).replace(/^[A-Za-z]+/, "")
          : "");

      const dobFromParam = params.get("dob") || params.get("birth_date") || params.get("birthDate");
      const genderFromParam = params.get("gender") || params.get("sex");

      const birthDateVal =
        dobFromParam ||
        contract.birth_date ||
        contract.birthDate ||
        (localContract ? (localContract.birthDate || localContract.birth_date) : "");

      const genderVal =
        genderFromParam ||
        contract.gender ||
        (localContract ? localContract.gender : "");

      dataParam = JSON.stringify({
        add_number: permitNum,
        permit_type: "تصريح إعارة أجير",
        issue_date: contract.start_date,
        expiry_date: contract.end_date,
        worker_name: contract.worker_name,
        id_number: contract.worker_id_number,
        nationality: contract.worker_nationality,
        occupation: contract.worker_profession,
        birth_date: birthDateVal,
        gender: genderVal,
        provider_hr_id: contract.provider_hr_id,
        provider_entity: contract.provider_entity,
        status: isExpired ? "expired" : "valid",
      });
    } catch (error) {
      console.error("Error loading contract:", error);
      showError();
      return;
    }
  }

  if (!dataParam) {
    const pathParts = window.location.pathname.split("/").filter(Boolean);

    if (pathParts.length > 1) {
      dataParam = pathParts[pathParts.length - 1];
    }
  }


  if (!dataParam) {
    showError();
    return;
  }

  try {
    let decoded;

    try {
      decoded = decodeURIComponent(dataParam);
    } catch (e) {
      decoded = dataParam;
    }


    const data = JSON.parse(decoded);


    setValue(
      "permitNumber",
      data.add_number ??
        data.permit_number ??
        data.contract_number ??
        data.number
    );

    setValue("permitType", data.permit_type ?? data.contract_type);

    setValue("issueDate", data.issue_date);

    setValue("expiryDate", data.expiry_date);

    setValue("workerName", data.worker_name ?? data.workerName);

    setValue("workerIdNumber", data.id_number ?? data.worker_id_number);

    setValue("nationality", data.nationality ?? data.worker_nationality);

    setValue("occupation", data.occupation ?? data.worker_profession);

    setValue("gender", data.gender);
    setValue("birthDate", data.birth_date);

    setValue(
      "providerHrId",
      data.provider_hr_id ?? data.provider_number
    );

    setValue(
      "providerEntity",
      data.provider_entity ?? data.provider_name
    );

    if (usingLocalCopy) {
      setValue("statusBadge", "غير مؤكد");
      setValue("statusMessage", "تم عرض النسخة المحفوظة على هذا الجهاز. خدمة التحقق غير متاحة حاليًا.");
    } else {
      updateStatus(data.status);
    }

    const loading = document.getElementById("loading");

    if (loading) {
      loading.hidden = true;
    }

    const content = document.getElementById("verificationContent");

    if (content) {
      content.hidden = false;
    }
  } catch (error) {
    console.error("Verification error:", error);

    showError();
  }
});

function setValue(id, value) {
  const element = document.getElementById(id);

  if (!element) {
    return;
  }

  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    element.textContent = "-";
    return;
  }

  element.textContent = value;
}

function updateStatus(status) {
  const expired = status === "expired" || status === "منتهي";
  const blocked = status === "blocked" || status === "موقوف";
  document.getElementById("statusBadge").textContent = expired ? "منتهي" : blocked ? "موقوف" : "ساري / فعال";
  document.getElementById("statusBadge").classList.add("verification-result--" + (expired || blocked ? "expired" : "valid"));
  document.getElementById("statusMessage").textContent = expired
    ? "انتهت صلاحية هذا التصريح ولا يمكن استخدامه"
    : blocked ? "هذا التصريح موقوف" : "تم التحقق من التصريح بنجاح";
}

function showError(message) {
  const loading = document.getElementById(
    "loading"
  );

  const content = document.getElementById(
    "verificationContent"
  );

  const error = document.getElementById(
    "errorBox"
  );

  if (loading) {
    loading.hidden = true;
  }

  if (content) {
    content.hidden = true;
  }

  if (error) {
    if (message) error.textContent = message;
    error.hidden = false;
  }
}
