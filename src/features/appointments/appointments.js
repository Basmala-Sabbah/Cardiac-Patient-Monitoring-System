document.addEventListener("DOMContentLoaded", () => {
    // 1. تحديد عناصر الواجهة (DOM Elements)
    const darkModeToggle = document.getElementById("darkModeToggle");
    const notificationButton = document.getElementById("notificationButton");
    const notificationPanel = document.getElementById("notificationPanel");
    const notificationBadge = document.getElementById("notificationBadge");
    const notificationCount = document.getElementById("notificationCount");
    const notificationList = document.getElementById("notificationList");
    const markAllRead = document.getElementById("markAllRead");

    const appointmentForm = document.getElementById("appointmentForm");
    const patientSelect = document.getElementById("patientSelect");
    const appointmentDate = document.getElementById("appointmentDate");
    const appointmentTime = document.getElementById("appointmentTime");
    const appointmentStatus = document.getElementById("appointmentStatus");
    const appointmentReason = document.getElementById("appointmentReason");
    const submitBtn = document.getElementById("submitBtn");
    const resetFormBtn = document.getElementById("resetFormBtn");

    const searchInput = document.getElementById("searchInput");
    const filterStatus = document.getElementById("filterStatus");
    const filterDate = document.getElementById("filterDate");
    const appointmentsTableBody = document.getElementById("appointmentsTableBody");

    // البيانات وحالة التعديل
    let patients = [];
    let appointments = [];
    let editingAppointmentId = null;

    /* =========================================================
       1. إدارة الوضع الليلي (DARK MODE)
    ========================================================= */
    function initDarkMode() {
        const savedTheme = localStorage.getItem("theme");
        const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

        if (savedTheme === "dark" || (!savedTheme && systemPrefersDark)) {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
        updateDarkModeIcon();

        darkModeToggle?.addEventListener("click", () => {
            document.documentElement.classList.toggle("dark");
            const isDark = document.documentElement.classList.contains("dark");
            localStorage.setItem("theme", isDark ? "dark" : "light");
            updateDarkModeIcon();
        });
    }

    function updateDarkModeIcon() {
        if (!darkModeToggle) return;
        const isDark = document.documentElement.classList.contains("dark");
        darkModeToggle.innerHTML = isDark
            ? `<i class="fa-solid fa-sun text-slate-500 text-lg"></i>`
            : `<i class="fa-solid fa-moon text-lg"></i>`;
    }

    /* =========================================================
       2. تحميل البيانات (PATIENTS & LOCALSTORAGE DATA)
    ========================================================= */
    async function loadData() {
        showLoadingState();
        try {
            // جلب المرضى
            const patientsRes = await fetch("../src/data/patients.json", { cache: "no-store" });
            if (patientsRes.ok) {
                patients = await patientsRes.json();
            }

            // فحص التخزين المحلي للمواعيد أولاً
            const localApps = localStorage.getItem("nabd_appointments");
            if (localApps) {
                appointments = JSON.parse(localApps);
            } else {
                const appointmentsRes = await fetch("../src/data/appointments.json", { cache: "no-store" });
                if (appointmentsRes.ok) {
                    appointments = await appointmentsRes.json();
                    saveAppointmentsToStorage();
                }
            }

            populatePatientSelect();
            renderAppointmentsTable();
            initNotificationsUI();

        } catch (error) {
            console.error("خطأ في تحميل البيانات:", error);
            showErrorState("حدث خطأ أثناء تحميل جدول المواعيد والمرضى.");
        }
    }

    function saveAppointmentsToStorage() {
        localStorage.setItem("nabd_appointments", JSON.stringify(appointments));
    }

    /* =========================================================
       3. تعبئة قائمة اختيار المريض (Patient Select)
    ========================================================= */
    function populatePatientSelect() {
        if (!patientSelect) return;

        let optionsHTML = `<option value="" selected disabled>اختر المريض</option>`;
        patients.forEach(p => {
            optionsHTML += `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)}</option>`;
        });
        patientSelect.innerHTML = optionsHTML;
    }

    /* =========================================================
       4. عرض جدول المواعيد (RENDER TABLE)
    ========================================================= */
    function renderAppointmentsTable() {
        if (!appointmentsTableBody) return;

        const searchVal = searchInput ? searchInput.value.trim().toLowerCase() : "";
        const statusVal = filterStatus ? filterStatus.value : "الكل";
        const dateVal = filterDate ? filterDate.value : "";

        const filtered = appointments.filter(app => {
            const patient = patients.find(p => String(p.id) === String(app.patientId));
            const patientName = patient ? patient.name.toLowerCase() : "";
            const reason = (app.reason || "").toLowerCase();

            const matchesSearch = !searchVal || patientName.includes(searchVal) || reason.includes(searchVal);
            const matchesStatus = statusVal === "الكل" || app.status === statusVal;
            const matchesDate = !dateVal || app.date === dateVal;

            return matchesSearch && matchesStatus && matchesDate;
        });

        if (filtered.length === 0) {
            appointmentsTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
                        <i class="fa-regular fa-calendar-xmark mb-2 text-2xl"></i>
                        <p class="text-xs font-bold">لا توجد مواعيد مطابقة للبحث</p>
                    </td>
                </tr>
            `;
            return;
        }

        appointmentsTableBody.innerHTML = filtered.map(app => {
            const patient = patients.find(p => String(p.id) === String(app.patientId));

            return `
                <tr class="transition duration-150 hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td class="px-4 py-4 font-bold text-slate-800 dark:text-slate-100">
                        <div class="flex items-center gap-2.5">
                            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400">
                                <i class="fa-solid fa-user text-xs"></i>
                            </div>
                            <a href="./patient-details.html?id=${escapeHTML(app.patientId)}" class="transition hover:text-green-600 dark:hover:text-green-400">
                                ${patient ? escapeHTML(patient.name) : "مريض غير معروف"}
                            </a>
                        </div>
                    </td>
                    <td class="px-4 py-4 font-semibold text-slate-600 dark:text-slate-300">
                        ${formatDate(app.date)}
                    </td>
                    <td class="px-4 py-4 font-semibold text-slate-600 dark:text-slate-300" dir="ltr">
                        ${escapeHTML(app.time)}
                    </td>
                    <td class="px-4 py-4">
                        ${getStatusBadge(app.status)}
                    </td>
                    <td class="px-4 py-4 font-medium text-slate-500 dark:text-slate-400">
                        ${escapeHTML(app.reason || "-")}
                    </td>
                    <td class="px-4 py-4 text-center">
                        <div class="flex items-center justify-center gap-2">
                            <!-- زر التعديل -->
                            <button type="button" onclick="editAppointment('${app.id}')" aria-label="تعديل الموعد" class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-600 dark:border-slate-800 dark:hover:border-amber-900/40 dark:hover:bg-amber-950/20 dark:hover:text-amber-400">
                                <i class="fa-regular fa-pen-to-square text-xs"></i>
                            </button>

                            <!-- زر الحذف -->
                            <button type="button" onclick="deleteAppointment('${app.id}')" aria-label="حذف الموعد" class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-slate-800 dark:hover:border-red-900/40 dark:hover:bg-red-950/20 dark:hover:text-red-400">
                                <i class="fa-regular fa-trash-can text-xs"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    }

    /* =========================================================
       5. إضافة وتعديل الموعد (SUBMIT FORM)
    ========================================================= */
    appointmentForm?.addEventListener("submit", (e) => {
        e.preventDefault();

        const selectedPatientId = patientSelect.value;
        const date = appointmentDate.value;
        const time = appointmentTime.value;
        const status = appointmentStatus.value;
        const reason = appointmentReason.value.trim();

        if (!selectedPatientId || !date || !time) {
            Swal.fire({
                icon: 'warning',
                title: 'تنبيه',
                text: 'يرجى تعبئة اختيار المريض، التاريخ، والوقت بشكل كامل.',
                confirmButtonColor: '#16a34a'
            });
            return;
        }

        if (editingAppointmentId) {
            // كود التعديل
            const index = appointments.findIndex(a => String(a.id) === String(editingAppointmentId));
            if (index !== -1) {
                appointments[index] = {
                    id: editingAppointmentId,
                    patientId: selectedPatientId,
                    date: date,
                    time: time,
                    status: status,
                    reason: reason
                };
            }
            editingAppointmentId = null;
            if (submitBtn) {
                submitBtn.innerHTML = `<i class="fa-solid fa-plus"></i> إضافة موعد`;
            }
        } else {
            // كود الإضافة
            const newAppointment = {
                id: Date.now().toString(),
                patientId: selectedPatientId,
                date: date,
                time: time,
                status: status,
                reason: reason
            };
            appointments.unshift(newAppointment);
        }

        saveAppointmentsToStorage();
        renderAppointmentsTable();
        appointmentForm.reset();

        Swal.fire({
            icon: 'success',
            title: 'تمت العملية',
            text: 'تم حفظ بيانات الموعد بنجاح وتحديث القوائم.',
            timer: 1800,
            showConfirmButton: false
        });
    });

    /* =========================================================
       6. وظيفة التعديل (EDIT APPOINTMENT)
    ========================================================= */
    window.editAppointment = function(id) {
        const app = appointments.find(a => String(a.id) === String(id));
        if (!app) return;

        editingAppointmentId = app.id;

        // ملء النموذج بالبيانات الحالية
        patientSelect.value = app.patientId;
        appointmentDate.value = app.date;
        appointmentTime.value = app.time;
        appointmentStatus.value = app.status;
        appointmentReason.value = app.reason || "";

        // تغيير زر التقديم لتأكيد التعديل
        if (submitBtn) {
            submitBtn.innerHTML = `<i class="fa-solid fa-check"></i> تحديث الموعد`;
        }

        // التمرير السلس لنماذج الإدخال
        window.scrollTo({ top: appointmentForm.offsetTop - 100, behavior: "smooth" });
    };

    /* =========================================================
       7. إعادة ضبط النموذج لوضع الإضافة
    ========================================================= */
    resetFormBtn?.addEventListener("click", () => {
        editingAppointmentId = null;
        appointmentForm.reset();
        if (submitBtn) {
            submitBtn.innerHTML = `<i class="fa-solid fa-plus"></i> إضافة موعد`;
        }
    });

    /* =========================================================
       8. حذف موعد (DELETE APPOINTMENT)
    ========================================================= */
    window.deleteAppointment = function(id) {
        Swal.fire({
            title: 'هل أنت تأكد؟',
            text: "لن تتمكن من استعادة هذا الموعد بعد الحذف!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'نعم، احذفه',
            cancelButtonText: 'إلغاء'
        }).then((result) => {
            if (result.isConfirmed) {
                appointments = appointments.filter(a => String(a.id) !== String(id));
                saveAppointmentsToStorage();
                renderAppointmentsTable();

                Swal.fire({
                    icon: 'success',
                    title: 'تم الحذف',
                    text: 'تم حذف الموعد المحدد بنجاح.',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        });
    };

    /* =========================================================
       9. الإشعارات والتنبيهات
    ========================================================= */
    function initNotificationsUI() {
        if (!notificationButton || !notificationPanel) return;

        notificationButton.addEventListener("click", (e) => {
            e.stopPropagation();
            notificationPanel.classList.toggle("hidden");
        });

        document.addEventListener("click", (e) => {
            if (!notificationPanel.contains(e.target) && !notificationButton.contains(e.target)) {
                notificationPanel.classList.add("hidden");
            }
        });

        markAllRead?.addEventListener("click", () => {
            if (notificationBadge) notificationBadge.classList.add("hidden");
            if (notificationCount) notificationCount.textContent = "0";
            if (notificationList) {
                notificationList.innerHTML = `
                    <div class="rounded-lg border border-dashed border-slate-200 px-4 py-5 text-center dark:border-slate-700">
                        <i class="fa-regular fa-bell mb-2 text-xl text-slate-300 dark:text-slate-600"></i>
                        <p class="text-sm font-bold text-slate-700 dark:text-slate-200">لا توجد إشعارات</p>
                        <p class="mt-1 text-[11px] leading-5 text-slate-400">ستظهر هنا تنبيهات الحالات والمواعيد.</p>
                    </div>
                `;
            }
        });
    }

    /* =========================================================
       10. أدوات مساعدة للتنسيق والتحقق
    ========================================================= */
    function getStatusBadge(status) {
        switch (status) {
            case "عاجل":
                return `<span class="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600 dark:bg-red-950/30 dark:text-red-400">
                    <span class="h-1.5 w-1.5 rounded-full bg-red-500"></span> عاجل
                </span>`;
            case "مكتمل":
                return `<span class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                    <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> مكتمل
                </span>`;
            case "ملغى":
                return `<span class="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    <span class="h-1.5 w-1.5 rounded-full bg-slate-400"></span> ملغى
                </span>`;
            default:
                return `<span class="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-600 dark:bg-sky-950/30 dark:text-sky-400">
                    <span class="h-1.5 w-1.5 rounded-full bg-sky-500"></span> مجدول
                </span>`;
        }
    }

    function formatDate(dateStr) {
        if (!dateStr) return "-";
        const parts = dateStr.split("-");
        return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
    }

    function showLoadingState() {
        if (!appointmentsTableBody) return;
        appointmentsTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="px-4 py-12 text-center text-slate-400">
                    <div class="flex justify-center mb-2">
                        <div class="h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent"></div>
                    </div>
                    <p class="text-xs font-bold">جاري تحميل جدول المواعيد...</p>
                </td>
            </tr>
        `;
    }

    function showErrorState(msg) {
        if (!appointmentsTableBody) return;
        appointmentsTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="px-4 py-12 text-center text-red-500">
                    <i class="fa-solid fa-triangle-exclamation mb-2 text-xl"></i>
                    <p class="text-xs font-bold">${escapeHTML(msg)}</p>
                </td>
            </tr>
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

    // ربط الفلاتر المباشرة
    searchInput?.addEventListener("input", renderAppointmentsTable);
    filterStatus?.addEventListener("change", renderAppointmentsTable);
    filterDate?.addEventListener("change", renderAppointmentsTable);

    // التشغيل الأولي
    initDarkMode();
    loadData();



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