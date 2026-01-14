document.addEventListener('DOMContentLoaded', () => {
    // Basic Firebase setup
    const firebaseConfig = {
        apiKey: "AIzaSyBR4q9dem2cVUY-r7bSwzsLQV4M2LNi4zQ",
        authDomain: "studio-7316459997-f5ae3.firebaseapp.com",
        projectId: "studio-7316459997-f5ae3",
        storageBucket: "studio-7316459997-f5ae3.appspot.com",
        messagingSenderId: "647609073070",
        appId: "1:647609073070:web:d17c6eee6a15eb42a45c3f"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.firestore();
    const auth = firebase.auth();
    const ADMIN_UID = "WEOFvjCGEwTQ52YJAuIcmOk3ZDB2";
    
    const supabaseClient = supabase.createClient(
        'https://udzvuqqfuuggimgzlwhl.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkenZ1cXFmdXVnZ2ltZ3psd2hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MjM5MzcsImV4cCI6MjA4MzM5OTkzN30.Dflw05jI_gx1ObugkLRBUap-RO1VEoDFKfQXAaNBvLo'
    );

    // DOM Elements
    const chatMessagesContainer = document.getElementById('chat-messages');
    const messageInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-btn');
    const attachButton = document.getElementById('attach-button');
    const fileInput = document.getElementById('file-input');
    
    // Image Preview Elements
    const imagePreviewBox = document.getElementById('imagePreviewBox');
    const previewImage = document.getElementById('previewImage');
    const confirmImageBtn = document.getElementById('confirmImage');
    const cancelImageBtn = document.getElementById('cancelImage');
    let selectedImageFile = null;

    // Image Modal Elements
    const imageModal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');

    // Get chat ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const chatId = urlParams.get('id');

    if (!chatId) {
        chatMessagesContainer.innerHTML = '<p style="text-align:center; color: var(--error);">لم يتم العثور على معرف المحادثة.</p>';
        if(messageInput) messageInput.disabled = true;
        if(sendButton) sendButton.disabled = true;
        return;
    }

    // --- UX Functions ---
    function scrollToBottom() {
      if(chatMessagesContainer) {
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
      }
    }
    
    if(messageInput && sendButton) {
        messageInput.addEventListener('input', () => {
            sendButton.disabled = !messageInput.value.trim();
        });

        messageInput.addEventListener("keypress", e => {
          if (e.key === "Enter" && !sendButton.disabled) {
            sendButton.click();
          }
        });
    }
    
    async function getUserProfile(userId) {
        if (!userId) return null;
        try {
            const userProfileRef = db.collection('users').doc(userId).collection('profile').doc(userId);
            const doc = await userProfileRef.get();
            return doc.exists ? doc.data() : null;
        } catch (error) {
            console.error(`Error fetching user profile for ID ${userId}:`, error);
            return null;
        }
    }

    // --- Message Rendering ---
    function renderMessage(msg, currentUserId, previousMsg) {
        const wrapper = document.createElement("div");
        const isMine = msg.senderId === currentUserId;
        wrapper.classList.add("message-wrapper", isMine ? "me" : "other");

        const showName = !isMine && (!previousMsg || previousMsg.senderId !== msg.senderId);

        const time = msg.createdAt?.toDate ?
            msg.createdAt.toDate().toLocaleString("ar-DZ", {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: "2-digit",
                minute: "2-digit"
            }) :
            "";

        const readIcon = isMine ? (msg.readBy?.length > 1 ? "✔✔" : "✔") : "";
        const readClass = isMine && msg.readBy?.length > 1 ? "read" : "";

        let messageContent = '';
        if (msg.type === 'image' && msg.imageUrl) {
            messageContent = `<img src="${msg.imageUrl}" alt="Image message" class="chat-image">`;
        } else {
            messageContent = msg.text;
        }

        wrapper.innerHTML = `
            ${showName ? `<div class="username">${msg.senderName || 'مستخدم'}</div>` : ""}
            <div class="message-bubble ${isMine ? "me" : "other"}">
                ${messageContent}
            </div>
            <div class="message-time ${readClass}">
                ${time} ${isMine ? readIcon : ""}
            </div>
        `;

        return wrapper;
    }

    // --- Chat Header Logic ---
    async function loadChatAdLink(chatId) {
        const adLinkBtn = document.getElementById('chat-ad-link');
        if (!chatId || !adLinkBtn) return;
    
        try {
            const chatRef = db.collection('chats').doc(chatId);
            const chatSnap = await chatRef.get();
    
            if (chatSnap.exists()) {
                const chatData = chatSnap.data();
                if (chatData.adId) {
                    adLinkBtn.href = `ad-details.html?id=${chatData.adId}`;
                    adLinkBtn.style.display = 'inline-block';
                }
            }
        } catch (error) {
            console.error("Failed to load chat ad link:", error);
            adLinkBtn.style.display = 'none';
        }
    }


    // --- Image Handling ---
    async function sendImageMessage(imageUrl, senderName) {
        const user = auth.currentUser;
        if (!user || !chatId) return;

        try {
            await db.collection('chats').doc(chatId).collection('messages').add({
                senderId: user.uid,
                senderName: senderName,
                type: 'image',
                text: '',
                imageUrl: imageUrl,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                readBy: [user.uid]
            });

            if (user.uid !== ADMIN_UID) {
                const notifRef = db.collection("admin").doc("notifications");
                notifRef.set({
                    chatUnread: firebase.firestore.FieldValue.increment(1)
                }, { merge: true });
            }

        } catch (error) {
            console.error("Error sending image message:", error);
            alert("فشل إرسال رسالة الصورة.");
        }
    }

    async function uploadChatImage(file, senderName) {
        const user = auth.currentUser;
        if (!user || !file) return;

        confirmImageBtn.disabled = true;
        confirmImageBtn.textContent = 'جاري...';

        const fileName = `chat-media/${user.uid}_${Date.now()}_${file.name}`;
        
        try {
            const { error: uploadError } = await supabaseClient.storage
                .from("DzBigbuy")
                .upload(fileName, file, { cacheControl: "3600", upsert: false });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabaseClient.storage
                .from("DzBigbuy")
                .getPublicUrl(fileName);

            await sendImageMessage(urlData.publicUrl, senderName);

        } catch (error) {
            console.error("Error uploading image:", error);
            alert("فشل في رفع الصورة.");
        } finally {
            confirmImageBtn.disabled = false;
            confirmImageBtn.textContent = '✔ إرسال';
        }
    }

    if(attachButton && fileInput) {
        attachButton.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            selectedImageFile = file;
            const reader = new FileReader();
            reader.onload = () => {
                if (previewImage) previewImage.src = reader.result;
                if (imagePreviewBox) imagePreviewBox.classList.remove("hidden");
            };
            reader.readAsDataURL(file);
        });
    }

    if(cancelImageBtn) {
        cancelImageBtn.addEventListener('click', () => {
            selectedImageFile = null;
            fileInput.value = "";
            if (imagePreviewBox) imagePreviewBox.classList.add("hidden");
        });
    }

    // --- Image Modal Logic ---
    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("chat-image")) {
            if(modalImage) modalImage.src = e.target.src;
            if(imageModal) imageModal.classList.remove("hidden");
        }
    });

    if(imageModal) {
        imageModal.addEventListener('click', () => imageModal.classList.add("hidden"));
    }

    // --- Main Auth and Chat Logic ---
    auth.onAuthStateChanged(async user => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        const currentUser = user;
        const userProfile = await getUserProfile(currentUser.uid);
        const senderName = userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'مستخدم';
        
        loadChatAdLink(chatId);

        if(confirmImageBtn) {
            confirmImageBtn.addEventListener('click', async () => {
                if (!selectedImageFile) return;
                await uploadChatImage(selectedImageFile, senderName);
                selectedImageFile = null;
                fileInput.value = "";
                if (imagePreviewBox) imagePreviewBox.classList.add("hidden");
            });
        }
        
        const messagesQuery = db.collection('chats').doc(chatId).collection('messages').orderBy('createdAt', 'asc');
        
        const unsubscribe = messagesQuery.onSnapshot(snapshot => {
            if (snapshot.empty) {
                 chatMessagesContainer.innerHTML = '<p style="text-align:center; color: var(--muted-foreground); margin: auto;">لا توجد رسائل بعد. ابدأ المحادثة!</p>';
                 return;
            }
            
            chatMessagesContainer.innerHTML = '';
            
            let previousMsg = null;
            const messages = snapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));

            messages.forEach(message => {
                if (!message.readBy?.includes(currentUser.uid) && message.senderId !== currentUser.uid) {
                    message.ref.update({
                        readBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                    });
                }
                
                chatMessagesContainer.appendChild(renderMessage(message, currentUser.uid, previousMsg));
                previousMsg = message;
            });
            
            scrollToBottom();

        }, error => {
            console.error("Error fetching messages:", error);
            chatMessagesContainer.innerHTML = `<p style="text-align:center; color: var(--error);">فشل في تحميل الرسائل.</p>`;
        });

        // Handle text message sending
        if (sendButton) {
            sendButton.addEventListener('click', async () => {
                const text = messageInput.value.trim();

                if (text) {
                    messageInput.value = '';
                    sendButton.disabled = true;
                    navigator.vibrate?.(20);

                    try {
                        await db.collection('chats').doc(chatId).collection('messages').add({
                            senderId: currentUser.uid,
                            senderName: senderName,
                            type: 'text',
                            text: text,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            readBy: [currentUser.uid]
                        });

                        if (currentUser.uid !== ADMIN_UID) {
                            const notifRef = db.collection("admin").doc("notifications");
                            notifRef.set({
                                chatUnread: firebase.firestore.FieldValue.increment(1)
                            }, { merge: true });
                        }

                    } catch (error) {
                        console.error("Error sending message:", error);
                    }
                }
            });
        }
        
        window.addEventListener('beforeunload', () => {
            if (unsubscribe) {
                unsubscribe();
            }
        });
    });
});
