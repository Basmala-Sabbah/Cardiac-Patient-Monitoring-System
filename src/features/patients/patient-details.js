document.addEventListener("DOMContentLoaded", () => {
    initDarkMode();

    const urlParams = new URLSearchParams(window.location.search);
    const patientId = urlParams.get("id");

    fetchAndDisplayPatient(patientId);
});

/* =========================================================
   CONDITION HELPERS (مطابقة لصفحة المرضى)
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

/* =========================================================
   GET SAVED UPDATES FROM LOCALSTORAGE
========================================================= */

function getSavedPatientUpdates() {
    const updates = {};

    // 1. قراءة doctorPatientUpdates
    const doctorUpdates = JSON.parse(localStorage.getItem("doctorPatientUpdates") || "[]");
    if (Array.isArray(doctorUpdates)) {
        doctorUpdates.forEach(item => {
            if (item.patientId && item.condition) {
                updates[String(item.patientId)] = normalizeCondition(item.condition);
            }
        });
    }

    // 2. قراءة patientUpdates
    const patientUpdates = JSON.parse(localStorage.getItem("patientUpdates") || "{}");
    if (typeof patientUpdates === "object" && !Array.isArray(patientUpdates)) {
        Object.entries(patientUpdates).forEach(([id, cond]) => {
            updates[String(id)] = normalizeCondition(cond);
        });
    }

    // 3. قراءة باقي المفاتيح المحتملة
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
   MAIN FETCH & RENDER
========================================================= */

async function fetchAndDisplayPatient(id) {
    const loadingState = document.getElementById("loadingState");
    const contentArea = document.getElementById("patientDetailsContent");

    try {
        if (!id) {
            throw new Error("لم يتم تحديد رقم المريض في الرابط");
        }

        // جلب البيانات من ملفات الـ JSON
        const [patientsRes, appointmentsRes, usersRes] = await Promise.all([
            fetch("../src/data/patients.json", { cache: "no-store" }),
            fetch("../src/data/appointments.json", { cache: "no-store" }),
            fetch("../src/data/users.json", { cache: "no-store" })
        ]);

        if (!patientsRes.ok || !appointmentsRes.ok || !usersRes.ok) {
            throw new Error("حدث خطأ أثناء تحميل بيانات الملفات الطبية");
        }

        const patients = await patientsRes.json();
        const jsonAppointments = await appointmentsRes.json();
        const users = await usersRes.json();

        // قراءة المواعيد الإضافية المجهزة من LocalStorage
        const localAppointments = JSON.parse(localStorage.getItem("nabd_appointments") || "[]");

        // دمج مواعيد الـ JSON مع مواعيد الـ LocalStorage ومنع التكرار حسب الـ ID
        const allAppointmentsMap = new Map();
        jsonAppointments.forEach(app => allAppointmentsMap.set(String(app.id), app));
        localAppointments.forEach(app => allAppointmentsMap.set(String(app.id), app));

        const appointments = Array.from(allAppointmentsMap.values());

        // 1. البحث عن المريض من الـ JSON
        let patient = patients.find(p => String(p.id) === String(id));

        if (!patient) {
            throw new Error(`المريض برقم ${id} غير موجود`);
        }

        // 2. تحديث حالة المريض من LocalStorage (إن وجدت)
        const savedUpdates = getSavedPatientUpdates();
        const updatedCondition = savedUpdates[String(patient.id)];
        
        if (updatedCondition) {
            patient.condition = updatedCondition;
        } else {
            patient.condition = normalizeCondition(patient.condition);
        }

        // 3. البحث عن الطبيب
        const doctor = users.find(u => String(u.id) === String(patient.doctorId));

        // 4. البحث عن مواعيد المريض بالاعتماد على patientId أو المطابقة بالاسم
        const patientAppointments = appointments.filter(a => 
            String(a.patientId) === String(patient.id) || 
            (a.patientName && a.patientName.trim() === patient.name.trim())
        );

        // 5. تعبئة البيانات الأساسية في HTML
        setElementText("patientName", patient.name);
        setElementText("patientAge", patient.age ? `${patient.age} سنة` : "--");
        setElementText("patientGender", patient.gender === "Male" ? "ذكر" : patient.gender === "Female" ? "أنثى" : patient.gender);
        setElementText("patientPhone", patient.phone);
        setElementText("patientBlood", patient.bloodType || patient.blood_type);
        setElementText("doctorId", patient.doctorId ? `#DOC-${patient.doctorId}` : "--");
        setElementText("doctorName", doctor ? doctor.name : "--");
        setElementText("patientDiagnosis", patient.diagnosis);

        // 6. تعبئة العلامات الحيوية
        setElementText("vitalHeartRate", patient.heartRate ? `${patient.heartRate} نبضة/دقيقة` : "--");
        setElementText("vitalBloodPressure", patient.bloodPressure);
        setElementText("vitalOxygen", patient.oxygenLevel ? `${patient.oxygenLevel}%` : "--");

        // 7. عرض شارة حالة المريض (بعد التحديث)
        renderConditionBadge(patient.condition);

        // 8. عرض جدول المواعيد
        renderAppointmentsTable(patientAppointments);

        // 9. إظهار المحتوى وإخفاء التحميل
        if (loadingState) loadingState.classList.add("hidden");
        if (contentArea) contentArea.classList.remove("hidden");

    } catch (error) {
        console.error("خطأ أثناء جلب بيانات المريض:", error);
        showLoadingError(loadingState, error.message);
    }
}

/* =========================================================
   HELPERS & RENDER FUNCTIONS
========================================================= */

function renderConditionBadge(condition) {
    const badgeContainer = document.getElementById("patientStatusBadge");
    if (!badgeContainer) return;

    const normalized = normalizeCondition(condition);

    let style = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800";
    let icon = "fa-circle-check";
    let text = "مستقر";

    if (normalized === "Critical") {
        style = "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800";
        icon = "fa-triangle-exclamation";
        text = "حرج";
    } else if (normalized === "Needs Follow-up") {
        style = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800";
        icon = "fa-clock";
        text = "يحتاج متابعة";
    }

    badgeContainer.innerHTML = `
        <span class="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold ${style}">
            <i class="fa-solid ${icon}"></i>
            <span>${escapeHTML(text)}</span>
        </span>
    `;
}

function renderAppointmentsTable(appointments) {
    const tbody = document.getElementById("appointmentsTableBody");
    if (!tbody) return;

    if (!appointments || appointments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="px-6 py-6 text-center text-xs font-bold text-slate-400">
                    لا توجد مواعيد مسجلة لهذا المريض
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = appointments.map(app => {
        let statusStyle = "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400";
        if (app.status === "عاجل" || app.type === "طوارئ") {
            statusStyle = "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400";
        } else if (app.status === "مكتمل") {
            statusStyle = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
        }

        return `
            <tr class="border-b border-slate-100 transition hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-900/50">
                <td class="px-6 py-4 text-sm font-bold text-slate-800 dark:text-slate-200">
                    ${escapeHTML(app.date || "--")}
                </td>
                <td class="px-6 py-4 text-sm font-bold text-slate-800 dark:text-slate-200" dir="ltr">
                    ${escapeHTML(app.time || "--")}
                </td>
                <td class="px-6 py-4">
                    <span class="inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${statusStyle}">
                        ${escapeHTML(app.status || "مجدول")}
                    </span>
                </td>
                <td class="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    ${escapeHTML(app.reason || app.notes || "--")}
                </td>
            </tr>
        `;
    }).join("");
}

function setElementText(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = (value !== undefined && value !== null && value !== "") ? value : "--";
    }
}

function showLoadingError(loadingState, message) {
    if (!loadingState) return;
    loadingState.innerHTML = `
        <div class="flex flex-col items-center justify-center p-6 text-center">
            <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400">
                <i class="fa-solid fa-triangle-exclamation text-xl"></i>
            </div>
            <p class="text-sm font-bold text-red-600 dark:text-red-400">تعذر تحميل بيانات المريض</p>
            <p class="mt-1 text-xs text-slate-400">${escapeHTML(message)}</p>
        </div>
    `;
}

function escapeHTML(str) {
    return String(str ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/* =========================================================
   DARK MODE
========================================================= */

function initDarkMode() {
    const toggleBtn = document.getElementById("darkModeToggle");
    const savedTheme = localStorage.getItem("theme");

    if (savedTheme === "dark") {
        document.documentElement.classList.add("dark");
    } else if (savedTheme === "light") {
        document.documentElement.classList.remove("dark");
    }

    updateDarkModeIcon();

    if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
            const isDark = document.documentElement.classList.toggle("dark");
            localStorage.setItem("theme", isDark ? "dark" : "light");
            updateDarkModeIcon();
        });
    }
}

function updateDarkModeIcon() {
    const toggleBtn = document.getElementById("darkModeToggle");
    if (!toggleBtn) return;
    const icon = toggleBtn.querySelector("i");
    if (!icon) return;

    const isDark = document.documentElement.classList.contains("dark");
    icon.className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
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