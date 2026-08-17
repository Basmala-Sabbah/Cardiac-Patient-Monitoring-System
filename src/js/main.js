
document.addEventListener("DOMContentLoaded", () => {

    // هاد القسم كله لصفحة ال login 
    // USER SELECTION
    const userCards = document.querySelectorAll(".user-card");
    userCards.forEach((card) => {

        card.addEventListener("click", () => {

            // Get user information
            const role = card.dataset.role;
            const userId = card.dataset.userId;


            // Make sure information exists
            if (!role || !userId) {
                console.error(
                    "User role or user ID is missing."
                );
                return;
            }

            // Save current user
            localStorage.setItem("currentUserRole",role);

            localStorage.setItem("currentUserId",userId);


            // Save login state
            localStorage.setItem("isLoggedIn","true");


            // Go to dashboard
            window.location.href ="./dashboard.html";});
    });
    

    // DARK MODE \\

    const themeToggle =document.getElementById("themeToggle");

    const themeIcon =document.getElementById("themeIcon");

    // Get saved theme
    const savedTheme =localStorage.getItem("theme");

    // APPLY SAVED THEME

    if (savedTheme === "dark") {

        document.documentElement.classList.add("dark");

        if (themeIcon) {
            themeIcon.textContent = "☀";
        }

    } else {

        document.documentElement.classList.remove("dark");

        if (themeIcon) {
            themeIcon.textContent = "☾";
        }

    }

    // THEME TOGGLE

    if (themeToggle) {

        themeToggle.addEventListener("click",() => {

                // Toggle dark class
                document.documentElement.classList.toggle("dark");

                // Check current mode
                const isDark = document.documentElement.classList.contains("dark");

                // Save selected mode
                localStorage.setItem("theme",isDark ? "dark" : "light");

                // Change icon
                if (themeIcon) {
                    themeIcon.textContent =isDark ? "☀" : "☾";
                }
            }
        );
    }

});

    //وهون بنتهي قسم ال login 
  //=====================================================================




  //هون قسم ال index الصفحة العامة 

  //هون قسم الدارك :) 

const darkModeToggle = document.getElementById("darkModeToggle");
const darkModeIcon = document.getElementById("darkModeIcon");


// Check saved theme
const savedTheme = localStorage.getItem("theme");

// Apply saved theme
if (savedTheme === "dark") {
    document.documentElement.classList.add("dark");

    if (darkModeIcon) {
        darkModeIcon.classList.remove("fa-moon");
        darkModeIcon.classList.add("fa-sun");
    }
} else {
    document.documentElement.classList.remove("dark");

    if (darkModeIcon) {
        darkModeIcon.classList.remove("fa-sun");
        darkModeIcon.classList.add("fa-moon");
    }
}

// Toggle dark mode
if (darkModeToggle) {

    darkModeToggle.addEventListener("click", () => {

        document.documentElement.classList.toggle("dark");

        const isDark = document.documentElement.classList.contains("dark");
        // Save theme
        localStorage.setItem(
            "theme",
            isDark ? "dark" : "light"
        );

        // Change icon
        if (darkModeIcon) {

            if (isDark) {
                darkModeIcon.classList.remove("fa-moon");
                darkModeIcon.classList.add("fa-sun");

            } else {
                darkModeIcon.classList.remove("fa-sun");
                darkModeIcon.classList.add("fa-moon");

            }

        }

    });

}


// MOBILE MENU

const menuButton = document.getElementById("menuButton");
const mobileMenu = document.getElementById("mobileMenu");
const menuIcon = document.getElementById("menuIcon");

if (menuButton && mobileMenu) {

    menuButton.addEventListener("click", () => {
        // Show / hide menu
        mobileMenu.classList.toggle("hidden");
        // Check if menu is open
        const isOpen =
            !mobileMenu.classList.contains("hidden");
        // Update accessibility
        menuButton.setAttribute(
            "aria-expanded",
            isOpen
        );

        // Change icon
        if (menuIcon) {
            if (isOpen) {
                menuIcon.classList.remove("fa-bars");
                menuIcon.classList.add("fa-xmark");

            } else {
                menuIcon.classList.remove("fa-xmark");
                menuIcon.classList.add("fa-bars");
            }

        }

    });

}

// CLOSE MOBILE MENU AFTER CLICKING A LINK

const mobileLinks = document.querySelectorAll("#mobileMenu a");

mobileLinks.forEach((link) => {

    link.addEventListener("click", () => {

        if (mobileMenu) {
            mobileMenu.classList.add("hidden");
        }
        if (menuButton) {
            menuButton.setAttribute(
                "aria-expanded",
                "false"
            );
        }
        if (menuIcon) {

            menuIcon.classList.remove("fa-xmark");
            menuIcon.classList.add("fa-bars");

        }

    });

});

