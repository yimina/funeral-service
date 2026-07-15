/**
 * 故인의 모바일/웹 방명록 애플리케이션 로직 (app.js)
 */

// 1. 기본 상태 및 기본값 설정
// ※ 실제 고인/유가족 성함은 소스코드에 넣지 않습니다.
//    관리자 모드 > 환경 설정에서 입력하면 브라우저(localStorage)와
//    (연동 시) 구글 스프레드시트에 저장되어 유지됩니다.
const DEFAULT_DECEASED_INFO = {
  name: "성함을 입력해주세요",
  baptismalName: "",
  passing: "",
  spouse: "",
  sons: "",
  daughters: ""
};

// 최초 배포 시 반드시 관리자 모드에서 비밀번호를 변경해 주세요.
const DEFAULT_ADMIN_PASSWORD = "0000";

// PC/모바일 등 기기마다 따로 설정하지 않아도 항상 같은 데이터(방명록/장례정보/비밀번호)를
// 쓰도록 하려면, 배포한 구글 앱스 스크립트 웹 앱 URL을 아래에 붙여넣으세요.
// (관리자 설정 화면에서 입력해도 되지만, 그 경우 그 브라우저에서만 적용됩니다.)
const DEFAULT_GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbyw8b1aU-TSLkX6gf33p71vomlKX4I1-qHbkqhcRR3evrUxlAPRw5xkjoAmL10gM_MR/exec";

// 최초 실행 시 화면 구성을 보여주기 위한 예시 메시지 (실제 조문객 정보 아님)
const SEED_MESSAGES = [
  {
    id: "seed-1",
    name: "예시) 홍길동",
    relation: "직장 동료",
    message: "삼가 고인의 명복을 빕니다. 유가족분들께 진심 어린 위로의 말씀을 전합니다.",
    timestamp: "2026-01-01 09:12"
  },
  {
    id: "seed-2",
    name: "예시) 김철수",
    relation: "친구",
    message: "따뜻했던 기억을 오래도록 간직하겠습니다. 편히 영면하시길 기원합니다.",
    timestamp: "2026-01-01 08:45"
  }
];

// App State
let state = {
  messages: [],
  deceasedInfo: { ...DEFAULT_DECEASED_INFO },
  adminPassword: DEFAULT_ADMIN_PASSWORD,
  googleSheetsUrl: "",
  isAdmin: false,
  activeFilter: "전체",
  searchQuery: ""
};

// 2. DOM 요소 선택
const DOM = {
  // Tribute info
  deceasedMainTitle: document.getElementById("deceased-main-title"),
  deceasedBaptismalLine: document.getElementById("deceased-baptismal-line"),
  deceasedName: document.getElementById("deceased-name"),
  deceasedBaptismal: document.getElementById("deceased-baptismal"),
  deceasedPassing: document.getElementById("deceased-passing"),
  deceasedSpouse: document.getElementById("deceased-spouse"),
  deceasedSons: document.getElementById("deceased-sons"),
  deceasedDaughters: document.getElementById("deceased-daughters"),
  
  // Forms & Inputs
  form: document.getElementById("guestbook-form"),
  inputName: document.getElementById("visitor-name"),
  inputRelation: document.getElementById("visitor-relation"),
  inputMessage: document.getElementById("visitor-message"),
  
  // Search & Filter
  searchInput: document.getElementById("search-input"),
  filterBar: document.getElementById("filter-bar"),
  
  // List
  listContainer: document.getElementById("guestbook-list"),
  
  // Admin Top Bar
  adminTopBar: document.getElementById("admin-top-bar"),
  googleSheetsStatus: document.getElementById("gs-status-badge"),
  adminLogoutBtn: document.getElementById("admin-logout-btn"),
  adminSettingsBtn: document.getElementById("admin-settings-btn"),
  adminExportBtn: document.getElementById("admin-export-btn"),
  
  // Admin Footer
  adminLoginBtn: document.getElementById("admin-login-btn"),
  
  // Modals
  modalOverlay: document.getElementById("modal-overlay"),
  modalTitle: document.getElementById("modal-title"),
  modalBody: document.getElementById("modal-body"),
  modalCancelBtn: document.getElementById("modal-cancel-btn"),
  modalConfirmBtn: document.getElementById("modal-confirm-btn"),
  
  // Toast container
  toastContainer: document.getElementById("toast-container")
};

// 3. 초기화 함수
window.addEventListener("DOMContentLoaded", () => {
  loadLocalStorage();
  checkSessionAdmin();
  setupEventListeners();
  renderDeceasedInfo();
  renderFilterButtons();
  
  // 구글 시트가 설정되어 있으면 실시간 동기화 호출
  if (state.googleSheetsUrl) {
    fetchFromGoogleSheets();
  } else {
    renderMessages();
    updateGoogleSheetsBadge("disconnected");
  }
});

// 4. 로컬 저장소 로드 및 저장
function loadLocalStorage() {
  // 故인 정보 로드
  const savedDeceased = localStorage.getItem("gb_deceased_info");
  if (savedDeceased) {
    state.deceasedInfo = JSON.parse(savedDeceased);
  } else {
    localStorage.setItem("gb_deceased_info", JSON.stringify(state.deceasedInfo));
  }
  
  // 관리자 비밀번호 로드
  const savedPassword = localStorage.getItem("gb_admin_password");
  if (savedPassword) {
    state.adminPassword = savedPassword;
  } else {
    localStorage.setItem("gb_admin_password", state.adminPassword);
  }
  
  // 구글 시트 연동 URL 로드
  const savedUrl = localStorage.getItem("gb_gs_url");
  if (savedUrl) {
    state.googleSheetsUrl = savedUrl;
  } else if (DEFAULT_GOOGLE_SHEETS_URL) {
    state.googleSheetsUrl = DEFAULT_GOOGLE_SHEETS_URL;
    localStorage.setItem("gb_gs_url", DEFAULT_GOOGLE_SHEETS_URL);
  }
  
  // 메시지 리스트 로드
  const savedMessages = localStorage.getItem("gb_messages");
  if (savedMessages) {
    state.messages = JSON.parse(savedMessages);
  } else {
    // 최초 실행 시 샘플 메시지 탑재
    state.messages = [...SEED_MESSAGES];
    localStorage.setItem("gb_messages", JSON.stringify(state.messages));
  }
}

function saveMessagesToLocalStorage() {
  localStorage.setItem("gb_messages", JSON.stringify(state.messages));
}

// 5. 관리자 세션 체크
function checkSessionAdmin() {
  const isSessionAdmin = sessionStorage.getItem("gb_is_admin") === "true";
  if (isSessionAdmin) {
    enableAdminMode();
  }
}

// 6. UI 렌더링 함수
function renderDeceasedInfo() {
  if (DOM.deceasedMainTitle) DOM.deceasedMainTitle.textContent = "故 " + (state.deceasedInfo.name || "");
  if (DOM.deceasedBaptismalLine) {
    const baptismal = state.deceasedInfo.baptismalName;
    if (baptismal) {
      DOM.deceasedBaptismalLine.textContent = `(세례명: ${baptismal})`;
      DOM.deceasedBaptismalLine.style.display = "block";
    } else {
      DOM.deceasedBaptismalLine.textContent = "";
      DOM.deceasedBaptismalLine.style.display = "none";
    }
  }
  if (DOM.deceasedName) DOM.deceasedName.textContent = state.deceasedInfo.name || "";
  if (DOM.deceasedBaptismal) DOM.deceasedBaptismal.textContent = state.deceasedInfo.baptismalName || "";
  if (DOM.deceasedPassing) DOM.deceasedPassing.textContent = state.deceasedInfo.passing || "";
  if (DOM.deceasedSpouse) DOM.deceasedSpouse.textContent = state.deceasedInfo.spouse || "";
  if (DOM.deceasedSons) DOM.deceasedSons.textContent = state.deceasedInfo.sons || "";
  if (DOM.deceasedDaughters) DOM.deceasedDaughters.textContent = state.deceasedInfo.daughters || "";
}

// 필터 버튼 생성
function renderFilterButtons() {
  const relations = ["전체", "가족/친지", "친구", "직장/단체", "기타"];
  DOM.filterBar.innerHTML = "";
  
  relations.forEach(rel => {
    const btn = document.createElement("button");
    btn.className = `filter-btn ${state.activeFilter === rel ? "active" : ""}`;
    btn.textContent = rel;
    btn.addEventListener("click", () => {
      state.activeFilter = rel;
      renderFilterButtons();
      renderMessages();
    });
    DOM.filterBar.appendChild(btn);
  });
}

// 방명록 목록 렌더링
function renderMessages() {
  DOM.listContainer.innerHTML = "";
  
  // 필터 및 검색 필터링
  const filtered = state.messages.filter(msg => {
    const matchesFilter = state.activeFilter === "전체" || msg.relation === state.activeFilter;
    const matchesSearch = msg.name.toLowerCase().includes(state.searchQuery.toLowerCase()) || 
                          msg.message.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
                          msg.relation.toLowerCase().includes(state.searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });
  
  if (filtered.length === 0) {
    DOM.listContainer.innerHTML = `
      <div class="no-results">
        <p>작성된 추모 글이 없습니다.</p>
        <p style="font-size: 0.85rem; margin-top: 8px; color: var(--text-muted);">
          ${state.searchQuery ? "검색어를 확인해 주세요." : "첫 번째 추모의 글을 남겨주세요."}
        </p>
      </div>
    `;
    return;
  }
  
  filtered.forEach(msg => {
    const card = document.createElement("div");
    card.className = "message-card";
    card.dataset.id = msg.id;
    
    // 시간 깔끔하게 변환 (초 제외)
    let displayTime = msg.timestamp;
    if (displayTime && displayTime.length > 16) {
      displayTime = displayTime.substring(0, 16);
    }
    
    card.innerHTML = `
      <div class="message-header">
        <div class="visitor-info">
          <span class="visitor-name">${escapeHTML(msg.name)}</span>
          <span class="visitor-relation">${escapeHTML(msg.relation)}</span>
        </div>
        <span class="message-date">${displayTime}</span>
      </div>
      <div class="message-body">${escapeHTML(msg.message)}</div>
      <button class="delete-btn" onclick="confirmDeleteMessage('${msg.id}')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        삭제
      </button>
    `;
    
    DOM.listContainer.appendChild(card);
  });
}

// 구글 시트 상태 표시 뱃지 업데이트
function updateGoogleSheetsBadge(status) {
  if (!DOM.googleSheetsStatus) return;
  
  if (status === "connected") {
    DOM.googleSheetsStatus.textContent = "구글 시트 연동 활성화";
    DOM.googleSheetsStatus.className = "visitor-relation";
    DOM.googleSheetsStatus.style.backgroundColor = "rgba(129, 199, 132, 0.15)";
    DOM.googleSheetsStatus.style.color = "var(--success)";
    DOM.googleSheetsStatus.style.borderColor = "var(--success)";
  } else if (status === "syncing") {
    DOM.googleSheetsStatus.textContent = "연동 확인 중...";
    DOM.googleSheetsStatus.className = "visitor-relation";
    DOM.googleSheetsStatus.style.backgroundColor = "rgba(197, 168, 128, 0.15)";
    DOM.googleSheetsStatus.style.color = "var(--accent-gold)";
    DOM.googleSheetsStatus.style.borderColor = "var(--accent-gold)";
  } else {
    DOM.googleSheetsStatus.textContent = "로컬 저장소 전용 모드";
    DOM.googleSheetsStatus.className = "visitor-relation";
    DOM.googleSheetsStatus.style.backgroundColor = "rgba(134, 134, 144, 0.15)";
    DOM.googleSheetsStatus.style.color = "var(--text-muted)";
    DOM.googleSheetsStatus.style.borderColor = "var(--text-muted)";
  }
}

// 7. 구글 시트 API 실시간 연동 로직
function fetchFromGoogleSheets() {
  if (!state.googleSheetsUrl) return;
  
  updateGoogleSheetsBadge("syncing");
  
  fetch(state.googleSheetsUrl)
    .then(res => {
      if (!res.ok) throw new Error("네트워크 오류");
      return res.json();
    })
    .then(resData => {
      if (resData.status === "success") {
        // 1. 장례 정보 동기화 (시트에 저장된 정보가 있다면 우선 적용)
        if (resData.deceasedInfo) {
          const { adminPassword, ...tributeInfo } = resData.deceasedInfo;
          state.deceasedInfo = tributeInfo;
          localStorage.setItem("gb_deceased_info", JSON.stringify(state.deceasedInfo));
          renderDeceasedInfo();

          // 관리자 비밀번호도 시트 값으로 동기화 (기기 간 공통 적용)
          if (adminPassword) {
            state.adminPassword = adminPassword;
            localStorage.setItem("gb_admin_password", adminPassword);
          }
        }
        
        // 2. 방명록 목록 동기화
        if (Array.isArray(resData.data)) {
          state.messages = resData.data;
          saveMessagesToLocalStorage();
          renderMessages();
          updateGoogleSheetsBadge("connected");
          showToast("구글 시트로부터 실시간 동기화되었습니다.", "success");
        }
      } else {
        throw new Error(resData.message || "동기화 실패");
      }
    })
    .catch(err => {
      console.warn("구글 스프레드시트 동기화 실패 (오프라인/오류):", err);
      updateGoogleSheetsBadge("disconnected");
      showToast("실시간 연동 확인 실패. 로컬 저장 데이터를 로드합니다.", "error");
      renderMessages();
    });
}

// 구글 시트로 POST 요청을 보내고 실제 응답(성공/실패)을 확인하는 공통 함수
// (예전 코드는 mode:"no-cors"를 써서 실패해도 항상 "성공"으로 표시되는 문제가 있었음)
function postToGoogleSheets(payload) {
  return fetch(state.googleSheetsUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain" // 프리플라이트(OPTIONS) 요청을 피하기 위해 text/plain 유지
    },
    body: JSON.stringify(payload)
  })
    .then(res => {
      if (!res.ok) {
        throw new Error(`서버 응답 오류 (HTTP ${res.status}). 배포 설정을 확인해 주세요.`);
      }
      return res.json();
    })
    .then(resData => {
      if (resData.status !== "success") {
        throw new Error(resData.message || "알 수 없는 오류");
      }
      return resData;
    });
}

function syncCreateToGoogleSheets(record) {
  if (!state.googleSheetsUrl) return;
  
  postToGoogleSheets({ action: "create", data: record })
    .then(() => {
      showToast("구글 스프레드시트에 작성 완료", "success");
    })
    .catch(err => {
      console.error("구글 시트 전송 실패:", err);
      showToast("구글 시트 저장 실패: " + err.message, "error");
    });
}

function syncDeleteFromGoogleSheets(id) {
  if (!state.googleSheetsUrl) return;
  
  postToGoogleSheets({ action: "delete", id: id })
    .then(() => {
      showToast("구글 스프레드시트에서 삭제 완료", "success");
    })
    .catch(err => {
      console.error("구글 시트 삭제 전송 실패:", err);
      showToast("구글 시트 삭제 실패: " + err.message, "error");
    });
}

function syncInfoToGoogleSheets() {
  if (!state.googleSheetsUrl) return;
  
  postToGoogleSheets({
    action: "update_info",
    data: { ...state.deceasedInfo, adminPassword: state.adminPassword }
  })
    .then(() => {
      showToast("장례 정보가 구글 스프레드시트에 동기화되었습니다.", "success");
    })
    .catch(err => {
      console.error("장례 정보 시트 전송 실패:", err);
      showToast("장례 정보 동기화 실패: " + err.message, "error");
    });
}

// 8. 이벤트 리스너 설정
function setupEventListeners() {
  // 방명록 작성 제출
  DOM.form.addEventListener("submit", (e) => {
    e.preventDefault();
    
    const name = DOM.inputName.value.trim();
    const relation = DOM.inputRelation.value;
    const message = DOM.inputMessage.value.trim();
    
    if (!name) {
      showToast("성함을 입력해 주세요.", "error");
      return;
    }
    if (!relation) {
      showToast("고인과의 관계를 선택해 주세요.", "error");
      return;
    }
    if (!message) {
      showToast("추모 메시지를 작성해 주세요.", "error");
      return;
    }
    
    const date = new Date();
    const formattedTimestamp = formatDate(date);
    const newRecord = {
      id: Date.now().toString(),
      name: name,
      relation: relation,
      message: message,
      timestamp: formattedTimestamp
    };
    
    // 로컬 상태 추가
    state.messages.unshift(newRecord);
    saveMessagesToLocalStorage();
    renderMessages();
    
    // 입력 필드 초기화
    DOM.inputName.value = "";
    DOM.inputRelation.value = "";
    DOM.inputMessage.value = "";
    
    showToast("추모 글이 성공적으로 등록되었습니다.", "success");
    
    // 실시간 연동
    syncCreateToGoogleSheets(newRecord);
  });
  
  // 검색 실시간 필터링
  DOM.searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value.trim();
    renderMessages();
  });
  
  // 관리자 모드 실행
  DOM.adminLoginBtn.addEventListener("click", () => {
    if (state.isAdmin) {
      showToast("이미 관리자 모드입니다.", "success");
      return;
    }
    showAdminLoginModal();
  });
  
  // 관리자 로그아웃
  DOM.adminLogoutBtn.addEventListener("click", () => {
    disableAdminMode();
    showToast("로그아웃 되었습니다.", "success");
  });
  
  // CSV 내보내기
  DOM.adminExportBtn.addEventListener("click", () => {
    exportToCSV();
  });
  
  // 관리자 설정 모달 열기
  DOM.adminSettingsBtn.addEventListener("click", () => {
    showAdminSettingsModal();
  });
}

// 9. 관리자 모드 활성화 / 비활성화
function enableAdminMode() {
  state.isAdmin = true;
  sessionStorage.setItem("gb_is_admin", "true");
  document.body.classList.add("admin-mode-active");
  if (DOM.adminTopBar) DOM.adminTopBar.classList.add("active");
  renderMessages(); // 삭제 버튼 표시 목적 재렌더링
}

function disableAdminMode() {
  state.isAdmin = false;
  sessionStorage.removeItem("gb_is_admin");
  document.body.classList.remove("admin-mode-active");
  if (DOM.adminTopBar) DOM.adminTopBar.classList.remove("active");
  renderMessages();
}

// 10. 모달 창 컨트롤 (커스텀 다이얼로그)
function openModal(title, bodyHTML, onConfirm) {
  DOM.modalTitle.textContent = title;
  DOM.modalBody.innerHTML = bodyHTML;
  DOM.modalOverlay.classList.add("active");
  
  // 기존 이벤트 리스너 제거용 복제
  const newConfirmBtn = DOM.modalConfirmBtn.cloneNode(true);
  const newCancelBtn = DOM.modalCancelBtn.cloneNode(true);
  DOM.modalConfirmBtn.parentNode.replaceChild(newConfirmBtn, DOM.modalConfirmBtn);
  DOM.modalCancelBtn.parentNode.replaceChild(newCancelBtn, DOM.modalCancelBtn);
  
  DOM.modalConfirmBtn = newConfirmBtn;
  DOM.modalCancelBtn = newCancelBtn;
  
  DOM.modalCancelBtn.addEventListener("click", closeModal);
  DOM.modalConfirmBtn.addEventListener("click", () => {
    if (onConfirm()) {
      closeModal();
    }
  });
}

function closeModal() {
  DOM.modalOverlay.classList.remove("active");
}

// 관리자 로그인 모달
function showAdminLoginModal() {
  const bodyHTML = `
    <div class="form-group">
      <label for="admin-pw-input">관리자 비밀번호</label>
      <input type="password" id="admin-pw-input" class="input-field" placeholder="기본값: 0000" autofocus>
      <p style="font-size:0.75rem; color:var(--text-muted); margin-top:8px;">
        상주분들이 방명록을 편집 및 관리하기 위해 접속하는 패널입니다.
      </p>
    </div>
  `;
  
  openModal("관리자 인증", bodyHTML, () => {
    const input = document.getElementById("admin-pw-input").value;
    if (String(input) === String(state.adminPassword)) {
      enableAdminMode();
      showToast("관리자 모드가 활성화되었습니다.", "success");
      if (state.adminPassword === DEFAULT_ADMIN_PASSWORD) {
        setTimeout(() => {
          showToast("보안을 위해 환경 설정에서 비밀번호를 꼭 변경해 주세요.", "error");
        }, 800);
      }
      return true;
    } else {
      showToast("비밀번호가 일치하지 않습니다.", "error");
      return false;
    }
  });
}

// 관리자 설정 모달 (구글 시트 연동, 비밀번호 변경, 故인 정보 수정)
function showAdminSettingsModal() {
  const bodyHTML = `
    <div style="max-height: 400px; overflow-y: auto; padding-right: 8px;">
      <h3 style="font-size: 0.95rem; color: var(--accent-gold); margin-bottom: 12px; font-family: var(--font-serif)">1. 장례 정보 설정 (메인 헤더 표시용)</h3>
      <div class="form-group">
        <label>故인 성함</label>
        <input type="text" id="edit-deceased-name" class="input-field" value="${state.deceasedInfo.name}">
      </div>
      <div class="form-group">
        <label>세례명 (선택)</label>
        <input type="text" id="edit-deceased-baptismal" class="input-field" value="${state.deceasedInfo.baptismalName || ''}" placeholder="예: 요한, 마리아">
      </div>
      <div class="form-group">
        <label>별세 일시</label>
        <input type="text" id="edit-deceased-passing" class="input-field" value="${state.deceasedInfo.passing || ''}">
      </div>
      <div class="form-group">
        <label>배우자</label>
        <input type="text" id="edit-deceased-spouse" class="input-field" value="${state.deceasedInfo.spouse || ''}">
      </div>
      <div class="form-group">
        <label>아들</label>
        <input type="text" id="edit-deceased-sons" class="input-field" value="${state.deceasedInfo.sons || ''}">
      </div>
      <div class="form-group">
        <label>딸</label>
        <input type="text" id="edit-deceased-daughters" class="input-field" value="${state.deceasedInfo.daughters || ''}">
      </div>
      
      <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 20px 0;">
      
      <h3 style="font-size: 0.95rem; color: var(--accent-gold); margin-bottom: 12px; font-family: var(--font-serif)">2. 관리자 비밀번호 관리</h3>
      <div class="form-group">
        <label>새 관리자 비밀번호</label>
        <input type="text" id="edit-admin-password" class="input-field" value="${state.adminPassword}">
      </div>
      
      <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 20px 0;">
      
      <div style="text-align: center">
        <button type="button" class="admin-btn" style="background-color: var(--danger-light); color: var(--danger); border-color: rgba(207, 102, 121, 0.4); padding: 8px 16px; width: 100%" onclick="resetAllGuestbookData()">
          방명록 전체 초기화 (로컬 데이터 삭제)
        </button>
      </div>
    </div>
  `;
  
  openModal("관리자 환경 설정", bodyHTML, () => {
    const newName = document.getElementById("edit-deceased-name").value.trim();
    const newBaptismal = document.getElementById("edit-deceased-baptismal").value.trim();
    const newPassing = document.getElementById("edit-deceased-passing").value.trim();
    const newSpouse = document.getElementById("edit-deceased-spouse").value.trim();
    const newSons = document.getElementById("edit-deceased-sons").value.trim();
    const newDaughters = document.getElementById("edit-deceased-daughters").value.trim();
    const newPassword = document.getElementById("edit-admin-password").value.trim();
    
    if (!newName || !newPassword) {
      showToast("고인 성함과 관리자 비밀번호는 필수 입력 항목입니다.", "error");
      return false;
    }
    
    // 변경점 적용 및 로컬 저장
    state.deceasedInfo = { 
      name: newName, 
      baptismalName: newBaptismal,
      passing: newPassing, 
      spouse: newSpouse,
      sons: newSons,
      daughters: newDaughters
    };
    localStorage.setItem("gb_deceased_info", JSON.stringify(state.deceasedInfo));
    renderDeceasedInfo();
    
    state.adminPassword = newPassword;
    localStorage.setItem("gb_admin_password", newPassword);
    
    // 구글 스프레드시트에 장례 정보 + 관리자 비밀번호 실시간 업데이트 (기기 간 동기화)
    syncInfoToGoogleSheets();
    
    showToast("설정이 안전하게 저장되었습니다.", "success");
    return true;
  });
}

// 방명록 삭제 확인 모달 호출 (전역 노출 필요)
window.confirmDeleteMessage = function(id) {
  if (!state.isAdmin) {
    showToast("관리자 권한이 필요한 작업입니다.", "error");
    return;
  }
  
  const msgObj = state.messages.find(m => m.id === id);
  const name = msgObj ? msgObj.name : "조문객";
  const bodyHTML = `
    <p style="font-family: var(--font-content); line-height: 1.6; text-align: center; margin: 15px 0;">
      <strong>"${escapeHTML(name)}"</strong> 님의 조의 메시지를 방명록에서 영구 삭제하시겠습니까?<br>
      <span style="color: var(--danger); font-size: 0.85rem;">(이 작업은 구글 시트에서도 실시간 반영되어 삭제됩니다)</span>
    </p>
  `;
  
  openModal("방명록 글 삭제", bodyHTML, () => {
    // 삭제 처리
    state.messages = state.messages.filter(msg => msg.id !== id);
    saveMessagesToLocalStorage();
    renderMessages();
    
    showToast("조의 메시지를 로컬에서 삭제했습니다.", "success");
    
    // 시트 동기화 삭제
    syncDeleteFromGoogleSheets(id);
    return true;
  });
};

// 전체 방명록 초기화
window.resetAllGuestbookData = function() {
  if (confirm("정말로 모든 로컬 방명록 기록을 초기화하시겠습니까?\n(경고: 구글 스프레드시트의 데이터는 영향을 받지 않고 브라우저 캐시만 삭제됩니다)")) {
    state.messages = [];
    saveMessagesToLocalStorage();
    renderMessages();
    closeModal();
    showToast("모든 방명록 데이터가 초기화되었습니다.", "success");
  }
};

// 11. 유틸리티 함수들

// 날짜 포맷팅 (YYYY-MM-DD HH:mm)
function formatDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

// HTML 엔티티 이스케이프 (XSS 공격 방어)
function escapeHTML(str) {
  if (!str) return "";
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// 12. 알림 토스트 (Toast) 출력
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "toast-error" : "toast-success"}`;
  toast.textContent = message;
  
  DOM.toastContainer.appendChild(toast);
  
  // 리플로우 강제 유발 후 클래스 추가 (애니메이션)
  toast.offsetHeight; 
  toast.classList.add("show");
  
  // 3초 후 페이드아웃 및 제거
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// 13. CSV 내보내기 구현
function exportToCSV() {
  if (state.messages.length === 0) {
    showToast("내보낼 방명록 내용이 존재하지 않습니다.", "error");
    return;
  }
  
  // CSV 헤더 설정
  let csvContent = "작성시간,이름,관계/소속,추모 메시지\n";
  
  // 데이터 추가
  state.messages.forEach(msg => {
    // 콤마나 개행이 있는 경우 쌍따옴표로 감싸기
    const name = `"${msg.name.replace(/"/g, '""')}"`;
    const relation = `"${msg.relation.replace(/"/g, '""')}"`;
    const message = `"${msg.message.replace(/"/g, '""')}"`;
    const timestamp = `"${msg.timestamp.replace(/"/g, '""')}"`;
    
    csvContent += `${timestamp},${name},${relation},${message}\n`;
  });
  
  // Excel 한글 깨짐 방지용 UTF-8 BOM 추가
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const filename = `방명록_내보내기_${dateStr}.csv`;
  
  // 다운로드 트리거
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("방명록 엑셀(CSV) 파일이 성공적으로 다운로드되었습니다.", "success");
  } else {
    showToast("현재 브라우저에서는 다운로드를 지원하지 않습니다.", "error");
  }
}
