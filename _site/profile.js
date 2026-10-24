import { auth, db } from "./firebase.js";
import { onAuthStateChanged, sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

const page = document.querySelector("#profile-page");
const displayNameElement = document.querySelector("#profile-display-name");
const emailElement = document.querySelector("#profile-email");
const resetPasswordButton = document.querySelector("#reset-password-button");
const logoutButton = document.querySelector("#logout-button");
const messageElement = document.querySelector("#profile-message");
let currentUser = null;

function setMessage(message, type = "") {
    messageElement.textContent = message;
    messageElement.classList.remove("error", "success");
    if (type) messageElement.classList.add(type);
}

resetPasswordButton.addEventListener("click", async () => {
    if (!currentUser?.email) return;
    resetPasswordButton.disabled = true;
    setMessage("Sending password reset email...");
    try {
        await sendPasswordResetEmail(auth, currentUser.email);
        setMessage("If an account exists for that address, a password reset email will be sent.", "success");
    } catch (error) {
        console.error("Password reset error:", error);
        setMessage(error.message || "We couldn't send the password reset email.", "error");
    } finally {
        resetPasswordButton.disabled = false;
    }
});

logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    try {
        await signOut(auth);
        window.location.replace("index.html");
    } catch (error) {
        console.error("Logout error:", error);
        setMessage(error.message || "We couldn't sign you out.", "error");
        logoutButton.disabled = false;
    }
});

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace(`index.html?next=${encodeURIComponent("profile.html")}`);
        return;
    }
    currentUser = user;
    try {
        const profileSnapshot = await getDoc(doc(db, "users", user.uid));
        const profile = profileSnapshot.exists() ? profileSnapshot.data() : {};
        displayNameElement.textContent = profile.displayName || user.displayName || "Not set";
        emailElement.textContent = profile.email || user.email || "Not available";
        page.classList.remove("hidden");
    } catch (error) {
        console.error("Profile page loading error:", error);
        displayNameElement.textContent = user.displayName || "Not available";
        emailElement.textContent = user.email || "Not available";
        page.classList.remove("hidden");
        setMessage("We couldn't load all account details. Please reload the page.", "error");
    }
});
