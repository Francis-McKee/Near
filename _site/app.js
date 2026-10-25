
import { auth, db } from "./firebase.js";
import { loadFeed } from "./feed.js";
import { setupPostForm } from "./posts.js";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    sendPasswordResetEmail,
    updateProfile
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";

import {
    doc,
    getDoc,
    getDocs,
    setDoc,
    query,
    serverTimestamp,
    where
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
const authMessage = document.querySelector("#auth-message");
const feedWelcome = document.querySelector("#feed-welcome");
const submitPostButton = document.querySelector("#submit-post-button");
const feedPosts = document.querySelector("#feed-posts");
const feedStatus = document.querySelector("#feed-status");
const caughtUpMessage = document.querySelector("#caught-up-message");

let currentMode = "login";
let authResolved = false;
let isSubmitting = false;
let currentUser = null;
let currentProfile = null;

function setMessage(element, message, type = "") {
    if (!element) return;

    element.textContent = message;
    element.classList.remove("error", "success");

    if (type) element.classList.add(type);
}

function setFormDisabled(disabled) {
    if (!authForm) return;

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

    passwordInput.autocomplete = isSignup
        ? "new-password"
        : "current-password";

    submitButton.textContent = isSignup ? "Create account" : "Log in";

    forgotPasswordButton.classList.toggle("hidden", isSignup);

    setMessage(authMessage, "");
}

function getFirebaseErrorMessage(error) {
    const messages = {
        "auth/email-already-in-use":
            "An account already exists with this email address. Try logging in instead.",
        "auth/invalid-email":
            "Enter a valid email address.",
        "auth/weak-password":
            "Choose a stronger password with at least 6 characters.",
        "auth/invalid-credential":
            "The email or password is incorrect.",
        "auth/invalid-login-credentials":
            "The email or password is incorrect.",
        "auth/wrong-password":
            "The email or password is incorrect.",
        "auth/user-not-found":
            "The email or password is incorrect.",
        "auth/too-many-requests":
            "Too many attempts. Please wait a while before trying again.",
        "auth/network-request-failed":
            "A network error occurred. Check your internet connection and try again.",
        "auth/operation-not-allowed":
            "Email/password sign-in is not enabled in your Firebase project.",
        "permission-denied":
            "The database blocked this request. Check that the latest Firestore rules are published.",
        "firestore/permission-denied":
            "The database blocked this request. Check that the latest Firestore rules are published."
    };

    return messages[error.code]
        || error.message
        || "Something went wrong. Please try again.";
}

function getSafeNextPage() {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");

    if (!next) return null;

    if (
        next === "friends.html"
        || next.startsWith("friends.html?invite=")
    ) {
        return next;
    }

    if (next === "profile.html") return next;

    return null;
}

async function createUserProfile(user, displayName) {
    const userRef = doc(db, "users", user.uid);
    const existingProfile = await getDoc(userRef);

    if (existingProfile.exists()) return;

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
        setMessage(
            authMessage,
            "Your display name must be 60 characters or fewer.",
            "error"
        );
        displayNameInput.focus();
        return;
    }

    const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
    );

    await updateProfile(credential.user, { displayName });

    await createUserProfile(credential.user, displayName);
}

async function handleLogin() {
    await signInWithEmailAndPassword(
        auth,
        emailInput.value.trim(),
        passwordInput.value
    );
}

if (authForm) {
    authForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!authResolved || isSubmitting) return;

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

            setMessage(
                authMessage,
                getFirebaseErrorMessage(error),
                "error"
            );
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
        if (!isSubmitting) updateFormMode("login");
    });

    signupTab.addEventListener("click", () => {
        if (!isSubmitting) updateFormMode("signup");
    });

    forgotPasswordButton.addEventListener("click", async () => {
        if (isSubmitting) return;

        const email = emailInput.value.trim();

        if (!email) {
            setMessage(
                authMessage,
                "Enter your email address first.",
                "error"
            );
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

            setMessage(
                authMessage,
                getFirebaseErrorMessage(error),
                "error"
            );
        } finally {
            forgotPasswordButton.disabled = false;
        }
    });
}

setupPostForm({
    getCurrentUser: () => currentUser,
    getCurrentProfile: () => currentProfile,
    loadFeed,
    feedElements: {
        feedPosts,
        feedStatus,
        caughtUpMessage
    }
});

onAuthStateChanged(auth, async (user) => {
    authResolved = true;

    if (!authSection || !appSection) return;

    if (!user) {
        currentUser = null;
        currentProfile = null;

        authSection.classList.remove("hidden");
        appSection.classList.add("hidden");

        setFormDisabled(false);

        return;
    }

    const nextPage = getSafeNextPage();

    if (nextPage) {
        window.location.replace(nextPage);
        return;
    }

    currentUser = user;

    authSection.classList.add("hidden");
    appSection.classList.remove("hidden");

    setFormDisabled(true);
    submitPostButton.disabled = true;

    try {
        let profileSnapshot = await getDoc(
            doc(db, "users", user.uid)
        );

        if (!profileSnapshot.exists()) {
            const displayName = user.displayName?.trim();

            if (!displayName || !user.email) {
                throw new Error(
                    "The account is missing profile information."
                );
            }

            await createUserProfile(user, displayName);

            profileSnapshot = await getDoc(
                doc(db, "users", user.uid)
            );
        }

        currentProfile = profileSnapshot.data();

        if (feedWelcome) {
            feedWelcome.textContent =
                `Welcome, ${currentProfile.displayName}. Your feed includes updates from you and your accepted friends.`;
        }

        submitPostButton.disabled = false;

        await loadFeed(currentUser, {
            feedPosts,
            feedStatus,
            caughtUpMessage
        });
    } catch (error) {
        console.error("Account loading error:", error);

        if (feedWelcome) {
            feedWelcome.textContent =
                "We couldn't load your account. Please reload the page.";
        }

        setMessage(
            feedStatus,
            getFirebaseErrorMessage(error),
            "error"
        );
    }
});

if (authForm) {
    updateFormMode("login");
    setFormDisabled(true);
}