import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

const page = document.querySelector("#profile-page");
const displayNameElement = document.querySelector("#profile-display-name");
const messageElement = document.querySelector("#profile-message");

function setMessage(message, type = "") {
    messageElement.textContent = message;
    messageElement.classList.remove("error", "success");

    if (type) {
        messageElement.classList.add(type);
    }
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace(
            `index.html?next=${encodeURIComponent("profile.html")}`
        );
        return;
    }

    try {
        const profileSnapshot = await getDoc(doc(db, "users", user.uid));
        const profile = profileSnapshot.exists()
            ? profileSnapshot.data()
            : {};

        displayNameElement.textContent =
            profile.displayName || user.displayName || "Not set";

        page.classList.remove("hidden");
    } catch (error) {
        console.error("Profile page loading error:", error);

        displayNameElement.textContent = user.displayName || "Not available";
        page.classList.remove("hidden");

        setMessage(
            "We couldn't load your profile. Please reload the page.",
            "error"
        );
    }
});