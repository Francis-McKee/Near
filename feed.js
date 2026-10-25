
import { db } from "./firebase.js";
import {
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

function getTimestampMillis(value) {
    return value && typeof value.toMillis === "function"
        ? value.toMillis()
        : 0;
}

function formatPostDate(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== "function") {
        return "Just now";
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(timestamp.toDate());
}

function createPostElement(post, currentUser) {
    const article = document.createElement("article");
    article.className = "feed-post";

    const header = document.createElement("div");
    header.className = "feed-post-header";

    const author = document.createElement("h3");
    author.className = "feed-post-author";

    const authorLink = document.createElement("a");
    authorLink.textContent = post.authorName || "Near member";

    if (post.authorId === currentUser.uid) {
        authorLink.href = "profile.html";
    } else {
        authorLink.href =
            `view-profile.html?uid=${encodeURIComponent(post.authorId)}`;
    }

    author.append(authorLink);

    const date = document.createElement("time");
    date.className = "feed-post-date";
    date.textContent = formatPostDate(post.createdAt);

    if (post.createdAt && typeof post.createdAt.toDate === "function") {
        date.dateTime = post.createdAt.toDate().toISOString();
    }

    header.append(author, date);
    article.append(header);

    const body = document.createElement("p");
    body.className = "feed-post-text";
    body.textContent = post.text || "";
    article.append(body);

    return article;
}

export async function loadFeed(currentUser, elements) {
    const { feedPosts, feedStatus, caughtUpMessage } = elements;

    if (!currentUser || !feedPosts || !feedStatus || !caughtUpMessage) {
        return;
    }

    feedPosts.replaceChildren();
    caughtUpMessage.classList.add("hidden");
    feedStatus.textContent = "Loading your feed...";
    feedStatus.classList.remove("error", "success");

    try {
        const friendshipQuery = query(
            collection(db, "friendships"),
            where("userIds", "array-contains", currentUser.uid)
        );

        const friendshipSnapshot = await getDocs(friendshipQuery);

        const friendIds = friendshipSnapshot.docs
            .map((friendship) =>
                friendship.data().userIds.find(
                    (uid) => uid !== currentUser.uid
                )
            )
            .filter(Boolean);

        const authorIds = [...new Set([currentUser.uid, ...friendIds])];

        const snapshots = await Promise.all(
            authorIds.map((authorId) =>
                getDocs(
                    query(
                        collection(db, "posts"),
                        where("authorId", "==", authorId)
                    )
                )
            )
        );

        const posts = [];

        snapshots.forEach((snapshot) => {
            snapshot.forEach((postSnapshot) => {
                posts.push({
                    id: postSnapshot.id,
                    ...postSnapshot.data()
                });
            });
        });

        posts.sort(
            (a, b) =>
                getTimestampMillis(b.createdAt) -
                getTimestampMillis(a.createdAt)
        );

        if (posts.length === 0) {
            feedStatus.textContent =
                "No updates yet. When you or your friends share something, it will appear here.";
            caughtUpMessage.classList.add("hidden");
            return;
        }

        feedStatus.textContent = "";

        for (const post of posts) {
            feedPosts.append(createPostElement(post, currentUser));
        }

        caughtUpMessage.classList.remove("hidden");
    } catch (error) {
        console.error("Feed loading error:", error);

        feedStatus.textContent =
            "We couldn't load your feed. Check your connection and Firestore security rules, then reload.";

        feedStatus.classList.add("error");
    }
}