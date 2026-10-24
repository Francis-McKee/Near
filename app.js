
import { auth, db } from "./firebase.js";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    updateProfile
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

const authSection = document.querySelector("#auth-section");
const appSection = document.querySelector("#app-section");
const authForm = document.querySelector("#auth-form");

const loginTab = document.querySelector("#login-tab");
const signupTab = document.querySelector("#signup-tab");
const displayNameGroup = document.querySelector("#display-name-group");
const displayNameInput = document.querySelector("#display-name");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");

const submitButton = document.querySelector("#submit-button");
const forgotPasswordButton = document.querySelector("#forgot-password");
const logoutButton = document.querySelector("#logout-button");

const authMessage = document.querySelector("#auth-message");
const appMessage = document.querySelector("#app-message");
const welcomeHeading = document.querySelector("#welcome-heading");
const profileEmail = document.querySelector("#profile-email");

let currentMode = "login";
let authResolved = false;
let isSubmitting = false;

function setMessage(element, message, type = "") {
    element.textContent = message;
    element.classList.remove("error", "success");

    if (type) {
        element.classList.add(type);
    }
}

function clearMessages() {
    setMessage(authMessage, "");
    setMessage(appMessage, "");
}

function setFormDisabled(disabled) {
    for (const element of authForm.elements) {
        element.disabled = disabled;
    }

    loginTab.disabled = disabled;
    signupTab.disabled = disabled;
    forgotPasswordButton.disabled = disabled;
}

function updateFormMode(mode) {
    currentMode = mode;

    const isSignup = mode === "signup";

    loginTab.classList.toggle("active", !isSignup);
    signupTab.classList.toggle("active", isSignup);

    loginTab.setAttribute("aria-pressed", String(!isSignup));
    signupTab.setAttribute("aria-pressed", String(isSignup));

    displayNameGroup.classList.toggle("hidden", !isSignup);
    displayNameInput.required = isSignup;

    passwordInput.autocomplete = isSignup ? "new-password" : "current-password";

    submitButton.textContent = isSignup ? "Create account" : "Log in";
    forgotPasswordButton.classList.toggle("hidden", isSignup);

    setMessage(authMessage, "");
}

function getFirebaseErrorMessage(error) {
    switch (error.code) {
        case "auth/email-already-in-use":
            return "An account already exists with this email address. Try logging in instead.";

        case "auth/invalid-email":
            return "Enter a valid email address.";

        case "auth/weak-password":
            return "Choose a stronger password with at least 6 characters.";

        case "auth/invalid-credential":
        case "auth/invalid-login-credentials":
        case "auth/wrong-password":
        case "auth/user-not-found":
            return "The email or password is incorrect.";

        case "auth/too-many-requests":
            return "Too many attempts. Please wait a while before trying again.";

        case "auth/network-request-failed":
            return "A network error occurred. Check your internet connection and try again.";

        case "auth/operation-not-allowed":
            return "Email/password sign-in is not enabled in your Firebase project.";

        case "permission-denied":
        case "firestore/permission-denied":
            return "Your request was blocked by the database security rules. Check that the published rules match the app.";

        default:
            return "Something went wrong. Please try again.";
    }
}

async function createUserProfile(user, displayName) {
    const userRef = doc(db, "users", user.uid);
    const existingProfile = await getDoc(userRef);

    if (existingProfile.exists()) {
        return;
    }

    await setDoc(userRef, {
        uid: user.uid,
        displayName,
        email: user.email,
        createdAt: serverTimestamp()
    });
}

async function handleSignup() {
    const displayName = displayNameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!displayName) {
        setMessage(authMessage, "Enter a display name.", "error");
        displayNameInput.focus();
        return;
    }

    if (displayName.length > 60) {
        setMessage(authMessage, "Your display name must be 60 characters or fewer.", "error");
        displayNameInput.focus();
        return;
    }

    const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
    );

    await updateProfile(credential.user, {
        displayName
    });

    await createUserProfile(credential.user, displayName);
}

async function handleLogin() {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    await signInWithEmailAndPassword(auth, email, password);
}

authForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!authResolved || isSubmitting) {
        return;
    }

    isSubmitting = true;
    setFormDisabled(true);
    submitButton.textContent = currentMode === "signup"
        ? "Creating account..."
        : "Logging in...";

    setMessage(authMessage, "");

    try {
        if (currentMode === "signup") {
            await handleSignup();
        } else {
            await handleLogin();
        }
    } catch (error) {
        console.error("Authentication error:", error);
        setMessage(authMessage, getFirebaseErrorMessage(error), "error");
    } finally {
        isSubmitting = false;

        if (authResolved && !auth.currentUser) {
            setFormDisabled(false);
            submitButton.textContent = currentMode === "signup"
                ? "Create account"
                : "Log in";
        }
    }
});

loginTab.addEventListener("click", () => {
    if (isSubmitting) {
        return;
    }

    updateFormMode("login");
});

signupTab.addEventListener("click", () => {
    if (isSubmitting) {
        return;
    }

    updateFormMode("signup");
});

forgotPasswordButton.addEventListener("click", async () => {
    if (isSubmitting) {
        return;
    }

    const email = emailInput.value.trim();

    if (!email) {
        setMessage(authMessage, "Enter your email address first.", "error");
        emailInput.focus();
        return;
    }

    forgotPasswordButton.disabled = true;
    setMessage(authMessage, "Sending password reset email...");

    try {
        await sendPasswordResetEmail(auth, email);

        setMessage(
            authMessage,
            "If an account exists for that address, a password reset email will be sent.",
            "success"
        );
    } catch (error) {
        console.error("Password reset error:", error);
        setMessage(authMessage, getFirebaseErrorMessage(error), "error");
    } finally {
        forgotPasswordButton.disabled = false;
    }
});

logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    setMessage(appMessage, "");

    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout error:", error);
        setMessage(appMessage, getFirebaseErrorMessage(error), "error");
    } finally {
        logoutButton.disabled = false;
    }
});

onAuthStateChanged(auth, async (user) => {
    authResolved = true;

    if (!user) {
        authSection.classList.remove("hidden");
        appSection.classList.add("hidden");
        setFormDisabled(false);
        return;
    }

    setFormDisabled(true);
    submitButton.textContent = "Loading account...";

    authSection.classList.add("hidden");
    appSection.classList.remove("hidden");
    setMessage(appMessage, "Loading your profile...");

    try {
        const userRef = doc(db, "users", user.uid);
        const profileSnapshot = await getDoc(userRef);

        if (!profileSnapshot.exists()) {
            const displayName = user.displayName?.trim();

            if (!displayName || !user.email) {
                throw new Error("The account is missing profile information.");
            }

            await createUserProfile(user, displayName);
        }

        const profile = (await getDoc(userRef)).data();

        welcomeHeading.textContent = `Welcome, ${profile.displayName}`;
        profileEmail.textContent = profile.email || user.email || "";

        setMessage(appMessage, "");
    } catch (error) {
        console.error("Profile loading error:", error);

        setMessage(
            appMessage,
            "We couldn't load your profile. Check your connection and Firestore security rules, then reload the page.",
            "error"
        );
    }
});

updateFormMode("login");
setFormDisabled(true);
