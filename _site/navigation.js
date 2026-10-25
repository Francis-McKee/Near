
const navigationContainer = document.querySelector("[data-shared-navigation]");

async function loadNavigation() {
    if (!navigationContainer) return;

    try {
        const response = await fetch(
            new URL("./navigation.html", import.meta.url)
        );

        if (!response.ok) {
            throw new Error(`Navigation request failed: ${response.status}`);
        }

        const navigationHTML = await response.text();
        navigationContainer.innerHTML = navigationHTML.trim();

        const currentPage = navigationContainer.dataset.page;
        const links = navigationContainer.querySelectorAll("[data-nav]");

        links.forEach((link) => {
            if (link.dataset.nav === currentPage) {
                link.setAttribute("aria-current", "page");
            } else {
                link.removeAttribute("aria-current");
            }
        });
    } catch (error) {
        console.error("Navigation loading error:", error);
    }
}

loadNavigation();