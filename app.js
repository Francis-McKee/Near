
import { auth, db } from "./firebase.js";
import { setupAuthForm } from "./auth.js";
import { loadFeed } from "./feed.js";
import { setupPostForm } from "./posts.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

const authSection = document.querySelector("#auth-section");
const appSection = document.querySelector("#app-section");
const feedWelcome = document.querySelector("#feed-welcome");
const submitPostButton = document.querySelector("#submit-post-button");
const feedPosts = document.querySelector("#feed-posts");
const feedStatus = document.querySelector("#feed-status");
const caughtUpMessage = document.querySelector("#caught-up-message");

let authResolved = false;
let currentUser = null;
let currentProfile = null;

// Coordinates signup profile creation with the authentication listener.
let signupCompletionPromise = null;
let finishSignup = null;

function setMessage(element, message, type = "") {
    if (!element) return;

    element.textContent = message;
    element.classList.remove("error", "success");

    if (type) element.classList.add(type);
}

function getFirebaseErrorMessage(error) {
    const messages = {
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

const { setFormDisabled } = setupAuthForm({
    onSignupStarted() {
        signupCompletionPromise = new Promise((resolve) => {
            finishSignup = resolve;
        });
    },

    async onSignupComplete(user, displayName) {
        await createUserProfile(user, displayName);
    },

    onSignupFinished() {
        finishSignup?.();
        finishSignup = null;
        signupCompletionPromise = null;
    }
});

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
        // If signup is still creating the profile, wait for it to finish.
        if (signupCompletionPromise) {
            await signupCompletionPromise;
        }

        let profileSnapshot = await getDoc(
            doc(db, "users", user.uid)
        );

        // Fallback for accounts whose profile document doesn't exist yet.
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

        if (!profileSnapshot.exists()) {
            throw new Error(
                "Your account profile could not be found after creation."
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
