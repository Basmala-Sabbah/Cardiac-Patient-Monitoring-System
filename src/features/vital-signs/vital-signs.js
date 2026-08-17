document.addEventListener("DOMContentLoaded", () => {
    initDarkMode();
    initNotifications();
    loadPatientsAndVitals();

    const addVitalForm = document.getElementById("addVitalForm");
    const searchInput = document.getElementById("vitalsSearch");
    const statusFilter = document.getElementById("readingStatusFilter");

    addVitalForm?.addEventListener("submit", handleAddVital);
    searchInput?.addEventListener("input", filterVitalsTable);
    statusFilter?.addEventListener("change", filterVitalsTable);

    window.addEventListener("storage", () => {
        loadPatientsAndVitals();
    });

    setInterval(() => {
        if (allPatients.length > 0) {
            loadPatientsAndVitals(true);
        }
    }, 2000);
});

let allPatients = [];
let vitalsRecords = [];

/* =========================================================
   NOTIFICATION SYSTEM (إخفاء الأرقام وتصفير النافذة)
========================================================= */

function initNotifications() {
    const btn = document.getElementById("notificationButton");
    const panel = document.getElementById("notificationPanel");
    const badge = document.getElementById("notificationBadge");

    // إخفاء الـ Badge بشكل دائم
    if (badge) {
        badge.classList.add("hidden");
        badge.textContent = "0";
    }

    if (!btn || !panel) return;

    // فتح وإغلاق النافذة عند الكليك
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isHidden = panel.classList.contains("hidden");
        if (isHidden) {
            panel.classList.remove("hidden");
            btn.setAttribute("aria-expanded", "true");
        } else {
            panel.classList.add("hidden");
            btn.setAttribute("aria-expanded", "false");
        }
    });

    // إغلاق القائمة عند الضغط في أي مكان خارجي
    document.addEventListener("click", (e) => {
        if (!panel.contains(e.target) && !btn.contains(e.target)) {
            panel.classList.add("hidden");
            btn.setAttribute("aria-expanded", "false");
        }
    });
}

function updateNotificationsUI() {
    const badge = document.getElementById("notificationBadge");
    const countSpan = document.getElementById("notificationCount");
    const list = document.getElementById("notificationList");

    if (badge) badge.classList.add("hidden");
    if (countSpan) countSpan.textContent = "0";

    if (list) {
        list.innerHTML = `
            <div class="rounded-lg border border-dashed border-slate-200 px-4 py-5 text-center dark:border-slate-700">
                <i class="fa-regular fa-bell mb-2 text-xl text-slate-300 dark:text-slate-600"></i>
                <p class="text-sm font-bold text-slate-700 dark:text-slate-200">لا توجد إشعارات</p>
                <p class="mt-1 text-[11px] leading-5 text-slate-400">لا توجد تنبيهات مستلمة حالياً.</p>
            </div>
        `;
    }
}

/* =========================================================
   CONDITION
========================================================= */

function normalizeCondition(condition) {
    if (!condition) return "Stable";

    const value = String(condition).trim().toLowerCase();

    if (value === "critical" || value === "حرجة" || value === "حرج") {
        return "Critical";
    }

    if (
        value === "needs follow-up" ||
        value === "needs follow up" ||
        value === "follow-up" ||
        value === "follow up" ||
        value === "تحتاج إلى متابعة" ||
        value === "يحتاج إلى متابعة" ||
        value === "متابعة" ||
        value === "عاجلة"
    ) {
        return "Needs Follow-up";
    }

    return "Stable";
}

function getConditionBadge(condition) {
    const normalized = normalizeCondition(condition);

    if (normalized === "Critical") {
        return `
            <span class="inline-flex items-center rounded-lg bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600 dark:bg-red-950/30 dark:text-red-400">
                حرج
            </span>
        `;
    }

    if (normalized === "Needs Follow-up") {
        return `
            <span class="inline-flex items-center rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
                يحتاج متابعة
            </span>
        `;
    }

    return `
        <span class="inline-flex items-center rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
            مستقر
        </span>
    `;
}

/* =========================================================
   LOCAL STORAGE
========================================================= */

function getSavedPatientUpdates() {
    const updates = {};

    const doctorUpdates = JSON.parse(
        localStorage.getItem("doctorPatientUpdates") || "[]"
    );

    if (Array.isArray(doctorUpdates)) {
        doctorUpdates.forEach(item => {
            if (item.patientId && item.condition) {
                updates[String(item.patientId)] = normalizeCondition(item.condition);
            }
        });
    }

    const patientUpdates = JSON.parse(
        localStorage.getItem("patientUpdates") || "{}"
    );

    if (typeof patientUpdates === "object" && !Array.isArray(patientUpdates)) {
        Object.entries(patientUpdates).forEach(([id, cond]) => {
            updates[String(id)] = normalizeCondition(cond);
        });
    }

    const possibleKeys = [
        "patientStatuses",
        "patientStatusUpdates",
        "dashboardPatientUpdates",
        "followUpRecords",
        "followUpData",
        "patientsUpdates"
    ];

    possibleKeys.forEach(key => {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            collectUpdates(parsed, updates);
        } catch (error) {
            console.warn(`تعذر قراءة ${key}`, error);
        }
    });

    return updates;
}

function collectUpdates(data, updates) {
    if (!data) return;

    if (Array.isArray(data)) {
        data.forEach(item => collectUpdates(item, updates));
        return;
    }

    if (typeof data !== "object") return;

    const patientId = data.patientId ?? data.patient_id ?? data.patientID ?? data.id;
    const condition = data.condition ?? data.status ?? data.state;

    if (patientId !== undefined && condition !== undefined) {
        updates[String(patientId)] = normalizeCondition(condition);
    }

    Object.values(data).forEach(value => {
        if (value && typeof value === "object") {
            collectUpdates(value, updates);
        }
    });
}

/* =========================================================
   READING STATUS
========================================================= */

function calculateReadingStatus(heartRate, bloodPressure, oxygen) {
    const hr = Number(heartRate);
    const ox = Number(oxygen);

    let sys = 120;
    let dia = 80;

    if (bloodPressure && bloodPressure.includes("/")) {
        const parts = bloodPressure.split("/");
        sys = Number(parts[0]) || 120;
        dia = Number(parts[1]) || 80;
    }

    if (ox < 90 || hr > 120 || hr < 50 || sys >= 160 || dia >= 100) {
        return "حرج";
    }

    if (
        (ox >= 90 && ox <= 94) ||
        (hr >= 100 && hr <= 120) ||
        (sys >= 130 && sys <= 159) ||
        (dia >= 85 && dia <= 99)
    ) {
        return "تحذير";
    }

    return "طبيعي";
}

/* =========================================================
   LOAD DATA
========================================================= */

async function loadPatientsAndVitals(isSilent = false) {
    try {
        const possiblePaths = [
            "../src/data/patients.json",
            "src/data/patients.json",
            "/src/data/patients.json",
            "../data/patients.json"
        ];

        let jsonPatients = null;

        for (const path of possiblePaths) {
            try {
                const res = await fetch(path, { cache: "no-store" });
                if (res.ok) {
                    jsonPatients = await res.json();
                    break;
                }
            } catch (e) {
                // تجربة المسار التالي
            }
        }

        if (!jsonPatients) {
            throw new Error("تعذر جلب ملف المرضى");
        }

        const updates = getSavedPatientUpdates();

        allPatients = jsonPatients.map(p => {
            const updatedCond = updates[String(p.id)];
            return {
                ...p,
                condition: updatedCond || p.condition || "Stable"
            };
        });

        if (!isSilent) {
            populatePatientDropdown(allPatients);
        }

        const storedVitals = localStorage.getItem("vitalsHistory");

        if (storedVitals) {
            vitalsRecords = JSON.parse(storedVitals).map(record => {
                const currentCond = updates[String(record.patientId)] || record.patientCondition;
                return {
                    ...record,
                    patientCondition: currentCond
                };
            });
        } else {
            vitalsRecords = allPatients.map(p => ({
                patientId: p.id,
                patientName: p.name,
                heartRate: p.heartRate || 75,
                bloodPressure: p.bloodPressure || "120/80",
                oxygenLevel: p.oxygenLevel || 98,
                patientCondition: p.condition,
                readingStatus: calculateReadingStatus(
                    p.heartRate || 75,
                    p.bloodPressure || "120/80",
                    p.oxygenLevel || 98
                ),
                timestamp: "12 أغسطس 2026, 08:00 ص"
            }));
        }

        localStorage.setItem("vitalsHistory", JSON.stringify(vitalsRecords));
        filterVitalsTable();
        updateNotificationsUI();

    } catch (err) {
        console.error("خطأ في تحميل البيانات:", err);
    }
}

function populatePatientDropdown(patients) {
    const select = document.getElementById("patientSelect");
    if (!select) return;

    select.innerHTML =
        '<option value="">اختر المريض...</option>' +
        patients
            .map(p => `<option value="${p.id}">${escapeHTML(p.name)}</option>`)
            .join("");
}

/* =========================================================
   ADD VITAL
========================================================= */

function handleAddVital(e) {
    e.preventDefault();

    const patientId = document.getElementById("patientSelect").value;
    const heartRate = document.getElementById("heartRateInput").value;
    const bloodPressure = document.getElementById("bloodPressureInput").value;
    const oxygen = document.getElementById("oxygenInput").value;

    const patient = allPatients.find(p => String(p.id) === String(patientId));
    if (!patient) return;

    const calculatedStatus = calculateReadingStatus(heartRate, bloodPressure, oxygen);

    const now = new Date();
    const formattedDate = now.toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' });
    const formattedTime = now.toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit', hour12: true });

    const newRecord = {
        patientId: patient.id,
        patientName: patient.name,
        heartRate: heartRate,
        bloodPressure: bloodPressure,
        oxygenLevel: oxygen,
        patientCondition: patient.condition || "Stable",
        readingStatus: calculatedStatus,
        timestamp: `${formattedDate}, ${formattedTime}`
    };

    vitalsRecords.unshift(newRecord);
    localStorage.setItem("vitalsHistory", JSON.stringify(vitalsRecords));

    filterVitalsTable();
    updateNotificationsUI();

    document.getElementById("addVitalForm").reset();
}

/* =========================================================
   TABLE
========================================================= */

function renderVitalsTable(data) {
    const tbody = document.getElementById("vitalsTableBody");
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-5 py-8 text-center text-slate-400">
                    لا توجد سجلات حيوية مطابقة للبحث
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = data
        .map(item => {
            return `
                <tr class="border-b border-slate-100 transition hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/40">
                    <td class="px-5 py-4 font-bold text-slate-800 dark:text-slate-200">
                        ${escapeHTML(item.patientName)}
                    </td>
                    <td class="px-5 py-4 font-bold">
                        ${escapeHTML(item.heartRate)} نبضة/دقيقة
                    </td>
                    <td class="px-5 py-4 font-bold" dir="ltr">
                        ${escapeHTML(item.bloodPressure)}
                    </td>
                    <td class="px-5 py-4 font-bold">
                        ${escapeHTML(item.oxygenLevel)}%
                    </td>
                    <td class="px-5 py-4">
                        ${getConditionBadge(item.patientCondition)}
                    </td>
                    <td class="px-5 py-4">
                        ${getReadingStatusBadge(item.readingStatus)}
                    </td>
                    <td class="px-5 py-4 text-slate-400 font-medium" dir="ltr">
                        ${escapeHTML(item.timestamp)}
                    </td>
                </tr>
            `;
        })
        .join("");
}

function getReadingStatusBadge(status) {
    let style = "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800";

    if (status === "حرج") {
        style = "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800";
    }

    if (status === "تحذير") {
        style = "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800";
    }

    return `
        <span class="inline-flex rounded-lg px-2.5 py-1 font-bold ${style}">
            ${escapeHTML(status)}
        </span>
    `;
}

/* =========================================================
   SEARCH & FILTER
========================================================= */

function filterVitalsTable() {
    const searchInput = document.getElementById("vitalsSearch");
    const statusFilter = document.getElementById("readingStatusFilter");

    const search = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const filter = statusFilter ? statusFilter.value : "all";

    const filtered = vitalsRecords.filter(item => {
        const matchesName = String(item.patientName || "").toLowerCase().includes(search);
        const matchesStatus = filter === "all" || item.readingStatus === filter;
        return matchesName && matchesStatus;
    });

    renderVitalsTable(filtered);
}

/* =========================================================
   DARK MODE
========================================================= */

function updateDarkModeIcon(isDark) {
    const toggleBtn = document.getElementById("darkModeToggle");

    if (toggleBtn) {
        toggleBtn.innerHTML = isDark
            ? '<i class="fa-solid fa-sun text-slate-500"></i>'
            : '<i class="fa-solid fa-moon"></i>';
    }
}

function initDarkMode() {
    const toggleBtn = document.getElementById("darkModeToggle");
    const savedTheme = localStorage.getItem("theme");
    const isDark = savedTheme === "dark";

    if (isDark) {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }

    updateDarkModeIcon(isDark);

    toggleBtn?.addEventListener("click", () => {
        const dark = document.documentElement.classList.toggle("dark");
        localStorage.setItem("theme", dark ? "dark" : "light");
        updateDarkModeIcon(dark);
    });
}

/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(str) {
    return String(str ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}



        const openSidebarBtn = document.getElementById('openSidebar');
        const closeSidebarBtn = document.getElementById('closeSidebar');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');

        function toggleSidebar() {
            if (sidebar && overlay) {
                sidebar.classList.toggle('translate-x-full');
                overlay.classList.toggle('hidden');
                document.body.classList.toggle('overflow-hidden');
            }
        }

        if (openSidebarBtn) openSidebarBtn.addEventListener('click', toggleSidebar);
        if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', toggleSidebar);
        if (overlay) overlay.addEventListener('click', toggleSidebar);