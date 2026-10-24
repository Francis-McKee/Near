
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
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    setDoc,
    runTransaction,
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

const friendsList = document.querySelector("#friends-list");
const friendsEmpty = document.querySelector("#friends-empty");
const createInvitationButton = document.querySelector("#create-invitation-button");
const invitationLinkArea = document.querySelector("#invitation-link-area");
const invitationLinkInput = document.querySelector("#invitation-link");
const copyInvitationButton = document.querySelector("#copy-invitation-button");

const incomingInvitation = document.querySelector("#incoming-invitation");
const incomingInvitationText = document.querySelector("#incoming-invitation-text");
const acceptInvitationButton = document.querySelector("#accept-invitation-button");
const declineInvitationButton = document.querySelector("#decline-invitation-button");

let currentMode = "login";
let authResolved = false;
let isSubmitting = false;
let currentUser = null;
let currentProfile = null;
let invitationActionInProgress = false;

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
    if (error.code === "auth/email-already-in-use") {
        return "An account already exists with this email address. Try logging in instead.";
    }

    if (error.code === "auth/invalid-email") {
        return "Enter a valid email address.";
    }

    if (error.code === "auth/weak-password") {
        return "Choose a stronger password with at least 6 characters.";
    }

    if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/invalid-login-credentials" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/user-not-found"
    ) {
        return "The email or password is incorrect.";
    }

    if (error.code === "auth/too-many-requests") {
        return "Too many attempts. Please wait a while before trying again.";
    }

    if (error.code === "auth/network-request-failed") {
        return "A network error occurred. Check your internet connection and try again.";
    }

    if (error.code === "auth/operation-not-allowed") {
        return "Email/password sign-in is not enabled in your Firebase project.";
    }

    if (
        error.code === "permission-denied" ||
        error.code === "firestore/permission-denied"
    ) {
        return "The database blocked this request. Check that the latest Firestore rules are published.";
    }

    return error.message || "Something went wrong. Please try again.";
}

function getInvitationIdFromUrl() {
    return new URL(window.location.href).searchParams.get("invite");
}

function clearInvitationFromUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete("invite");
    window.history.replaceState({}, "", url);
}

function getFriendshipId(uidA, uidB) {
    const [firstUid, secondUid] = [uidA, uidB].sort();
    return `${firstUid}_${secondUid}`;
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

    const credential = await createUserWithEmailAndPassword(auth, email, password);

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
    if (!isSubmitting) {
        updateFormMode("login");
    }
});

signupTab.addEventListener("click", () => {
    if (!isSubmitting) {
        updateFormMode("signup");
    }
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

    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout error:", error);
        setMessage(appMessage, getFirebaseErrorMessage(error), "error");
    } finally {
        logoutButton.disabled = false;
    }
});

// Create a one-time invitation link.
createInvitationButton.addEventListener("click", async () => {
    if (!currentUser || !currentProfile) {
        return;
    }

    createInvitationButton.disabled = true;
    setMessage(appMessage, "Creating your invitation...");

    try {
        const invitationRef = doc(collection(db, "friendInvitations"));

        await setDoc(invitationRef, {
            senderId: currentUser.uid,
            senderName: currentProfile.displayName,
            status: "pending",
            createdAt: serverTimestamp()
        });

        const url = new URL(window.location.href);
        url.search = "";
        url.searchParams.set("invite", invitationRef.id);

        invitationLinkInput.value = url.toString();
        invitationLinkArea.classList.remove("hidden");

        setMessage(
            appMessage,
            "Your invitation link is ready to share.",
            "success"
        );
    } catch (error) {
        console.error("Invitation creation error:", error);
        setMessage(appMessage, getFirebaseErrorMessage(error), "error");
    } finally {
        createInvitationButton.disabled = false;
    }
});

copyInvitationButton.addEventListener("click", async () => {
    if (!invitationLinkInput.value) {
        return;
    }

    try {
        await navigator.clipboard.writeText(invitationLinkInput.value);
        setMessage(appMessage, "Invitation link copied.", "success");
    } catch (error) {
        invitationLinkInput.focus();
        invitationLinkInput.select();

        setMessage(
            appMessage,
            "Automatic copying failed. Select and copy the link above.",
            "error"
        );
    }
});

async function loadFriends() {
    if (!currentUser) {
        return;
    }

    friendsList.replaceChildren();
    friendsEmpty.textContent = "Loading friends...";

    try {
        const friendshipsQuery = query(
            collection(db, "friendships"),
            where("userIds", "array-contains", currentUser.uid)
        );

        const snapshot = await getDocs(friendshipsQuery);

        const friendIds = snapshot.docs
            .map((friendshipDoc) => friendshipDoc.data().userIds)
            .map((userIds) => userIds.find((uid) => uid !== currentUser.uid))
            .filter(Boolean);

        if (friendIds.length === 0) {
            friendsEmpty.textContent = "Your accepted connections will appear here.";
            return;
        }

        const profiles = await Promise.all(
            friendIds.map(async (uid) => {
                const profileSnapshot = await getDoc(doc(db, "users", uid));

                if (!profileSnapshot.exists()) {
                    return { uid, displayName: "Friend" };
                }

                return { uid, ...profileSnapshot.data() };
            })
        );

        profiles.sort((a, b) =>
            (a.displayName || "").localeCompare(b.displayName || "")
        );

        for (const profile of profiles) {
            const item = document.createElement("li");
            item.className = "friend-item";
            item.textContent = profile.displayName || "Friend";
            friendsList.append(item);
        }

        friendsEmpty.textContent = "";
    } catch (error) {
        console.error("Friend list loading error:", error);
        friendsEmpty.textContent = "We couldn't load your friends. Please reload the page.";
    }
}

async function loadIncomingInvitation() {
    const invitationId = getInvitationIdFromUrl();

    if (!invitationId || !currentUser) {
        incomingInvitation.classList.add("hidden");
        return;
    }

    incomingInvitation.classList.remove("hidden");
    acceptInvitationButton.disabled = true;
    declineInvitationButton.disabled = true;
    setMessage(appMessage, "Loading invitation...");

    try {
        const invitationRef = doc(db, "friendInvitations", invitationId);
        const invitationSnapshot = await getDoc(invitationRef);

        if (!invitationSnapshot.exists()) {
            throw new Error("This invitation doesn't exist or is no longer available.");
        }

        const invitation = invitationSnapshot.data();

        incomingInvitationText.textContent =
            `${invitation.senderName} invited you to connect on Near.`;

        if (invitation.senderId === currentUser.uid) {
            incomingInvitationText.textContent =
                "This is your own invitation link. Send it to a friend instead.";
            acceptInvitationButton.classList.add("hidden");
            declineInvitationButton.classList.add("hidden");
        } else if (invitation.status !== "pending") {
            incomingInvitationText.textContent =
                invitation.usedBy === currentUser.uid
                    ? `You have already ${invitation.status} this invitation.`
                    : "This invitation has already been used.";

            acceptInvitationButton.classList.add("hidden");
            declineInvitationButton.classList.add("hidden");
        } else {
            acceptInvitationButton.classList.remove("hidden");
            declineInvitationButton.classList.remove("hidden");
            acceptInvitationButton.disabled = false;
            declineInvitationButton.disabled = false;
        }

        setMessage(appMessage, "");
    } catch (error) {
        console.error("Invitation loading error:", error);
        incomingInvitationText.textContent =
            "We couldn't load this invitation. It may be invalid or already used.";
        acceptInvitationButton.classList.add("hidden");
        declineInvitationButton.classList.add("hidden");
        setMessage(appMessage, getFirebaseErrorMessage(error), "error");
    }
}

async function respondToInvitation(response) {
    if (!currentUser || invitationActionInProgress) {
        return;
    }

    const invitationId = getInvitationIdFromUrl();

    if (!invitationId) {
        setMessage(appMessage, "This invitation link is missing its code.", "error");
        return;
    }

    invitationActionInProgress = true;
    acceptInvitationButton.disabled = true;
    declineInvitationButton.disabled = true;
    setMessage(appMessage, "Processing invitation...");

    try {
        const invitationRef = doc(db, "friendInvitations", invitationId);

        await runTransaction(db, async (transaction) => {
            const invitationSnapshot = await transaction.get(invitationRef);

            if (!invitationSnapshot.exists()) {
                throw new Error("This invitation doesn't exist.");
            }

            const invitation = invitationSnapshot.data();

            if (invitation.status !== "pending") {
                throw new Error("This invitation has already been used.");
            }

            if (invitation.senderId === currentUser.uid) {
                throw new Error("You cannot accept your own invitation.");
            }

            if (response === "accepted") {
                const friendshipId = getFriendshipId(
                    invitation.senderId,
                    currentUser.uid
                );
                const friendshipRef = doc(db, "friendships", friendshipId);
                const friendshipSnapshot = await transaction.get(friendshipRef);

                if (friendshipSnapshot.exists()) {
                    throw new Error("You are already friends with this person.");
                }

                const userIds = [
                    invitation.senderId,
                    currentUser.uid
                ].sort();

                transaction.update(invitationRef, {
                    status: "accepted",
                    usedBy: currentUser.uid,
                    usedAt: serverTimestamp()
                });

                transaction.set(friendshipRef, {
                    userIds,
                    invitationId,
                    createdAt: serverTimestamp()
                });
            } else {
                transaction.update(invitationRef, {
                    status: "declined",
                    usedBy: currentUser.uid,
                    usedAt: serverTimestamp()
                });
            }
        });

        clearInvitationFromUrl();
        incomingInvitation.classList.add("hidden");

        if (response === "accepted") {
            setMessage(appMessage, "You're now friends.", "success");
            await loadFriends();
        } else {
            setMessage(appMessage, "Invitation declined.", "success");
        }
    } catch (error) {
        console.error("Invitation response error:", error);
        
        const message = getFirebaseErrorMessage(error);
        await loadIncomingInvitation();
        setMessage(appMessage, message, "error");
    } finally {
        invitationActionInProgress = false;
        acceptInvitationButton.disabled = false;
        declineInvitationButton.disabled = false;
    }
}

acceptInvitationButton.addEventListener("click", () => {
    respondToInvitation("accepted");
});

declineInvitationButton.addEventListener("click", () => {
    respondToInvitation("declined");
});

onAuthStateChanged(auth, async (user) => {
    authResolved = true;
    currentUser = user;
    currentProfile = null;

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
        let profileSnapshot = await getDoc(userRef);

        if (!profileSnapshot.exists()) {
            const displayName = user.displayName?.trim();

            if (!displayName || !user.email) {
                throw new Error("The account is missing profile information.");
            }

            await createUserProfile(user, displayName);
            profileSnapshot = await getDoc(userRef);
        }

        currentProfile = profileSnapshot.data();

        welcomeHeading.textContent =
            `Welcome, ${currentProfile.displayName}`;
        profileEmail.textContent = currentProfile.email || user.email || "";

        await Promise.all([
            loadFriends(),
            loadIncomingInvitation()
        ]);

        if (!getInvitationIdFromUrl()) {
            setMessage(appMessage, "");
        }
    } catch (error) {
        console.error("Account loading error:", error);
        setMessage(
            appMessage,
            "We couldn't load your account. Check your connection and Firestore security rules, then reload.",
            "error"
        );
    }
});

updateFormMode("login");
setFormDisabled(true);