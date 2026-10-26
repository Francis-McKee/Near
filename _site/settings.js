
import { auth, db } from "./firebase.js";
import {
    deleteUser,
    EmailAuthProvider,
    onAuthStateChanged,
    reauthenticateWithCredential,
    sendPasswordResetEmail,
    signOut
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

const page = document.querySelector("#settings-page");
const displayNameElement = document.querySelector("#settings-display-name");
const emailElement = document.querySelector("#settings-email");
const resetPasswordButton = document.querySelector("#reset-password-button");
const resetMessage = document.querySelector("#reset-message");
const logoutButton = document.querySelector("#logout-button");
const messageElement = document.querySelector("#settings-message");

let currentUser = null;
let deletionInProgress = false;

function setMessage(message, type = "") {
    messageElement.textContent = message;
    messageElement.classList.remove("error", "success");
    if (type) messageElement.classList.add(type);
}

function createAccountDeletionSection() {
    const section = document.createElement("section");
    section.className = "friend-section";
    section.setAttribute("aria-labelledby", "delete-account-heading");

    const heading = document.createElement("h2");
    heading.id = "delete-account-heading";
    heading.textContent = "Delete account";

    const warning = document.createElement("p");
    warning.className = "intro-text";
    warning.textContent =
        "Permanently delete your Near account, profile, posts, friendships, and invitation records. This cannot be undone.";

    const passwordGroup = document.createElement("div");
    passwordGroup.className = "form-group";

    const passwordLabel = document.createElement("label");
    passwordLabel.htmlFor = "delete-account-password";
    passwordLabel.textContent = "Confirm your password";

    const passwordInput = document.createElement("input");
    passwordInput.id = "delete-account-password";
    passwordInput.type = "password";
    passwordInput.autocomplete = "current-password";
    passwordInput.required = true;

    const hint = document.createElement("p");
    hint.className = "field-hint";
    hint.textContent =
        "Enter your password to verify your identity before deletion.";

    const deleteButton = document.createElement("button");
    deleteButton.id = "delete-account-button";
    deleteButton.className = "button button-danger";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete account permanently";

    passwordGroup.append(passwordLabel, passwordInput, hint);
    section.append(heading, warning, passwordGroup, deleteButton);

    deleteButton.addEventListener("click", async () => {
        if (deletionInProgress) return;

        if (!currentUser?.email) {
            setMessage(
                "We couldn't verify the account email address.",
                "error"
            );
            return;
        }

        const password = passwordInput.value;

        if (!password) {
            passwordInput.focus();
            setMessage("Enter your password to continue.", "error");
            return;
        }

        const confirmed = window.confirm(
            "Permanently delete your Near account and its associated data? This cannot be undone."
        );

        if (!confirmed) return;

        deletionInProgress = true;
        deleteButton.disabled = true;
        passwordInput.disabled = true;
        resetPasswordButton.disabled = true;
        logoutButton.disabled = true;

        setMessage("Verifying your identity...");

        let cleanupStarted = false;

        try {
            // Verify the user's identity before deleting account data.
            const credential = EmailAuthProvider.credential(
                currentUser.email,
                password
            );

            await reauthenticateWithCredential(currentUser, credential);

            const uid = currentUser.uid;

            setMessage("Removing your Near data...");

            // Find the user's posts, friendships, and invitation records.
            const [
                posts,
                friendships,
                sentInvitations,
                claimedInvitations
            ] = await Promise.all([
                getDocs(
                    query(
                        collection(db, "posts"),
                        where("authorId", "==", uid)
                    )
                ),
                getDocs(
                    query(
                        collection(db, "friendships"),
                        where("userIds", "array-contains", uid)
                    )
                ),
                getDocs(
                    query(
                        collection(db, "friendInvitations"),
                        where("senderId", "==", uid)
                    )
                ),
                getDocs(
                    query(
                        collection(db, "friendInvitations"),
                        where("usedBy", "==", uid)
                    )
                )
            ]);

            // Deduplicate document references in case a document appears
            // in more than one query result.
            const documentsToDelete = new Map();

            for (const snapshot of [
                posts,
                friendships,
                sentInvitations,
                claimedInvitations
            ]) {
                for (const item of snapshot.docs) {
                    documentsToDelete.set(item.ref.path, item.ref);
                }
            }

            // Delete associated Firestore records first.
            cleanupStarted = true;

            for (const reference of documentsToDelete.values()) {
                await deleteDoc(reference);
            }

            // Delete the user's profile document.
            await deleteDoc(doc(db, "users", uid));

            // Delete the Firebase Authentication account last.
            await deleteUser(currentUser);

            // Return to the homepage after successful deletion.
            window.location.replace("index.html?accountDeleted=1");
        } catch (error) {
            console.error("Account deletion error:", error);

            let message;

            if (
                error.code === "auth/invalid-credential" ||
                error.code === "auth/wrong-password"
            ) {
                message =
                    "That password wasn't correct. Your account has not been deleted.";
            } else if (error.code === "auth/too-many-requests") {
                message =
                    "Too many attempts. Please wait a while and try again.";
            } else if (error.code === "auth/network-request-failed") {
                message =
                    "The network request failed. Check your connection and try again.";
            } else if (error.code === "auth/requires-recent-login") {
                message =
                    "For security, sign in again and retry account deletion.";
            } else if (
                error.code === "permission-denied" ||
                error.code === "firestore/permission-denied"
            ) {
                message = cleanupStarted
                    ? "Database permissions stopped deletion partway through. Some data may already have been removed, but the account may still exist. Please contact support before retrying."
                    : "Database permissions blocked account deletion. No data was deleted.";
            } else {
                message = cleanupStarted
                    ? "Account deletion stopped partway through. Some data may already have been removed. Please contact support before retrying."
                    : (
                        error.message ||
                        "We couldn't delete your account. Please try again."
                    );
            }

            setMessage(message, "error");

            deletionInProgress = false;
            deleteButton.disabled = false;
            passwordInput.disabled = false;
            resetPasswordButton.disabled = false;
            logoutButton.disabled = false;
        }
    });

    // Place the deletion section after sign-out.
    const signOutSection = page.querySelector(
        'section[aria-labelledby="signout-heading"]'
    );

    if (signOutSection) {
        signOutSection.insertAdjacentElement("afterend", section);
    } else {
        page.append(section);
    }
}

createAccountDeletionSection();

// Send a password reset email.
resetPasswordButton.addEventListener("click", async () => {
    if (!currentUser?.email) return;

    resetPasswordButton.disabled = true;
    resetMessage.textContent = "";
    resetMessage.classList.remove("error", "success");

    try {
        await sendPasswordResetEmail(auth, currentUser.email);

        resetMessage.textContent =
            "Password reset email requested. Check your inbox and spam folder.";
        resetMessage.classList.add("success");
    } catch (error) {
        console.error("Password reset error:", error);

        resetMessage.textContent =
            error.message || "We couldn't send the password reset email.";
        resetMessage.classList.add("error");
    } finally {
        resetPasswordButton.disabled = false;
    }
});

// Sign out of Near.
logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;

    try {
        await signOut(auth);
        window.location.replace("index.html");
    } catch (error) {
        console.error("Logout error:", error);

        setMessage(
            error.message || "We couldn't sign you out.",
            "error"
        );

        logoutButton.disabled = false;
    }
});

// Load the signed-in user's account details.
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace(
            `index.html?next=${encodeURIComponent("settings.html")}`
        );
        return;
    }

    currentUser = user;

    try {
        const profileSnapshot = await getDoc(
            doc(db, "users", user.uid)
        );

        const profile = profileSnapshot.exists()
            ? profileSnapshot.data()
            : {};

        displayNameElement.textContent =
            profile.displayName || user.displayName || "Not set";

        emailElement.textContent =
            profile.email || user.email || "Not available";

        page.classList.remove("hidden");
    } catch (error) {
        console.error("Settings page loading error:", error);

        displayNameElement.textContent =
            user.displayName || "Not available";

        emailElement.textContent =
            user.email || "Not available";

        page.classList.remove("hidden");

        setMessage(
            "We couldn't load all account details. Please reload the page.",
            "error"
        );
    }
});