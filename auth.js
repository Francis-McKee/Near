
import { auth } from "./firebase.js";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    updateProfile
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";

function setMessage(element, message, type = "") {
    if (!element) return;

    element.textContent = message;
    element.classList.remove("error", "success");

    if (type) element.classList.add(type);
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

export function setupAuthForm({
    onSignupStarted,
    onSignupComplete,
    onSignupFinished,
    onAuthResolved
} = {}) {
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

    let currentMode = "login";
    let isSubmitting = false;

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

        submitButton.textContent = isSignup
            ? "Create account"
            : "Log in";

        forgotPasswordButton.classList.toggle("hidden", isSignup);

        setMessage(authMessage, "");
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

        onSignupStarted?.();

        try {
            const credential = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

            await updateProfile(credential.user, { displayName });

            await onSignupComplete?.(credential.user, displayName);
        } finally {
            onSignupFinished?.();
        }
    }

    async function handleLogin() {
        await signInWithEmailAndPassword(
            auth,
            emailInput.value.trim(),
            passwordInput.value
        );
    }

    if (!authForm) {
        return { setFormDisabled };
    }

    authForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (isSubmitting) return;

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

            if (!auth.currentUser) {
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

    updateFormMode("login");
    setFormDisabled(true);

    onAuthResolved?.(setFormDisabled);

    return { setFormDisabled };
}