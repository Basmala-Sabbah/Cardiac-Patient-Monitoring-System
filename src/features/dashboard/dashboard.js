document.addEventListener("DOMContentLoaded", () => {

    const darkModeToggle = document.getElementById("darkModeToggle");
    const notificationButton = document.getElementById("notificationButton");
    const notificationPanel = document.getElementById("notificationPanel");
    const notificationBadge = document.getElementById("notificationBadge");
    const notificationCount = document.getElementById("notificationCount");
    const notificationList = document.getElementById("notificationList");

    let patients = [];
    let appointments = [];
    let users = [];

    const PATIENT_UPDATES_KEY = "doctorPatientUpdates";
    const GENERAL_UPDATES_KEY = "patientUpdates";
    const FOLLOW_UP_HISTORY_KEY = "doctorFollowUpHistory";

    function setupDarkMode() {
        const savedTheme = localStorage.getItem("theme");
        const isDark = savedTheme === "dark";
        document.documentElement.classList.toggle("dark", isDark);
        updateDarkModeIcon(isDark);

        if (!darkModeToggle) return;

        darkModeToggle.addEventListener("click", () => {
            const dark = document.documentElement.classList.toggle("dark");
            localStorage.setItem("theme", dark ? "dark" : "light");
            updateDarkModeIcon(dark);
        });
    }

    function updateDarkModeIcon(isDark) {
        if (darkModeToggle) {
            darkModeToggle.innerHTML = isDark
                ? '<i class="fa-solid fa-sun"></i>'
                : '<i class="fa-solid fa-moon"></i>';
        }
    }

    async function loadData() {
        try {
            const [patientsResponse, appointmentsResponse, usersResponse] = await Promise.all([
                fetch("../src/data/patients.json"),
                fetch("../src/data/appointments.json"),
                fetch("../src/data/users.json")
            ]);

            if (!patientsResponse.ok) throw new Error(`patients.json - ${patientsResponse.status}`);
            if (!appointmentsResponse.ok) throw new Error(`appointments.json - ${appointmentsResponse.status}`);
            if (!usersResponse.ok) throw new Error(`users.json - ${usersResponse.status}`);

            patients = await patientsResponse.json();
            users = await usersResponse.json();

            const savedApps = localStorage.getItem("nabd_appointments");
            if (savedApps) {
                try {
                    appointments = JSON.parse(savedApps);
                } catch (e) {
                    appointments = await appointmentsResponse.json();
                }
            } else {
                appointments = await appointmentsResponse.json();
            }

            loadSavedPatientUpdates();
            initializeDashboard();

        } catch (error) {
            console.error("ERROR LOADING DASHBOARD DATA:", error);
            showDataError(error);
        }
    }

    function loadSavedPatientUpdates() {
        try {
            const saved = JSON.parse(localStorage.getItem(PATIENT_UPDATES_KEY) || "[]");

            if (!Array.isArray(saved)) return;

            saved.forEach(update => {
                const patient = patients.find(
                    p => String(p.id) === String(update.patientId)
                );

                if (!patient) return;

                if (update.condition) patient.condition = update.condition;
                if (update.note !== undefined) patient.followUpNote = update.note;
                if (update.date) patient.lastFollowUp = update.date;
            });

        } catch (error) {
            console.error("خطأ في تحميل تعديلات المرضى:", error);
        }
    }

    function getSavedUpdates() {
        try {
            const data = JSON.parse(
                localStorage.getItem(PATIENT_UPDATES_KEY) || "[]"
            );

            return Array.isArray(data) ? data : [];

        } catch {
            return [];
        }
    }

    function getFollowUpHistory() {
        try {
            const data = JSON.parse(
                localStorage.getItem(FOLLOW_UP_HISTORY_KEY) || "[]"
            );

            return Array.isArray(data) ? data : [];

        } catch {
            return [];
        }
    }

    function mapConditionToEnglish(condition) {
        if (condition === "حرجة" || condition === "Critical") return "Critical";
        if (condition === "تحتاج إلى متابعة" || condition === "تحتاج متابعة" || condition === "عاجلة" || condition === "Needs Follow-up") return "Needs Follow-up";
        return "Stable";
    }

    function savePatientUpdate(patientId, condition, note) {
        try {
            const updates = getSavedUpdates();
            const update = {
                patientId: String(patientId),
                condition,
                note,
                date: new Date().toISOString()
            };

            const index = updates.findIndex(
                item => String(item.patientId) === String(patientId)
            );

            if (index !== -1) {
                updates[index] = update;
            } else {
                updates.push(update);
            }

            localStorage.setItem(PATIENT_UPDATES_KEY, JSON.stringify(updates));

            let generalUpdates = {};
            try {
                generalUpdates = JSON.parse(localStorage.getItem(GENERAL_UPDATES_KEY) || "{}");
                if (Array.isArray(generalUpdates)) generalUpdates = {};
            } catch (e) {
                generalUpdates = {};
            }

            generalUpdates[String(patientId)] = mapConditionToEnglish(condition);
            localStorage.setItem(GENERAL_UPDATES_KEY, JSON.stringify(generalUpdates));

            window.dispatchEvent(new Event("storage"));

            return update;

        } catch (error) {
            console.error("خطأ في حفظ تحديث المريض:", error);
            return null;
        }
    }

    function saveFollowUpHistory(patient, condition, note) {
        try {
            const history = getFollowUpHistory();

            history.unshift({
                id: Date.now().toString(),
                patientId: String(patient.id),
                patientName: patient.name,
                condition,
                note,
                date: new Date().toISOString()
            });

            localStorage.setItem(
                FOLLOW_UP_HISTORY_KEY,
                JSON.stringify(history.slice(0, 50))
            );

            return true;

        } catch (error) {
            console.error("خطأ في حفظ سجل المتابعة:", error);
            return false;
        }
    }

    function initializeDashboard() {
        updateStatistics();
        populatePatientSelect();
        renderFollowUpRecords();
        renderLatestPatients();
        renderCriticalPatients();
        renderFollowUpPatients();
        renderUpcomingAppointments();
        renderVitalSigns();

        renderNotificationsUI();
        setupNotifications();
        setupFollowUpForm();
    }

    function setupNotifications() {
        if (!notificationButton || !notificationPanel) return;

        if (notificationButton.dataset.listenerAttached === "true") return;
        notificationButton.dataset.listenerAttached = "true";

        notificationButton.addEventListener("click", event => {
            event.stopPropagation();
            const isHidden = notificationPanel.classList.contains("hidden");
            if (isHidden) {
                notificationPanel.classList.remove("hidden");
                notificationButton.setAttribute("aria-expanded", "true");
            } else {
                notificationPanel.classList.add("hidden");
                notificationButton.setAttribute("aria-expanded", "false");
            }
        });

        document.addEventListener("click", (event) => {
            if (!notificationPanel.contains(event.target) && !notificationButton.contains(event.target)) {
                notificationPanel.classList.add("hidden");
                notificationButton.setAttribute("aria-expanded", "false");
            }
        });
    }

    function renderNotificationsUI() {
        if (notificationBadge) {
            notificationBadge.classList.add("hidden");
            notificationBadge.textContent = "0";
        }

        if (notificationCount) {
            notificationCount.textContent = "0";
        }

        if (notificationList) {
            notificationList.innerHTML = `
                <div class="rounded-lg border border-dashed border-slate-200 px-4 py-5 text-center dark:border-slate-700">
                    <i class="fa-regular fa-bell mb-2 text-xl text-slate-300 dark:text-slate-600"></i>
                    <p class="text-sm font-bold text-slate-700 dark:text-slate-200">لا توجد إشعارات</p>
                    <p class="mt-1 text-[11px] leading-5 text-slate-400">لا توجد تنبيهات مستلمة حالياً.</p>
                </div>
            `;
        }
    }

    function updateStatistics() {
        const total = patients.length;
        const stable = patients.filter(p => isStable(p.condition)).length;
        const critical = patients.filter(p => isCritical(p.condition)).length;
        const followUp = patients.filter(p => isFollowUp(p.condition)).length;
        const upcoming = appointments.filter(a => ["مجدول", "عاجل", "Scheduled", "Urgent"].includes(a.status)).length;

        const elements = {
            totalPatientsCount: total,
            stablePatientsCount: stable,
            criticalPatientsCount: critical,
            followUpPatientsCount: followUp,
            upcomingAppointmentsCount: upcoming
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }

    function renderFollowUpRecords() {
        const container = document.getElementById("followUpRecords");
        if (!container) return;

        const history = getFollowUpHistory();
        container.innerHTML = "";

        if (!history.length) {
            container.innerHTML = `
                <div class="flex min-h-[100px] items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 dark:border-slate-700">
                    لا توجد حالات متابعة مسجلة بعد
                </div>
            `;
            return;
        }

        history.slice(0, 10).forEach(record => {
            const element = document.createElement("div");
            element.className = "flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40";
            element.innerHTML = `
                <div class="flex min-w-0 items-center gap-3">
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${getHistoryIconBackground(record.condition)} ${getHistoryIconColor(record.condition)}">
                        <i class="fa-solid ${getHistoryIcon(record.condition)}"></i>
                    </div>
                    <div class="min-w-0">
                        <p class="truncate text-sm font-bold text-slate-800 dark:text-slate-200">${escapeHTML(record.patientName)}</p>
                        <p class="mt-1 truncate text-[11px] text-slate-400">${escapeHTML(record.note)}</p>
                    </div>
                </div>
                <div class="shrink-0 text-left">
                    <span class="${getConditionClass(record.condition)}">${translateCondition(record.condition)}</span>
                    <p class="mt-1 text-[9px] text-slate-400">${formatDateTime(record.date)}</p>
                </div>
            `;
            container.appendChild(element);
        });
    }

    function renderLatestPatients() {
        const container = document.getElementById("latestPatientsList");
        if (!container) return;

        const updates = getSavedUpdates();
        const updateMap = new Map(updates.map(item => [String(item.patientId), item.date]));

        const latest = [...patients]
            .sort((a, b) => {
                const dateA = updateMap.get(String(a.id)) || "";
                const dateB = updateMap.get(String(b.id)) || "";
                if (dateA && dateB) return dateB.localeCompare(dateA);
                if (dateA) return -1;
                if (dateB) return 1;
                return Number(b.id) - Number(a.id);
            })
            .slice(0, 5);

        container.innerHTML = "";
        latest.forEach(patient => {
            const element = document.createElement("div");
            element.className = "flex items-center justify-between gap-4 py-3";
            element.innerHTML = `
                <div class="flex min-w-0 items-center gap-3">
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400">
                        <i class="fa-solid fa-user"></i>
                    </div>
                    <div class="min-w-0">
                        <p class="truncate text-sm font-bold text-slate-800 dark:text-slate-200">${escapeHTML(patient.name)}</p>
                        <p class="mt-1 text-[11px] text-slate-400">${escapeHTML(patient.diagnosis)}</p>
                    </div>
                </div>
                <span class="${getConditionClass(patient.condition)}">${translateCondition(patient.condition)}</span>
            `;
            container.appendChild(element);
        });
    }

    function renderCriticalPatients() {
        const container = document.getElementById("criticalPatientsList");
        if (!container) return;

        const critical = patients.filter(p => isCritical(p.condition));
        container.innerHTML = "";

        if (!critical.length) {
            container.innerHTML = `<div class="flex min-h-[160px] items-center justify-center text-xs text-slate-400">لا توجد حالات حرجة حاليًا</div>`;
            return;
        }

        critical.forEach(patient => {
            const element = document.createElement("div");
            element.className = "flex items-center justify-between gap-4 py-3";
            element.innerHTML = `
                <div class="flex min-w-0 items-center gap-3">
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400">
                        <i class="fa-solid fa-heart-circle-exclamation"></i>
                    </div>
                    <div class="min-w-0">
                        <p class="truncate text-sm font-bold text-slate-800 dark:text-slate-200">${escapeHTML(patient.name)}</p>
                        <p class="mt-1 text-[11px] text-slate-400">${escapeHTML(patient.diagnosis)}</p>
                    </div>
                </div>
                <div class="text-left">
                    <p class="text-xs font-bold text-red-500">${patient.heartRate} BPM</p>
                    <p class="mt-1 text-[10px] text-slate-400">${patient.oxygenLevel}% O₂</p>
                </div>
            `;
            container.appendChild(element);
        });
    }

    function renderFollowUpPatients() {
        const container = document.getElementById("followUpPatientsList");
        if (!container) return;

        const followUp = patients.filter(p => isFollowUp(p.condition));
        container.innerHTML = "";

        if (!followUp.length) {
            container.innerHTML = `<div class="flex min-h-[160px] items-center justify-center text-xs text-slate-400">لا توجد حالات تحتاج متابعة حاليًا</div>`;
            return;
        }

        followUp.forEach(patient => {
            const element = document.createElement("div");
            element.className = "flex items-center justify-between gap-4 py-3";
            element.innerHTML = `
                <div class="flex min-w-0 items-center gap-3">
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
                        <i class="fa-solid fa-user-clock"></i>
                    </div>
                    <div class="min-w-0">
                        <p class="truncate text-sm font-bold text-slate-800 dark:text-slate-200">${escapeHTML(patient.name)}</p>
                        <p class="mt-1 text-[11px] text-slate-400">${escapeHTML(patient.diagnosis)}</p>
                    </div>
                </div>
                <span class="${getConditionClass(patient.condition)}">${translateCondition(patient.condition)}</span>
            `;
            container.appendChild(element);
        });
    }

    function renderUpcomingAppointments() {
        const container = document.getElementById("upcomingAppointmentsList");
        if (!container) return;

        const upcoming = appointments
            .filter(a => !a.status || ["مجدول", "عاجل", "Scheduled", "Urgent", "مؤكد", "Confirmed"].includes(a.status))
            .sort((a, b) => {
                const dateA = a.date || "";
                const dateB = b.date || "";
                return dateB.localeCompare(dateA);
            })
            .slice(0, 5);

        container.innerHTML = "";

        if (!upcoming.length) {
            container.innerHTML = `<div class="flex min-h-[160px] items-center justify-center text-xs text-slate-400">لا توجد مواعيد قادمة</div>`;
            return;
        }

        upcoming.forEach(appointment => {
            const patient = patients.find(p => String(p.id) === String(appointment.patientId));
            const patientName = patient ? patient.name : (appointment.patientName || appointment.patient || "مريض");
            const urgent = ["عاجل", "Urgent"].includes(appointment.status) || appointment.type === "طوارئ";

            const element = document.createElement("div");
            element.className = "flex items-center justify-between gap-4 py-3";
            element.innerHTML = `
                <div class="flex min-w-0 items-center gap-3">
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${urgent ? "bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400" : "bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400"}">
                        <i class="fa-regular fa-calendar-check"></i>
                    </div>
                    <div class="min-w-0">
                        <p class="truncate text-sm font-bold text-slate-800 dark:text-slate-200">${escapeHTML(patientName)}</p>
                        <p class="mt-1 truncate text-[11px] text-slate-400">${escapeHTML(appointment.reason || appointment.notes || "موعد طبي")}</p>
                    </div>
                </div>
                <div class="shrink-0 text-left">
                    <p class="text-xs font-bold text-slate-700 dark:text-slate-200">${appointment.time || "--:--"}</p>
                    <p class="mt-1 text-[10px] text-slate-400">${formatDate(appointment.date)}</p>
                </div>
            `;
            container.appendChild(element);
        });
    }

    function renderVitalSigns() {
        const tbody = document.getElementById("vitalSignsTableBody");
        if (!tbody) return;

        tbody.innerHTML = "";

        patients.forEach(patient => {
            const status = getVitalStatus(patient);
            const row = document.createElement("tr");

            row.className = "border-b border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40";
            row.innerHTML = `
                <td class="px-4 py-4">
                    <div class="flex items-center gap-3">
                        <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400">
                            <i class="fa-solid fa-user"></i>
                        </div>
                        <div>
                            <p class="text-xs font-bold text-slate-800 dark:text-slate-200">${escapeHTML(patient.name)}</p>
                            <p class="mt-1 text-[10px] text-slate-400">${escapeHTML(patient.diagnosis)}</p>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-4 text-xs font-bold text-slate-700 dark:text-slate-200">${patient.heartRate} BPM</td>
                <td class="px-4 py-4 text-xs font-bold text-slate-700 dark:text-slate-200">${escapeHTML(patient.bloodPressure)}</td>
                <td class="px-4 py-4 text-xs font-bold text-slate-700 dark:text-slate-200">${patient.oxygenLevel}%</td>
                <td class="px-4 py-4"><span class="${status.class}">${status.text}</span></td>
            `;
            tbody.appendChild(row);
        });
    }

    // الاعتماد المباشر على حالة المريض المسجلة في الـ State
    function getVitalStatus(patient) {
        if (isCritical(patient.condition)) {
            return { text: "حرجة", class: "rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-500 dark:bg-red-950/30 dark:text-red-400" };
        }
        if (isFollowUp(patient.condition)) {
            return { text: "تحتاج متابعة", class: "rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-600 dark:bg-amber-950/30 dark:text-amber-400" };
        }
        return { text: "مستقرة", class: "rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-bold text-green-600 dark:bg-green-950/30 dark:text-green-400" };
    }

    function populatePatientSelect() {
        const patientSelect = document.getElementById("patientSelect");
        const conditionSelect = document.getElementById("conditionSelect");

        if (!patientSelect || !conditionSelect) return;

        patientSelect.innerHTML = '<option value="" selected disabled>اختر المريض</option>';

        patients.forEach(patient => {
            const option = document.createElement("option");
            option.value = patient.id;
            option.textContent = patient.name;
            patientSelect.appendChild(option);
        });

        conditionSelect.innerHTML = `
            <option value="" selected disabled>اختر الحالة</option>
            <option value="مستقرة">مستقرة</option>
            <option value="تحتاج إلى متابعة">تحتاج إلى متابعة</option>
            <option value="حرجة">حرجة</option>
        `;

        patientSelect.addEventListener("change", () => {
            const patient = patients.find(p => String(p.id) === String(patientSelect.value));
            const noteInput = document.getElementById("followUpNote");
            if (patient && noteInput) {
                noteInput.placeholder = `أدخل ملاحظة متابعة للمريض ${patient.name}`;
            }
        });
    }

    function setupFollowUpForm() {
        const patientSelect = document.getElementById("patientSelect");
        const conditionSelect = document.getElementById("conditionSelect");
        const noteInput = document.getElementById("followUpNote");
        const saveButton = document.getElementById("saveFollowUp");

        if (!patientSelect || !conditionSelect || !noteInput || !saveButton) return;

        if (saveButton.dataset.listenerAttached === "true") return;
        saveButton.dataset.listenerAttached = "true";

        saveButton.addEventListener("click", event => {
            event.preventDefault();

            const patientId = patientSelect.value;
            const condition = conditionSelect.value;
            const note = noteInput.value.trim();

            if (!patientId || !condition || !note) {
                showAlert("يرجى ملء جميع الحقول المطلوبة.", "warning");
                return;
            }

            const patient = patients.find(p => String(p.id) === String(patientId));
            if (!patient) return;

            patient.condition = condition;
            patient.followUpNote = note;
            patient.lastFollowUp = new Date().toISOString();

            savePatientUpdate(patient.id, condition, note);
            saveFollowUpHistory(patient, condition, note);

            updateStatistics();
            renderFollowUpRecords();
            renderLatestPatients();
            renderCriticalPatients();
            renderFollowUpPatients();
            renderUpcomingAppointments();
            renderVitalSigns();

            patientSelect.value = "";
            conditionSelect.value = "";
            noteInput.value = "";

            showAlert(`تم حفظ حالة ${patient.name} بنجاح.`, "success");
        });
    }

    function isCritical(condition) { return condition === "حرجة" || condition === "Critical"; }
    function isFollowUp(condition) { return condition === "تحتاج إلى متابعة" || condition === "تحتاج متابعة" || condition === "عاجلة" || condition === "Needs Follow-up"; }
    function isStable(condition) { return condition === "مستقرة" || condition === "Stable"; }

    function translateCondition(condition) {
        if (isCritical(condition)) return "حرجة";
        if (isFollowUp(condition)) return "تحتاج متابعة";
        return "مستقرة";
    }

    function getConditionClass(condition) {
        if (isCritical(condition)) return "rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-500 dark:bg-red-950/30 dark:text-red-400";
        if (isFollowUp(condition)) return "rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-600 dark:bg-amber-950/30 dark:text-amber-400";
        return "rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-bold text-green-600 dark:bg-green-950/30 dark:text-green-400";
    }

    function getHistoryIcon(condition) {
        if (isCritical(condition)) return "fa-triangle-exclamation";
        if (isFollowUp(condition)) return "fa-user-clock";
        return "fa-circle-check";
    }

    function getHistoryIconBackground(condition) {
        if (isCritical(condition)) return "bg-red-50 dark:bg-red-950/30";
        if (isFollowUp(condition)) return "bg-amber-50 dark:bg-amber-950/30";
        return "bg-green-50 dark:bg-green-950/30";
    }

    function getHistoryIconColor(condition) {
        if (isCritical(condition)) return "text-red-500 dark:text-red-400";
        if (isFollowUp(condition)) return "text-amber-600 dark:text-amber-400";
        return "text-green-600 dark:text-green-400";
    }

    function formatDate(date) {
        if (!date) return "";
        const parts = date.split("-");
        return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : date;
    }

    function formatDateTime(date) {
        if (!date) return "";
        const d = new Date(date);
        return isNaN(d.getTime()) ? "" : d.toLocaleDateString("ar-EG") + " " + d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    }

    function escapeHTML(value) {
        if (!value) return "";
        return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function showAlert(message, type = "success") {
        if (typeof Swal !== "undefined") {
            Swal.fire({ icon: type, title: type === "success" ? "تم الحفظ" : "تنبيه", text: message, confirmButtonColor: "#16a34a" });
        } else {
            alert(message);
        }
    }

    function showDataError(error) {
        console.error("Error:", error);
    }

    window.addEventListener("storage", (e) => {
        if (e.key === "nabd_appointments") {
            try {
                appointments = JSON.parse(e.newValue || "[]");
                renderUpcomingAppointments();
                updateStatistics();
            } catch (err) {}
        }
    });

    setupDarkMode();
    loadData();
});

    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    if (menuToggle && sidebar && sidebarOverlay) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.remove('hidden');
            sidebar.classList.add('flex', 'flex-col');
            sidebarOverlay.classList.remove('hidden');
        });

        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.add('hidden');
            sidebar.classList.remove('flex', 'flex-col');
            sidebarOverlay.classList.add('hidden');
        });
    }