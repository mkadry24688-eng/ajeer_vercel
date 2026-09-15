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

document.addEventListener("DOMContentLoaded", async function () {
  const params = new URLSearchParams(window.location.search);

  let dataParam = params.get("data");
  let contractId = params.get("id");
  if (contractId) {
    try {
      let contract = null;
      if (typeof supabaseClient !== "undefined" && supabaseClient) {
        const { data, error } = await supabaseClient
          .from("contracts")
          .select("*")
          .eq("id", contractId)
          .single();
        if (!error && data) {
          contract = data;
        }
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
          is_blocked: localContract.isBlocked || localContract.is_blocked
        };
      }

      if (!contract) {
        console.error("Contract not found:", contractId);
        showError();
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = contract.end_date ? new Date(contract.end_date) : null;
      const isExpired = end ? end < today : false;

      if (contract.is_blocked || isExpired) {
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

      let birthDateVal =
        dobFromParam ||
        contract.birth_date ||
        contract.birthDate ||
        (localContract ? (localContract.birthDate || localContract.birth_date) : "");

      if (!birthDateVal || String(birthDateVal).trim() === "" || birthDateVal === "-") {
        birthDateVal = getRealisticBirthDate(
          contract.worker_id_number || (localContract ? localContract.workerIdNumber : "")
        );
      }

      let genderVal =
        genderFromParam ||
        contract.gender ||
        (localContract ? localContract.gender : "");

      if (!genderVal || String(genderVal).trim() === "" || genderVal === "-") {
        genderVal = "ذكر";
      }

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
        status: contract.is_blocked ? "موقوف" : "ساري",
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

  console.log("URL:", window.location.href);
  console.log("DATA:", dataParam);

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

    console.log("DECODED DATA:", decoded);

    const data = JSON.parse(decoded);

    console.log("PARSED DATA:", data);

    setValue(
      "permitNumber",
      data.add_number ??
        data.permit_number ??
        data.contract_number ??
        data.number
    );

    // ثابت "تصريح إعارة أجير"
    setValue("permitType", "تصريح إعارة أجير");

    setValue("issueDate", data.issue_date);

    setValue("expiryDate", data.expiry_date);

    setValue("workerName", data.worker_name ?? data.workerName);

    setValue("workerIdNumber", data.id_number ?? data.worker_id_number);

    setValue("nationality", data.nationality ?? data.worker_nationality);

    setValue("occupation", data.occupation ?? data.worker_profession);

    // حقل الجنس: يرجع نوع الجنس ولا يرجع شرطة أبداً
    const rawGender = data.gender || params.get("gender");
    const finalGender =
      rawGender && String(rawGender).trim() !== "" && rawGender !== "-"
        ? rawGender
        : "ذكر";
    setValue("gender", finalGender);

    // تاريخ الميلاد: يرجع تاريخ الميلاد المحفوظ أو الواقعي ولا يرجع شرطة أبداً
    let finalBirthDate =
      data.birth_date || params.get("dob") || params.get("birth_date");
    if (
      !finalBirthDate ||
      String(finalBirthDate).trim() === "" ||
      finalBirthDate === "-"
    ) {
      finalBirthDate = getRealisticBirthDate(
        data.id_number || data.worker_id_number || params.get("id")
      );
    }
    setValue("birthDate", finalBirthDate);

    setValue(
      "providerHrId",
      data.provider_hr_id ?? data.provider_number
    );

    setValue(
      "providerEntity",
      data.provider_entity ?? data.provider_name
    );

    updateStatus(data.status);

    const loading = document.getElementById("loading");

    if (loading) {
      loading.style.display = "none";
    }

    const content = document.getElementById("verificationContent");

    if (content) {
      content.style.display = "block";
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
  const title = document.getElementById(
    "statusTitle"
  );

  const badge = document.getElementById(
    "statusBadge"
  );

  if (!title || !badge) {
    return;
  }

  if (
    status === "منتهي" ||
    status === "expired"
  ) {
    title.textContent = "منتهي";
    badge.style.color = "#c4322d";
    return;
  }

  if (
    status === "موقوف" ||
    status === "blocked"
  ) {
    title.textContent = "موقوف";
    badge.style.color = "#c4322d";
    return;
  }

  title.textContent = "ساري / فعال";
  badge.style.color = "";
}

function showError() {
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
    loading.style.display = "none";
  }

  if (content) {
    content.style.display = "none";
  }

  if (error) {
    error.style.display = "block";
  }
}

const chatWidget = document.getElementById("chatWidget");
const messageList = document.getElementById("messageList");

const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");

const attachmentBtn = document.getElementById("attachmentBtn");
const fileInput = document.getElementById("fileInput");

const minimizeBtn = document.getElementById("minimizeBtn");
const closeBtn = document.getElementById("closeBtn");
const homeBtn = document.getElementById("homeBtn");

const botLauncher = document.getElementById("botLauncher");

const carouselTrack = document.getElementById("carouselTrack");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

const dots = document.querySelectorAll(".dot");
const serviceButtons = document.querySelectorAll(".service-button");

botLauncher.addEventListener("click", () => {
  chatWidget.classList.add("show");

  botLauncher.style.display = "none";
});

const cards = document.querySelectorAll(".service-card-wrapper");

const cardsPerPage = 2;

const totalPages = Math.ceil(cards.length / cardsPerPage);

let currentPage = 0;

const cardWidth = 155;

function updateCarousel() {
  const maxPage = totalPages - 1;

  if (currentPage < 0) {
    currentPage = 0;
  }

  if (currentPage > maxPage) {
    currentPage = maxPage;
  }

  const moveX = currentPage * cardWidth * cardsPerPage;

  carouselTrack.style.transform =
    `translate3d(-${moveX}px, 0, 0)`;

  dots.forEach((dot, index) => {
    dot.classList.toggle("active", index === currentPage);
  });

  prevBtn.disabled = currentPage === 0;

  nextBtn.disabled = currentPage === maxPage;
}

nextBtn.addEventListener("click", () => {
  if (currentPage < totalPages - 1) {
    currentPage++;
    updateCarousel();
  }
});

prevBtn.addEventListener("click", () => {
  if (currentPage > 0) {
    currentPage--;
    updateCarousel();
  }
});

serviceButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const serviceName = button.dataset.service;

    addUserMessage(serviceName);

    setTimeout(() => {
      addBotMessage(
        `تم اختيار خدمة "${serviceName}". كيف يمكنني مساعدتك؟`,
      );
    }, 500);
  });
});

function addUserMessage(text) {
  const wrapper = document.createElement("div");

  wrapper.className = "user-message-wrapper";

  const message = document.createElement("div");

  message.className = "user-message";

  message.textContent = text;

  wrapper.appendChild(message);

  messageList.appendChild(wrapper);

  scrollToBottom();
}

function addBotMessage(text) {
  const wrapper = document.createElement("div");

  wrapper.className = "message-wrapper";

  const message = document.createElement("div");

  message.className = "bot-message";

  message.textContent = text;

  const meta = document.createElement("div");

  meta.className = "message-meta";

  meta.innerHTML =
    `<span>${getCurrentTime()}</span> - <span>bot</span>`;

  wrapper.appendChild(message);

  wrapper.appendChild(meta);

  messageList.appendChild(wrapper);

  scrollToBottom();
}

function getCurrentTime() {
  const now = new Date();

  let hours = now.getHours();

  const minutes = String(now.getMinutes()).padStart(2, "0");

  const period = hours >= 12 ? "م" : "ص";

  hours = hours % 12 || 12;

  return `${String(hours).padStart(2, "0")}:${minutes} ${period}`;
}

function sendMessage() {
  const text = chatInput.value.trim();

  if (!text) {
    return;
  }

  addUserMessage(text);

  chatInput.value = "";

  autoResize();

  setTimeout(() => {
    addBotMessage(
      "شكرًا لتواصلك مع أجير. سيتم مساعدتك في أقرب وقت."
    );
  }, 700);
}

sendBtn.addEventListener("click", sendMessage);

chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();

    sendMessage();
  }
});

function autoResize() {
  chatInput.style.height = "28px";

  chatInput.style.height =
    Math.min(chatInput.scrollHeight, 100) + "px";
}

chatInput.addEventListener("input", autoResize);

attachmentBtn.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  if (!fileInput.files.length) {
    return;
  }

  const file = fileInput.files[0];

  addUserMessage(`📎 ${file.name}`);

  setTimeout(() => {
    addBotMessage("تم استلام الملف بنجاح.");
  }, 500);
});

minimizeBtn.addEventListener("click", () => {
  chatWidget.classList.toggle("minimized");
});

closeBtn.addEventListener("click", () => {
  chatWidget.classList.remove("show");

  botLauncher.style.display = "";
});

homeBtn.addEventListener("click", () => {
  chatWidget.classList.remove("minimized");

  messageList.scrollTop = 0;

  currentPage = 0;

  updateCarousel();
});

const moreBtn = document.getElementById("moreBtn");

if (moreBtn) {
  moreBtn.addEventListener("click", () => {
    addBotMessage(
      "يمكنك اختيار إحدى الخدمات المتاحة أو كتابة استفسارك مباشرة.",
    );
  });
}

function scrollToBottom() {
  setTimeout(() => {
    messageList.scrollTop = messageList.scrollHeight;
  }, 50);
}

updateCarousel();
