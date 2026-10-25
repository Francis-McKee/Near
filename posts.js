
import { db } from "./firebase.js";
import { addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

function setMessage(element, message, type = "") {
    if (!element) return;

    element.textContent = message;
    element.classList.remove("error", "success");

    if (type) element.classList.add(type);
}

export function setupPostForm({
    getCurrentUser,
    getCurrentProfile,
    loadFeed,
    feedElements
}) {
    const postForm = document.querySelector("#post-form");
    const postTextInput = document.querySelector("#post-text");
    const postCharacterCount = document.querySelector("#post-character-count");
    const submitPostButton = document.querySelector("#submit-post-button");
    const postFormMessage = document.querySelector("#post-form-message");

    let isPosting = false;

    if (postTextInput && postCharacterCount) {
        postTextInput.addEventListener("input", () => {
            postCharacterCount.textContent =
                `${postTextInput.value.length.toLocaleString()} / 2,000 characters`;
        });
    }

    if (!postForm) return;

    postForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const currentUser = getCurrentUser();
        const currentProfile = getCurrentProfile();

        if (!currentUser || !currentProfile || isPosting) return;

        const text = postTextInput.value.trim();

        if (!text) {
            setMessage(postFormMessage, "Write something before posting.", "error");
            postTextInput.focus();
            return;
        }

        if (text.length > 2000) {
            setMessage(postFormMessage, "Posts must be 2,000 characters or fewer.", "error");
            return;
        }

        isPosting = true;
        submitPostButton.disabled = true;
        submitPostButton.textContent = "Posting...";
        setMessage(postFormMessage, "");

        try {
            await addDoc(collection(db, "posts"), {
                authorId: currentUser.uid,
                authorName: currentProfile.displayName,
                text,
                createdAt: serverTimestamp()
            });

            postForm.reset();
            postCharacterCount.textContent = "0 / 2,000 characters";

            setMessage(
                postFormMessage,
                "Your post has been shared with your accepted friends.",
                "success"
            );

            await loadFeed(currentUser, feedElements);
        } catch (error) {
            console.error("Post creation error:", error);
            setMessage(
                postFormMessage,
                error.message || "Something went wrong. Please try again.",
                "error"
            );
        } finally {
            isPosting = false;
            submitPostButton.disabled = false;
            submitPostButton.textContent = "Post update";
        }
    });
}