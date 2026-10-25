import { auth, db } from "./firebase.js";
import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

const page = document.querySelector("#view-profile-page");
const nameElement = document.querySelector("#friend-profile-name");
const postsStatus = document.querySelector("#friend-posts-status");
const postsContainer = document.querySelector("#friend-profile-posts");
const messageElement = document.querySelector("#view-profile-message");

const requestedUid = new URLSearchParams(window.location.search).get("uid");

function setMessage(message, type = "") {
    messageElement.textContent = message;
    messageElement.classList.remove("error", "success");

    if (type) {
        messageElement.classList.add(type);
    }
}

function formatDate(timestamp) {
    if (!timestamp?.toDate) return "";

    return timestamp.toDate().toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
    });
}

function renderPost(post) {
    const article = document.createElement("article");
    article.className = "feed-post";

    const header = document.createElement("div");
    header.className = "feed-post-header";

    const author = document.createElement("p");
    author.className = "feed-post-author";
    author.textContent = post.authorName || "Friend";

    const date = document.createElement("time");
    date.className = "feed-post-date";
    date.textContent = formatDate(post.createdAt);

    if (post.createdAt?.toDate) {
        date.dateTime = post.createdAt.toDate().toISOString();
    }

    const text = document.createElement("p");
    text.className = "feed-post-text";
    text.textContent = post.text || "";

    header.append(author, date);
    article.append(header, text);
    postsContainer.append(article);
}

async function loadFriendProfile(uid) {
    if (!uid) {
        setMessage("No friend profile was specified.", "error");
        nameElement.textContent = "Profile unavailable";
        postsStatus.textContent = "";
        page.classList.remove("hidden");
        return;
    }

    const profileSnapshot = await getDoc(doc(db, "users", uid));

    if (!profileSnapshot.exists()) {
        setMessage(
            "This profile is unavailable. You may no longer be friends.",
            "error"
        );
        nameElement.textContent = "Profile unavailable";
        postsStatus.textContent = "";
        page.classList.remove("hidden");
        return;
    }

    const profile = profileSnapshot.data();
    nameElement.textContent = profile.displayName || "Friend";
    page.classList.remove("hidden");

    const postsQuery = query(
        collection(db, "posts"),
        where("authorId", "==", uid)
    );

    const postsSnapshot = await getDocs(postsQuery);

    const posts = postsSnapshot.docs
        .map((postDoc) => ({
            id: postDoc.id,
            ...postDoc.data()
        }))
        .sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() ?? 0;
            const bTime = b.createdAt?.toMillis?.() ?? 0;
            return bTime - aTime;
        });

    postsContainer.replaceChildren();

    if (posts.length === 0) {
        postsStatus.textContent = "No posts to show yet.";
        return;
    }

    posts.forEach(renderPost);
    postsStatus.textContent = "";
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        const next = `view-profile.html${window.location.search}`;
        window.location.replace(`index.html?next=${encodeURIComponent(next)}`);
        return;
    }

    if (requestedUid === user.uid) {
        window.location.replace("profile.html");
        return;
    }

    try {
        await loadFriendProfile(requestedUid);
    } catch (error) {
        console.error("Friend profile loading error:", error);

        nameElement.textContent = "Profile unavailable";
        postsStatus.textContent = "";
        page.classList.remove("hidden");

        setMessage(
            "We couldn't load this profile. You may no longer be friends.",
            "error"
        );
    }
});