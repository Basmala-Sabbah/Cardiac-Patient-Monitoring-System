document.addEventListener("DOMContentLoaded", () => {

    /* =====================================================
       GLOBAL DATA
    ===================================================== */

    let patients = [];
    let appointments = [];


    /* =====================================================
       ELEMENTS
    ===================================================== */

    const darkModeToggle =
        document.getElementById("darkModeToggle");

    const notificationButton =
        document.getElementById("notificationButton");

    const notificationPanel =
        document.getElementById("notificationPanel");

    const patientSearch =
        document.getElementById("patientSearch");

    const statusFilter =
        document.getElementById("statusFilter");

    const patientsTableBody =
        document.getElementById("patientsTableBody");

    const loadingState =
        document.getElementById("loadingState");

    const emptyState =
        document.getElementById("emptyState");

    const errorState =
        document.getElementById("errorState");

    const errorMessage =
        document.getElementById("errorMessage");


    /* =====================================================
       DARK MODE
       نفس نظام صفحات المشروع
    ===================================================== */

    function setupDarkMode() {

        const savedTheme =
            localStorage.getItem("theme");

        const isDark =
            savedTheme === "dark";

        document.documentElement.classList.toggle(
            "dark",
            isDark
        );

        updateDarkModeIcon(isDark);


        if (!darkModeToggle) return;


        darkModeToggle.addEventListener("click", () => {

            const dark =
                document.documentElement.classList.toggle("dark");

            localStorage.setItem(
                "theme",
                dark ? "dark" : "light"
            );

            updateDarkModeIcon(dark);

        });

    }


    function updateDarkModeIcon(isDark) {

        if (!darkModeToggle) return;

        darkModeToggle.innerHTML = isDark
            ? '<i class="fa-solid fa-sun"></i>'
            : '<i class="fa-solid fa-moon"></i>';

    }


    /* =====================================================
       NOTIFICATIONS
    ===================================================== */

    function setupNotifications() {

        if (!notificationButton || !notificationPanel) {
            return;
        }


        notificationButton.addEventListener("click", event => {

            event.stopPropagation();

            notificationPanel.classList.toggle("hidden");

            notificationButton.setAttribute(
                "aria-expanded",
                String(
                    !notificationPanel.classList.contains("hidden")
                )
            );

        });


        document.addEventListener("click", event => {

            if (
                !notificationPanel.contains(event.target) &&
                !notificationButton.contains(event.target)
            ) {

                notificationPanel.classList.add("hidden");

                notificationButton.setAttribute(
                    "aria-expanded",
                    "false"
                );

            }

        });

    }


    /* =====================================================
       LOAD DATA
    ===================================================== */

    async function loadData() {

        try {

            loadingState?.classList.remove("hidden");
            errorState?.classList.add("hidden");
            emptyState?.classList.add("hidden");


            const [
                patientsResponse,
                appointmentsResponse
            ] = await Promise.all([

                fetch("../src/data/patients.json", {
                    cache: "no-store"
                }),

                fetch("../src/data/appointments.json", {
                    cache: "no-store"
                })

            ]);


            if (!patientsResponse.ok) {

                throw new Error(
                    `patients.json - ${patientsResponse.status}`
                );

            }


            if (!appointmentsResponse.ok) {

                throw new Error(
                    `appointments.json - ${appointmentsResponse.status}`
                );

            }


            patients =
                await patientsResponse.json();


            /*
             * المواعيد المضافة من صفحة المواعيد
             * لها الأولوية على JSON
             */

            const savedAppointments =
                localStorage.getItem("nabd_appointments");


            if (savedAppointments) {

                try {

                    appointments =
                        JSON.parse(savedAppointments);

                } catch {

                    appointments =
                        await appointmentsResponse.json();

                }

            } else {

                appointments =
                    await appointmentsResponse.json();

            }


            /*
             * تطبيق تحديثات حالات المرضى
             * الموجودة في LocalStorage
             */

            applySavedPatientUpdates();


            updateStatistics();

            renderPatientsTable();

            loadingState?.classList.add("hidden");


        } catch (error) {

            console.error(
                "REPORTS DATA ERROR:",
                error
            );

            loadingState?.classList.add("hidden");

            errorState?.classList.remove("hidden");

            if (errorMessage) {

                errorMessage.textContent =
                    "تعذر الوصول إلى ملفات البيانات. تأكد من مسارات patients.json و appointments.json.";

            }

        }

    }


    /* =====================================================
       PATIENT UPDATES
       نفس مفاتيح المشروع
    ===================================================== */

    function applySavedPatientUpdates() {

        const updates =
            getSavedPatientUpdates();


        patients =
            patients.map(patient => {

                const updatedCondition =
                    updates[String(patient.id)];


                return {

                    ...patient,

                    condition:
                        updatedCondition ||
                        patient.condition ||
                        "Stable"

                };

            });

    }


    function getSavedPatientUpdates() {

        const updates = {};


        /*
         * doctorPatientUpdates
         */

        try {

            const doctorUpdates =
                JSON.parse(
                    localStorage.getItem(
                        "doctorPatientUpdates"
                    ) || "[]"
                );


            if (Array.isArray(doctorUpdates)) {

                doctorUpdates.forEach(item => {

                    if (
                        item.patientId !== undefined &&
                        item.condition
                    ) {

                        updates[String(item.patientId)] =
                            normalizeCondition(
                                item.condition
                            );

                    }

                });

            }

        } catch (error) {

            console.warn(
                "تعذر قراءة doctorPatientUpdates",
                error
            );

        }


        /*
         * patientUpdates
         */

        try {

            const patientUpdates =
                JSON.parse(
                    localStorage.getItem(
                        "patientUpdates"
                    ) || "{}"
                );


            if (
                patientUpdates &&
                typeof patientUpdates === "object" &&
                !Array.isArray(patientUpdates)
            ) {

                Object.entries(patientUpdates)
                    .forEach(([id, condition]) => {

                        updates[id] =
                            normalizeCondition(
                                condition
                            );

                    });

            }

        } catch (error) {

            console.warn(
                "تعذر قراءة patientUpdates",
                error
            );

        }


        /*
         * باقي مفاتيح المشروع
         */

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

                const raw =
                    localStorage.getItem(key);


                if (!raw) return;


                const parsed =
                    JSON.parse(raw);


                collectUpdates(
                    parsed,
                    updates
                );

            } catch (error) {

                console.warn(
                    `تعذر قراءة ${key}`,
                    error
                );

            }

        });


        return updates;

    }


    function collectUpdates(data, updates) {

        if (!data) return;


        if (Array.isArray(data)) {

            data.forEach(item => {

                collectUpdates(
                    item,
                    updates
                );

            });

            return;

        }


        if (typeof data !== "object") {
            return;
        }


        const patientId =
            data.patientId ??
            data.patient_id ??
            data.patientID ??
            data.id;


        const condition =
            data.condition ??
            data.status ??
            data.state;


        if (
            patientId !== undefined &&
            condition !== undefined
        ) {

            updates[String(patientId)] =
                normalizeCondition(condition);

        }


        Object.values(data)
            .forEach(value => {

                if (
                    value &&
                    typeof value === "object"
                ) {

                    collectUpdates(
                        value,
                        updates
                    );

                }

            });

    }


    /* =====================================================
       CONDITION NORMALIZATION
    ===================================================== */

    function normalizeCondition(condition) {

        const value =
            String(condition || "")
                .trim()
                .toLowerCase();


        if (
            value === "حرجة" ||
            value === "حرج" ||
            value === "critical"
        ) {

            return "Critical";

        }


        if (
            value === "تحتاج إلى متابعة" ||
            value === "تحتاج متابعة" ||
            value === "عاجلة" ||
            value === "needs follow-up"
        ) {

            return "Needs Follow-up";

        }


        return "Stable";

    }


    function isCritical(condition) {

        return normalizeCondition(condition) ===
            "Critical";

    }


    function isFollowUp(condition) {

        return normalizeCondition(condition) ===
            "Needs Follow-up";

    }


    function isStable(condition) {

        return normalizeCondition(condition) ===
            "Stable";

    }


    function translateCondition(condition) {

        if (isCritical(condition)) {
            return "حرج";
        }


        if (isFollowUp(condition)) {
            return "يحتاج متابعة";
        }


        return "مستقر";

    }


    /* =====================================================
       STATISTICS
    ===================================================== */

    function updateStatistics() {

        /*
         * المرضى
         */

        const totalPatients =
            patients.length;


        const stablePatients =
            patients.filter(patient =>
                isStable(patient.condition)
            ).length;


        const criticalPatients =
            patients.filter(patient =>
                isCritical(patient.condition)
            ).length;


        const followUpPatients =
            patients.filter(patient =>
                isFollowUp(patient.condition)
            ).length;


        /*
         * المواعيد
         */

        const totalAppointments =
            appointments.length;


        const urgentAppointments =
            appointments.filter(appointment => {

                return (
                    appointment.status === "عاجل" ||
                    appointment.status === "Urgent" ||
                    appointment.type === "طوارئ"
                );

            }).length;


        const completedAppointments =
            appointments.filter(appointment => {

                return (
                    appointment.status === "مكتمل" ||
                    appointment.status === "مكتملة" ||
                    appointment.status === "Completed" ||
                    appointment.status === "complete" ||
                    appointment.status === "done"
                );

            }).length;


        /*
         * العلامات الحيوية
         */

        const heartRates =
            patients
                .map(patient =>
                    Number(patient.heartRate)
                )
                .filter(value =>
                    Number.isFinite(value) &&
                    value > 0
                );


        const oxygenLevels =
            patients
                .map(patient =>
                    Number(patient.oxygenLevel)
                )
                .filter(value =>
                    Number.isFinite(value) &&
                    value > 0
                );


        const averageHeartRate =
            heartRates.length
                ? Math.round(
                    heartRates.reduce(
                        (sum, value) =>
                            sum + value,
                        0
                    ) / heartRates.length
                )
                : 0;


        const averageOxygen =
            oxygenLevels.length
                ? Math.round(
                    (
                        oxygenLevels.reduce(
                            (sum, value) =>
                                sum + value,
                            0
                        ) / oxygenLevels.length
                    ) * 10
                ) / 10
                : 0;


        /*
         * عرض الأرقام
         */

        setText(
            "totalPatientsCount",
            totalPatients
        );


        setText(
            "stablePatientsCount",
            stablePatients
        );


        setText(
            "criticalPatientsCount",
            criticalPatients
        );


        setText(
            "followUpPatientsCount",
            followUpPatients
        );


        setText(
            "totalAppointmentsCount",
            totalAppointments
        );


        setText(
            "averageHeartRate",
            averageHeartRate
                ? `${averageHeartRate} نبضة/دقيقة`
                : "--"
        );


        setText(
            "averageOxygen",
            averageOxygen
                ? `${averageOxygen}%`
                : "--"
        );


        setText(
            "urgentAppointmentsCount",
            urgentAppointments
        );


        setText(
            "completedAppointmentsCount",
            completedAppointments
        );

    }


    function setText(id, value) {

        const element =
            document.getElementById(id);


        if (element) {

            element.textContent =
                value;

        }

    }


    /* =====================================================
       PATIENT TABLE
    ===================================================== */

    function renderPatientsTable() {

        if (!patientsTableBody) {
            return;
        }


        const search =
            patientSearch
                ? patientSearch.value
                    .trim()
                    .toLowerCase()
                : "";


        const status =
            statusFilter
                ? statusFilter.value
                : "all";


        const filteredPatients =
            patients.filter(patient => {

                const name =
                    String(
                        patient.name || ""
                    ).toLowerCase();


                const matchesSearch =
                    name.includes(search);


                let matchesStatus = true;


                if (status === "stable") {

                    matchesStatus =
                        isStable(
                            patient.condition
                        );

                }


                if (status === "follow") {

                    matchesStatus =
                        isFollowUp(
                            patient.condition
                        );

                }


                if (status === "critical") {

                    matchesStatus =
                        isCritical(
                            patient.condition
                        );

                }


                return (
                    matchesSearch &&
                    matchesStatus
                );

            });


        patientsTableBody.innerHTML = "";


        if (!filteredPatients.length) {

            emptyState?.classList.remove("hidden");

            return;

        }


        emptyState?.classList.add("hidden");


        filteredPatients.forEach(patient => {

            const row =
                document.createElement("tr");


            row.className =
                "transition hover:bg-slate-50 dark:hover:bg-slate-800/50";


            row.innerHTML = `

                <td class="px-5 py-4">

                    <div class="flex items-center gap-3">

                        <div
                            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400">

                            <i class="fa-solid fa-user"></i>

                        </div>

                        <div class="min-w-0">

                            <p
                                class="truncate text-sm font-bold text-slate-800 dark:text-slate-200">

                                ${escapeHTML(patient.name)}

                            </p>

                            <p
                                class="mt-1 truncate text-[10px] text-slate-400">

                                ${escapeHTML(patient.diagnosis || "مريض")}

                            </p>

                        </div>

                    </div>

                </td>


                <td class="px-5 py-4">

                    ${getConditionBadge(
                        patient.condition
                    )}

                </td>


                <td class="px-5 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">

                    ${patient.heartRate ?? "--"}

                    ${
                        patient.heartRate
                            ? " نبضة/دقيقة"
                            : ""
                    }

                </td>


                <td
                    class="px-5 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300"
                    dir="ltr">

                    ${escapeHTML(
                        patient.bloodPressure ||
                        "--"
                    )}

                </td>


                <td class="px-5 py-4">

                    <span
                        class="${
                            getOxygenClass(
                                patient.oxygenLevel
                            )
                        }">

                        ${
                            patient.oxygenLevel ??
                            "--"
                        }%

                    </span>

                </td>

            `;


            patientsTableBody.appendChild(row);

        });

    }


    /* =====================================================
       CONDITION BADGE
    ===================================================== */

    function getConditionBadge(condition) {

        if (isCritical(condition)) {

            return `

                <span
                    class="inline-flex rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-600 dark:bg-red-950/30 dark:text-red-400">

                    حرج

                </span>

            `;

        }


        if (isFollowUp(condition)) {

            return `

                <span
                    class="inline-flex rounded-lg bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">

                    يحتاج متابعة

                </span>

            `;

        }


        return `

            <span
                class="inline-flex rounded-lg bg-green-50 px-3 py-1.5 text-[11px] font-bold text-green-600 dark:bg-green-950/30 dark:text-green-400">

                مستقر

            </span>

        `;

    }


    /* =====================================================
       OXYGEN STYLE
    ===================================================== */

    function getOxygenClass(oxygen) {

        const value =
            Number(oxygen);


        if (value < 92) {

            return `
                inline-flex rounded-lg
                bg-red-50 px-3 py-1.5
                text-[11px] font-bold
                text-red-500
                dark:bg-red-950/30
                dark:text-red-400
            `;

        }


        if (value < 95) {

            return `
                inline-flex rounded-lg
                bg-amber-50 px-3 py-1.5
                text-[11px] font-bold
                text-amber-600
                dark:bg-amber-950/30
                dark:text-amber-400
            `;

        }


        return `
            inline-flex rounded-lg
            bg-green-50 px-3 py-1.5
            text-[11px] font-bold
            text-green-600
            dark:bg-green-950/30
            dark:text-green-400
        `;

    }


    /* =====================================================
       SEARCH
    ===================================================== */

    patientSearch?.addEventListener(
        "input",
        renderPatientsTable
    );


    statusFilter?.addEventListener(
        "change",
        renderPatientsTable
    );


    /* =====================================================
       LOCAL STORAGE CHANGES
    ===================================================== */

    window.addEventListener(
        "storage",
        event => {

            /*
             * إذا تغيرت المواعيد
             */

            if (
                event.key ===
                "nabd_appointments"
            ) {

                try {

                    appointments =
                        JSON.parse(
                            event.newValue || "[]"
                        );


                    updateStatistics();

                } catch (error) {

                    console.error(
                        "خطأ في تحديث المواعيد:",
                        error
                    );

                }

            }


            /*
             * إذا تغيرت حالات المرضى
             */

            if (
                event.key ===
                    "doctorPatientUpdates" ||

                event.key ===
                    "patientUpdates" ||

                event.key ===
                    "followUpRecords" ||

                event.key ===
                    "followUpData"
            ) {

                applySavedPatientUpdates();

                updateStatistics();

                renderPatientsTable();

            }

        }
    );


    /* =====================================================
       SECURITY / HTML
    ===================================================== */

    function escapeHTML(value) {

        if (
            value === null ||
            value === undefined
        ) {

            return "";

        }


        return String(value)

            .replace(
                /&/g,
                "&amp;"
            )

            .replace(
                /</g,
                "&lt;"
            )

            .replace(
                />/g,
                "&gt;"
            )

            .replace(
                /"/g,
                "&quot;"
            )

            .replace(
                /'/g,
                "&#039;"
            );

    }


    /* =====================================================
       START
    ===================================================== */

    setupDarkMode();

    setupNotifications();

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