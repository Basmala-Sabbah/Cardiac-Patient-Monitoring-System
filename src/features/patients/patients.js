document.addEventListener("DOMContentLoaded", () => {
    // عناصر الصفحة
    const patientTableBody = document.getElementById("patientsTableBody");
    const patientsCount = document.getElementById("patientsCount");
    const patientSearch = document.getElementById("patientSearch");
    const conditionFilter = document.getElementById("conditionFilter");

    const darkModeToggle = document.getElementById("darkModeToggle");
    const notificationButton = document.getElementById("notificationButton");
    const notificationPanel = document.getElementById("notificationPanel");
    const notificationBadge = document.getElementById("notificationBadge");
    const notificationCount = document.getElementById("notificationCount");
    const notificationList = document.getElementById("notificationList");
    const markAllRead = document.getElementById("markAllRead");

    let patients = [];
    let filteredPatients = [];
    let isLoading = true;

    /* =========================================================
       LOADING & MESSAGES
    ========================================================= */

    function showLoading() {
        if (!patientTableBody) return;

        isLoading = true;

        patientTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="px-4 py-14">
                    <div class="flex flex-col items-center justify-center gap-4">
                        <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 dark:bg-green-950/30">
                            <div class="h-7 w-7 animate-spin rounded-full border-4 border-slate-200 border-t-green-600 dark:border-slate-700 dark:border-t-green-500"></div>
                        </div>
                        <p class="text-sm font-bold text-slate-500 dark:text-slate-400">
                            جاري تحميل بيانات المرضى...
                        </p>
                    </div>
                </td>
            </tr>
        `;
    }

    function hideLoading() {
        isLoading = false;
    }

    function showLoadingError(message = "حدثت مشكلة في تحميل بيانات المرضى") {
        if (!patientTableBody) return;

        isLoading = false;

        patientTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="px-4 py-14">
                    <div class="flex flex-col items-center justify-center gap-3">
                        <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400">
                            <i class="fa-solid fa-triangle-exclamation text-lg"></i>
                        </div>
                        <p class="text-sm font-bold text-red-500 dark:text-red-400">
                            ${escapeHTML(message)}
                        </p>
                        <p class="text-xs text-slate-400">
                            تأكد من تشغيل Live Server ومن وجود ملف البيانات.
                        </p>
                    </div>
                </td>
            </tr>
        `;
    }

    function showEmpty() {
        if (!patientTableBody) return;

        if (patientsCount) patientsCount.textContent = "0";

        patientTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="px-4 py-14">
                    <div class="flex flex-col items-center justify-center">
                        <i class="fa-solid fa-user-slash mb-3 text-2xl text-slate-300 dark:text-slate-600"></i>
                        <p class="text-sm font-bold text-slate-500 dark:text-slate-400">
                            لا توجد بيانات مرضى
                        </p>
                        <p class="mt-1 text-xs text-slate-400">
                            جرّب تغيير البحث أو الفلترة.
                        </p>
                    </div>
                </td>
            </tr>
        `;
    }

    /* =========================================================
       CONDITION HELPERS
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
                <span class="inline-flex items-center rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 dark:bg-red-950/30 dark:text-red-400">
                    حرج
                </span>
            `;
        }

        if (normalized === "Needs Follow-up") {
            return `
                <span class="inline-flex items-center rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
                    يحتاج متابعة
                </span>
            `;
        }

        return `
            <span class="inline-flex items-center rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                مستقر
            </span>
        `;
    }

    /* =========================================================
       LOCAL STORAGE UPDATES
    ========================================================= */

    function getSavedPatientUpdates() {
        const updates = {};

        const doctorUpdates = JSON.parse(localStorage.getItem("doctorPatientUpdates") || "[]");
        if (Array.isArray(doctorUpdates)) {
            doctorUpdates.forEach(item => {
                if (item.patientId && item.condition) {
                    updates[String(item.patientId)] = normalizeCondition(item.condition);
                }
            });
        }

        const patientUpdates = JSON.parse(localStorage.getItem("patientUpdates") || "{}");
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

    function applySavedUpdates() {
        const updates = getSavedPatientUpdates();

        patients = patients.map(patient => {
            const updatedCondition = updates[String(patient.id)];
            if (!updatedCondition) return patient;

            return {
                ...patient,
                condition: updatedCondition
            };
        });
    }

    /* =========================================================
       RENDER TABLE
    ========================================================= */

    function renderPatients(data) {
        if (!patientTableBody) return;

        if (!data || data.length === 0) {
            showEmpty();
            return;
        }

        if (patientsCount) {
            patientsCount.textContent = data.length;
        }

        patientTableBody.innerHTML = data.map(patient => {
            const gender =
                patient.gender === "Male"
                    ? "ذكر"
                    : patient.gender === "Female"
                        ? "أنثى"
                        : patient.gender || "-";

            const bloodType = patient.bloodType || patient.blood_type || "-";

            return `
                <tr class="border-b border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">

                    <td class="px-5 py-4 text-sm font-bold text-slate-800 dark:text-white">
                        ${escapeHTML(patient.name || "-")}
                    </td>

                    <td class="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                        ${escapeHTML(patient.age || "-")}
                    </td>

                    <td class="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                        ${escapeHTML(gender)}
                    </td>

                    <td class="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                        ${escapeHTML(patient.phone || "-")}
                    </td>

                    <td class="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                        ${escapeHTML(bloodType)}
                    </td>

                    <td class="px-5 py-4">
                        ${getConditionBadge(patient.condition)}
                    </td>

                    <td class="px-5 py-4">
                        <a href="patient-details.html?id=${escapeHTML(patient.id)}"
                           class="inline-block rounded-xl bg-green-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-green-700">
                            عرض التفاصيل
                        </a>
                    </td>

                </tr>
            `;
        }).join("");
    }

    function escapeHTML(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    /* =========================================================
       SEARCH + FILTER
    ========================================================= */

    function filterPatients() {
        const searchValue = patientSearch ? patientSearch.value.trim().toLowerCase() : "";
        const filterValue = conditionFilter ? conditionFilter.value : "all";

        filteredPatients = patients.filter(patient => {
            const name = String(patient.name || "").toLowerCase();
            const matchesSearch = !searchValue || name.includes(searchValue);
            let matchesCondition = true;

            if (filterValue && filterValue !== "all" && filterValue !== "الكل") {
                const patientCondition = normalizeCondition(patient.condition);

                if (filterValue === "stable" || filterValue === "مستقرة" || filterValue === "مستقر") {
                    matchesCondition = patientCondition === "Stable";
                }

                if (
                    filterValue === "followup" ||
                    filterValue === "follow-up" ||
                    filterValue === "needs-follow-up" ||
                    filterValue === "تحتاج إلى متابعة" ||
                    filterValue === "متابعة"
                ) {
                    matchesCondition = patientCondition === "Needs Follow-up";
                }

                if (filterValue === "critical" || filterValue === "حرجة" || filterValue === "حرج") {
                    matchesCondition = patientCondition === "Critical";
                }
            }

            return matchesSearch && matchesCondition;
        });

        renderPatients(filteredPatients);
    }

    /* =========================================================
       DARK MODE
    ========================================================= */

    function initializeDarkMode() {
        const savedTheme = localStorage.getItem("theme");

        if (savedTheme === "dark") {
            document.documentElement.classList.add("dark");
        } else if (savedTheme === "light") {
            document.documentElement.classList.remove("dark");
        } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
            document.documentElement.classList.add("dark");
        }

        updateDarkModeIcon();
    }

    function updateDarkModeIcon() {
        if (!darkModeToggle) return;

        const icon = darkModeToggle.querySelector("i");
        if (!icon) return;

        const isDark = document.documentElement.classList.contains("dark");
        icon.className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
    }

    function toggleDarkMode() {
        const isDark = document.documentElement.classList.toggle("dark");
        localStorage.setItem("theme", isDark ? "dark" : "light");
        updateDarkModeIcon();
    }

    /* =========================================================
       NOTIFICATIONS
    ========================================================= */

    function renderNotifications() {
        if (notificationCount) notificationCount.textContent = "0";

        if (notificationBadge) {
            notificationBadge.textContent = "0";
            notificationBadge.classList.add("hidden");
            notificationBadge.classList.remove("flex");
        }

        if (notificationList) {
            notificationList.innerHTML = `
                <div class="rounded-lg border border-dashed border-slate-200 px-4 py-5 text-center dark:border-slate-700">
                    <i class="fa-regular fa-bell mb-2 text-xl text-slate-300 dark:text-slate-600"></i>
                    <p class="text-sm font-bold text-slate-700 dark:text-slate-200">
                        لا توجد إشعارات
                    </p>
                    <p class="mt-1 text-[11px] leading-5 text-slate-400">
                        ستظهر هنا تنبيهات الحالات والمواعيد.
                    </p>
                </div>
            `;
        }
    }

    function toggleNotifications() {
        if (!notificationPanel) return;

        const isHidden = notificationPanel.classList.contains("hidden");

        if (isHidden) {
            notificationPanel.classList.remove("hidden");
            notificationButton?.setAttribute("aria-expanded", "true");
        } else {
            notificationPanel.classList.add("hidden");
            notificationButton?.setAttribute("aria-expanded", "false");
        }
    }

    function closeNotificationsOutside(event) {
        if (!notificationPanel || !notificationButton) return;

        if (!notificationPanel.contains(event.target) && !notificationButton.contains(event.target)) {
            notificationPanel.classList.add("hidden");
            notificationButton.setAttribute("aria-expanded", "false");
        }
    }

    /* =========================================================
       REFRESH & EVENTS
    ========================================================= */

    function refreshPatientStatuses() {
        if (!patients.length) return;
        applySavedUpdates();
        filterPatients();
        renderNotifications();
    }

    patientSearch?.addEventListener("input", filterPatients);
    conditionFilter?.addEventListener("change", filterPatients);
    darkModeToggle?.addEventListener("click", toggleDarkMode);
    notificationButton?.addEventListener("click", toggleNotifications);

    markAllRead?.addEventListener("click", () => {
        renderNotifications();
    });

    document.addEventListener("click", closeNotificationsOutside);

    window.addEventListener("storage", event => {
        refreshPatientStatuses();
    });

    setInterval(() => {
        if (patients.length > 0) {
            refreshPatientStatuses();
        }
    }, 1000);

    /* =========================================================
       LOAD PATIENTS
    ========================================================= */

    async function loadPatients() {
        showLoading();

        const possiblePaths = [
            "../src/data/patients.json",
            "src/data/patients.json",
            "/src/data/patients.json",
            "../data/patients.json"
        ];

        let lastError = null;

        for (const path of possiblePaths) {
            try {
                const response = await fetch(path, { cache: "no-store" });

                if (!response.ok) {
                    throw new Error(`HTTP Error: ${response.status}`);
                }

                const data = await response.json();

                if (!Array.isArray(data)) {
                    throw new Error("patients.json لا يحتوي على Array");
                }

                patients = data.map(patient => ({
                    ...patient,
                    condition: normalizeCondition(patient.condition)
                }));

                applySavedUpdates();
                hideLoading();
                filterPatients();
                renderNotifications();

                return;

            } catch (error) {
                console.warn(`فشل تحميل البيانات من ${path}:`, error);
                lastError = error;
            }
        }

        console.error("Patients loading error:", lastError);
        showLoadingError("تعذر تحميل بيانات المرضى");
    }

    /* =========================================================
       START
    ========================================================= */

    initializeDarkMode();
    renderNotifications();
    loadPatients();


    //ايقونة الموبايل 
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
});