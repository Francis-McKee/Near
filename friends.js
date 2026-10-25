import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import {
    collection, doc, getDoc, getDocs, query, where, setDoc, deleteDoc,
    runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

const page = document.querySelector("#friends-page");
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
const appMessage = document.querySelector("#app-message");
let currentUser = null;
let currentProfile = null;
let invitationActionInProgress = false;

function setMessage(message, type = "") {
    appMessage.textContent = message;
    appMessage.classList.remove("error", "success");
    if (type) appMessage.classList.add(type);
}

function getFirebaseErrorMessage(error) {
    if (error.code === "permission-denied" || error.code === "firestore/permission-denied") {
        return "The database blocked this request. Check that the current Firestore rules are published.";
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

async function loadFriends() {
    friendsList.replaceChildren();
    friendsEmpty.textContent = "Loading friends...";
    try {
        const friendshipsQuery = query(collection(db, "friendships"), where("userIds", "array-contains", currentUser.uid));
        const snapshot = await getDocs(friendshipsQuery);
        const friendIds = snapshot.docs
            .map((friendshipDoc) => friendshipDoc.data().userIds)
            .map((userIds) => userIds.find((uid) => uid !== currentUser.uid))
            .filter(Boolean);
        if (friendIds.length === 0) {
            friendsEmpty.textContent = "Your accepted connections will appear here.";
            return;
        }
        const profiles = await Promise.all(friendIds.map(async (uid) => {
            const profileSnapshot = await getDoc(doc(db, "users", uid));
            return profileSnapshot.exists() ? { uid, ...profileSnapshot.data() } : { uid, displayName: "Friend" };
        }));
        profiles.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
        for (const profile of profiles) {
            const item = document.createElement("li");
            item.className = "friend-item";

            const name = document.createElement("span");
            name.className = "friend-name";
            name.textContent = profile.displayName || "Friend";

            const removeButton = document.createElement("button");
            removeButton.className = "button button-secondary remove-friend-button";
            removeButton.type = "button";
            removeButton.textContent = "Remove";
            removeButton.setAttribute(
                "aria-label",
                `Remove ${profile.displayName || "friend"}`
            );

            removeButton.addEventListener("click", async () => {
                const confirmed = window.confirm(
                    `Remove ${profile.displayName || "this friend"} from your friends? ` +
                    "They will no longer be able to see your posts, and you will no longer see theirs."
                );

                if (!confirmed) {
                    return;
                }

                removeButton.disabled = true;
                setMessage(`Removing ${profile.displayName || "friend"}...`);

                try {
                    const friendshipId = getFriendshipId(
                        currentUser.uid,
                        profile.uid
                    );

                    await deleteDoc(doc(db, "friendships", friendshipId));

                    setMessage(
                        `${profile.displayName || "Friend"} was removed.`,
                        "success"
                    );

                    await loadFriends();
                } catch (error) {
                    console.error("Friend removal error:", error);
                    setMessage(getFirebaseErrorMessage(error), "error");
                    removeButton.disabled = false;
                }
            });

            item.append(name, removeButton);
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
    if (!invitationId) {
        incomingInvitation.classList.add("hidden");
        return;
    }
    incomingInvitation.classList.remove("hidden");
    acceptInvitationButton.classList.remove("hidden");
    declineInvitationButton.classList.remove("hidden");
    acceptInvitationButton.disabled = true;
    declineInvitationButton.disabled = true;
    setMessage("Loading invitation...");
    try {
        const invitationSnapshot = await getDoc(doc(db, "friendInvitations", invitationId));
        if (!invitationSnapshot.exists()) throw new Error("This invitation doesn't exist or is no longer available.");
        const invitation = invitationSnapshot.data();
        incomingInvitationText.textContent = `${invitation.senderName} invited you to connect on Near.`;
        if (invitation.senderId === currentUser.uid) {
            incomingInvitationText.textContent = "This is your own invitation link. Send it to a friend instead.";
            acceptInvitationButton.classList.add("hidden");
            declineInvitationButton.classList.add("hidden");
        } else if (invitation.status !== "pending") {
            incomingInvitationText.textContent = invitation.usedBy === currentUser.uid
                ? `You have already ${invitation.status} this invitation.`
                : "This invitation has already been used.";
            acceptInvitationButton.classList.add("hidden");
            declineInvitationButton.classList.add("hidden");
        } else {
            acceptInvitationButton.disabled = false;
            declineInvitationButton.disabled = false;
        }
        setMessage("");
    } catch (error) {
        console.error("Invitation loading error:", error);
        incomingInvitationText.textContent = "We couldn't load this invitation. It may be invalid or already used.";
        acceptInvitationButton.classList.add("hidden");
        declineInvitationButton.classList.add("hidden");
        setMessage(getFirebaseErrorMessage(error), "error");
    }
}

createInvitationButton.addEventListener("click", async () => {
    if (!currentUser || !currentProfile) return;
    createInvitationButton.disabled = true;
    setMessage("Creating your invitation...");
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
        setMessage("Your invitation link is ready to share.", "success");
    } catch (error) {
        console.error("Invitation creation error:", error);
        setMessage(getFirebaseErrorMessage(error), "error");
    } finally {
        createInvitationButton.disabled = false;
    }
});

copyInvitationButton.addEventListener("click", async () => {
    if (!invitationLinkInput.value) return;
    try {
        await navigator.clipboard.writeText(invitationLinkInput.value);
        setMessage("Invitation link copied.", "success");
    } catch {
        invitationLinkInput.focus();
        invitationLinkInput.select();
        setMessage("Automatic copying failed. Select and copy the link above.", "error");
    }
});


async function respondToInvitation(response) {
    if (!currentUser || invitationActionInProgress) return;

    const invitationId = getInvitationIdFromUrl();

    if (!invitationId) {
        setMessage("This invitation link is missing its code.", "error");
        return;
    }

    invitationActionInProgress = true;
    acceptInvitationButton.disabled = true;
    declineInvitationButton.disabled = true;
    setMessage("Processing invitation...");

    try {
        const invitationRef = doc(db, "friendInvitations", invitationId);

        let invitationSnapshot = await getDoc(invitationRef);

        if (!invitationSnapshot.exists()) {
            throw new Error("This invitation doesn't exist.");
        }

        let invitation = invitationSnapshot.data();

        if (invitation.senderId === currentUser.uid) {
            throw new Error("You cannot respond to your own invitation.");
        }

        if (invitation.status !== "pending") {
            throw new Error("This invitation has already been used.");
        }

        if (invitation.usedBy && invitation.usedBy !== currentUser.uid) {
            throw new Error("This invitation has already been claimed by another account.");
        }

        if (!invitation.usedBy) {
            await runTransaction(db, async (transaction) => {
                const snapshot = await transaction.get(invitationRef);

                if (!snapshot.exists()) {
                    throw new Error("This invitation doesn't exist.");
                }

                const latest = snapshot.data();

                if (
                    latest.status !== "pending" ||
                    latest.senderId === currentUser.uid ||
                    latest.usedBy
                ) {
                    throw new Error("This invitation is no longer available.");
                }

                transaction.update(invitationRef, {
                    usedBy: currentUser.uid,
                    usedAt: serverTimestamp()
                });
            });
        }

        if (response === "declined") {
            await runTransaction(db, async (transaction) => {
                const snapshot = await transaction.get(invitationRef);

                if (!snapshot.exists()) {
                    throw new Error("This invitation doesn't exist.");
                }

                const latest = snapshot.data();

                if (
                    latest.status !== "pending" ||
                    latest.usedBy !== currentUser.uid
                ) {
                    throw new Error("This invitation is no longer available.");
                }

                transaction.update(invitationRef, {
                    status: "declined"
                });
            });

            clearInvitationFromUrl();
            incomingInvitation.classList.add("hidden");
            setMessage("Invitation declined.", "success");
            return;
        }

        await runTransaction(db, async (transaction) => {
            const snapshot = await transaction.get(invitationRef);

            if (!snapshot.exists()) {
                throw new Error("This invitation doesn't exist.");
            }

            const latest = snapshot.data();

            if (
                latest.status !== "pending" ||
                latest.usedBy !== currentUser.uid
            ) {
                throw new Error("This invitation is no longer available.");
            }

            transaction.update(invitationRef, {
                status: "accepted"
            });
        });

        invitationSnapshot = await getDoc(invitationRef);

        if (!invitationSnapshot.exists()) {
            throw new Error("The accepted invitation could not be verified.");
        }

        invitation = invitationSnapshot.data();

        if (
            invitation.status !== "accepted" ||
            invitation.usedBy !== currentUser.uid
        ) {
            throw new Error("The invitation could not be verified as accepted.");
        }

        const friendshipId = getFriendshipId(
            invitation.senderId,
            currentUser.uid
        );

        const friendshipRef = doc(db, "friendships", friendshipId);

        await setDoc(friendshipRef, {
            userIds: [
                invitation.senderId,
                currentUser.uid
            ].sort(),
            invitationId,
            createdAt: serverTimestamp()
        });

        clearInvitationFromUrl();
        incomingInvitation.classList.add("hidden");
        setMessage("You're now friends.", "success");
        await loadFriends();
    } catch (error) {
        console.error("Invitation response error:", error);
        await loadIncomingInvitation();
        setMessage(getFirebaseErrorMessage(error), "error");
    } finally {
        invitationActionInProgress = false;
        acceptInvitationButton.disabled = false;
        declineInvitationButton.disabled = false;
    }
}

acceptInvitationButton.addEventListener("click", () => respondToInvitation("accepted"));
declineInvitationButton.addEventListener("click", () => respondToInvitation("declined"));

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        const target = `friends.html${window.location.search}`;
        window.location.replace(`index.html?next=${encodeURIComponent(target)}`);
        return;
    }
    currentUser = user;
    try {
        const profileSnapshot = await getDoc(doc(db, "users", user.uid));
        currentProfile = profileSnapshot.exists() ? profileSnapshot.data() : { displayName: user.displayName || "Friend" };
        page.classList.remove("hidden");
        await Promise.all([loadFriends(), loadIncomingInvitation()]);
    } catch (error) {
        console.error("Friends page initialization error:", error);
        page.classList.remove("hidden");
        setMessage(getFirebaseErrorMessage(error), "error");
    }
});
