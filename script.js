
document.addEventListener('DOMContentLoaded', () => {
    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').then(registration => {
                console.log('SW registered: ', registration);
            }).catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
        });
    }

    // Your web app's Firebase configuration
    const firebaseConfig = {
        apiKey: "AIzaSyBR4q9dem2cVUY-r7bSwzsLQV4M2LNi4zQ",
        authDomain: "studio-7316459997-f5ae3.firebaseapp.com",
        projectId: "studio-7316459997-f5ae3",
        storageBucket: "studio-7316459997-f5ae3.appspot.com",
        messagingSenderId: "647609073070",
        appId: "1:647609073070:web:d17c6eee6a15eb42a45c3f"
    };

    // Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.firestore();
    const auth = firebase.auth();

    // --- DOM Elements ---
    const authContainer = document.getElementById('auth-container');
    const postAdCtaContainer = document.getElementById('post-ad-cta-container');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const postAdForm = document.getElementById('post-ad-form');
    const errorMessageDiv = document.getElementById('error-message');

    // --- Toast Notification ---
    let toastTimer;

    function showToast(message) {
      const toast = document.getElementById('toast-container');
      if (!toast) return;

      toast.textContent = message;
      toast.classList.remove('hidden');
      toast.classList.add('show');
    
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toast.classList.add('hidden');
        toast.classList.remove('show');
      }, 5000); // Hide after 5 seconds
    
      // Allow closing by clicking
      toast.addEventListener('click', () => {
        toast.classList.add('hidden');
        toast.classList.remove('show');
        clearTimeout(toastTimer);
      }, { once: true });
    }

    // --- Notification Sound ---
    function playNotificationSound() {
      const sound = document.getElementById("msgSound");
      if (sound) {
        sound.play().catch(e => console.log("Audio playback failed:", e));
      }
    }


    // --- Unread Messages Badge Listener ---
    let unsubscribeBadgeListener = null;
    let inboxInitialized = false;

    function listenForUnreadMessages(userId) {
        if (unsubscribeBadgeListener) {
            unsubscribeBadgeListener();
        }
        const badge = document.getElementById('inbox-badge');
        const msgTabBadge = document.getElementById('msgBadge');
        if (!userId) {
            if(badge) badge.style.display = 'none';
            if(msgTabBadge) msgTabBadge.style.display = 'none';
            return;
        }

        const query = db.collection('users').doc(userId).collection('inbox');
        
        unsubscribeBadgeListener = query.onSnapshot(snapshot => {
            let unreadCount = 0;
            
            snapshot.docChanges().forEach(change => {
                const docData = change.doc.data();
                if (change.type === "added" && inboxInitialized && !docData.read) {
                     playNotificationSound();
                     showToast(docData.title || 'رسالة جديدة');
                }
            });
            
            snapshot.forEach(doc => {
                 if (doc.data().read === false) {
                    unreadCount++;
                 }
            });

            // Update main header badge
            if (badge) {
                if (unreadCount > 0) {
                    badge.textContent = unreadCount;
                    badge.style.display = 'inline-block';
                } else {
                    badge.style.display = 'none';
                }
            }

            // Update messages tab badge
            if (msgTabBadge) {
                if (unreadCount > 0) {
                    msgTabBadge.textContent = unreadCount;
                    msgTabBadge.style.display = 'inline-block';
                } else {
                    msgTabBadge.style.display = 'none';
                }
            }
            
            if (!inboxInitialized) {
                 inboxInitialized = true;
            }

        }, error => {
            console.error("Error listening to unread messages:", error);
        });
    }

    // Helper function to get user profile
    async function getUserProfile(userId) {
        if (!userId) return null;
        try {
            const userProfileRef = db.collection('users').doc(userId).collection('profile').doc(userId);
            const doc = await userProfileRef.get();
            return doc.exists ? doc.data() : null;
        } catch (error) {
            console.error("Error fetching user profile:", error);
            return null;
        }
    }


    // --- Firebase Auth State Management ---
    auth.onAuthStateChanged(async user => {
        if (user) {
            // --- USER IS SIGNED IN ---
            const userProfile = await getUserProfile(user.uid);
            
            if (authContainer) {
                const userName = userProfile ? userProfile.firstName : 'المستخدم';
                authContainer.innerHTML = `
                    <div class="user-info">
                        <span class="user-name-display">مرحباً<br>${userName}</span>
                        <a href="account.html" class="nav-link" id="accountBtn" style="position:relative;">
                            حسابي
                            <span id="inbox-badge" class="badge" style="display:none;"></span>
                        </a>
                        <button id="logout-btn" class="logout-btn">خروج</button>
                    </div>
                `;
                document.getElementById('logout-btn').addEventListener('click', () => {
                    auth.signOut();
                });
                
                const accountBtn = document.getElementById('accountBtn');
                if(accountBtn) {
                     accountBtn.addEventListener('click', (e) => {
                        e.preventDefault(); 
                        window.location.href = accountBtn.href;
                    });
                }
            }
            
            listenForUnreadMessages(user.uid);

            if(postAdCtaContainer) {
                postAdCtaContainer.innerHTML = `<a href="post-ad.html" class="post-ad-btn">أضف إعلانًا جديدًا</a>`;
            }

            if (document.body.id === 'account-page-body') {
                populateAccountPage(user.uid);
            }

        } else {
            // --- USER IS SIGNED OUT ---
            if (authContainer) {
                authContainer.innerHTML = '<a href="login.html" class="login-btn">تسجيل الدخول</a>';
            }
            if(postAdCtaContainer) {
                postAdCtaContainer.innerHTML = '';
            }
            
            listenForUnreadMessages(null);

             if (document.body.id === 'account-page-body' || window.location.pathname.endsWith('post-ad.html')) {
                if (document.body.id !== 'payment-page-body') {
                    window.location.href = 'login.html';
                }
            }
        }
    });

    // --- Ad Fetching and Rendering ---
    async function fetchAndRenderAds(userType, container) {
        if (!container) return;

        try {
            const adsCollection = db.collection('ads').where('userType', '==', userType);
            const snapshot = await adsCollection.get();

            if (snapshot.empty) {
                container.innerHTML = '<p>لا توجد إعلانات متاحة حاليًا.</p>';
                return;
            }

            container.innerHTML = '';

            snapshot.forEach(doc => {
                const ad = { id: doc.id, ...doc.data() };
                const adCard = createAdCard(ad);
                container.appendChild(adCard);
            });

        } catch (error) {
            console.error(`Error fetching ${userType} ads: `, error);
            container.innerHTML = '<p>حدث خطأ أثناء تحميل الإعلانات.</p>';
        }
    }
    
    // --- Ad Details Page Logic ---
    async function populateAdDetailsPage() {
        const adDetailsContainer = document.getElementById('ad-details-container');
        if (!adDetailsContainer) return;

        const urlParams = new URLSearchParams(window.location.search);
        const adId = urlParams.get('id');

        if (!adId) {
            adDetailsContainer.innerHTML = '<p class="error-message">لم يتم العثور على الإعلان. يرجى التأكد من صحة الرابط.</p>';
            return;
        }

        try {
            const adRef = db.collection('ads').doc(adId);
            const doc = await adRef.get();

            if (doc.exists) {
                const ad = doc.data();
                const creatorName = ad.creatorName || 'مستخدم غير معروف';

                document.title = `${ad.title} - DzBigbuy`;

                adDetailsContainer.innerHTML = `
                    <div class="auth-card" style="max-width: 800px;">
                        <h1 class="auth-title">${ad.title}</h1>
                        <div class="ad-details-meta">
                            <span>الفئة: <strong class="ad-details-category">${ad.category}</strong></span>
                             <span>بواسطة: <a href="account.html?id=${ad.userProfileId}" class="ad-author-link">${creatorName}</a></span>
                            <span>السعر: <strong class="ad-details-price">${ad.price} دج</strong></span>
                        </div>
                        <p class="ad-details-description">${ad.description}</p>
                        <a href="payment.html?id=${doc.id}" class="auth-button">تعامل مع المعلن</a>
                    </div>
                `;
            } else {
                adDetailsContainer.innerHTML = '<p class="error-message">لم يتم العثور على هذا الإعلان.</p>';
            }
        } catch (error) {
            console.error("Error fetching ad details: ", error);
            adDetailsContainer.innerHTML = '<p class="error-message">حدث خطأ أثناء تحميل تفاصيل الإعلان.</p>';
        }
    }


    function createAdCard(ad) {
        const cardLink = document.createElement('a');
        cardLink.href = `ad-details.html?id=${ad.id}`; 
        cardLink.className = 'ad-card';

        const header = document.createElement('div');
        header.className = 'ad-card-header';
        
        const headerTop = document.createElement('div');
        headerTop.className = 'ad-card-header-top';
        const title = document.createElement('h3');
        title.className = 'ad-card-title';
        title.textContent = ad.title;
        headerTop.appendChild(title);
        const badge = document.createElement('span');
        badge.className = `ad-card-badge ${ad.userType || 'trader'}`;
        badge.textContent = (ad.userType === 'trader') ? 'تاجر' : 'مسوق';
        headerTop.appendChild(badge);
        header.appendChild(headerTop);
        
        const meta = document.createElement('div');
        meta.className = 'ad-card-meta';
        const category = document.createElement('p');
        category.className = 'ad-card-category';
        category.textContent = ad.category;
        meta.appendChild(category);
        header.appendChild(meta);
        
        cardLink.appendChild(header);

        const content = document.createElement('div');
        content.className = 'ad-card-content';
        const description = document.createElement('p');
        description.className = 'ad-card-description';
        description.textContent = ad.description;
        content.appendChild(description);
        cardLink.appendChild(content);
        
        const footer = document.createElement('div');
        footer.className = 'ad-card-footer';
        const price = document.createElement('span');
        price.className = 'ad-card-price';
        price.textContent = `${ad.price} دج`;
        footer.appendChild(price);
        
        const detailsBtn = document.createElement('span');
        detailsBtn.className = 'ad-card-details-btn';
        detailsBtn.textContent = 'عرض التفاصيل ←';
        footer.appendChild(detailsBtn);
        cardLink.appendChild(footer);

        const creatorInfo = document.createElement('a');
        creatorInfo.href = `account.html?id=${ad.userProfileId}`;
        creatorInfo.className = 'ad-card-creator';
        creatorInfo.textContent = `بواسطة: ${ad.creatorName || 'مستخدم غير معروف'}`;
        creatorInfo.onclick = (e) => { 
            e.stopPropagation();
            window.location.href = creatorInfo.href;
        };
        header.appendChild(creatorInfo);

        return cardLink;
    }

    // --- Form Handlers ---
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = loginForm.email.value;
            const password = loginForm.password.value;

            auth.signInWithEmailAndPassword(email, password)
                .then(() => {
                    window.location.href = 'index.html';
                })
                .catch(error => {
                    console.error("Login Error:", error);
                    errorMessageDiv.textContent = 'فشل تسجيل الدخول. يرجى التحقق من البريد الإلكتروني وكلمة المرور.';
                });
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const firstName = registerForm.firstName.value;
            const lastName = registerForm.lastName.value;
            const email = registerForm.email.value;
            const password = registerForm.password.value;
            const userType = registerForm.userType.value;

            auth.createUserWithEmailAndPassword(email, password)
                .then(userCredential => {
                    const user = userCredential.user;
                    const userProfileRef = db.collection('users').doc(user.uid).collection('profile').doc(user.uid);
                    return userProfileRef.set({
                        id: user.uid,
                        userType: userType,
                        firstName: firstName,
                        lastName: lastName,
                        email: email,
                        phoneNumber: '',
                        registrationDate: new Date().toISOString(),
                    });
                })
                .then(() => {
                    window.location.href = 'index.html';
                })
                .catch(error => {
                    console.error("Registration Error:", error);
                    errorMessageDiv.textContent = 'فشل إنشاء الحساب. قد يكون البريد الإلكتروني مستخدماً بالفعل.';
                });
        });
    }

    if (postAdForm) {
        postAdForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            if (!user) {
                if (errorMessageDiv) errorMessageDiv.textContent = 'يجب عليك تسجيل الدخول أولاً.';
                setTimeout(() => { window.location.href = 'login.html'; }, 2000);
                return;
            }

            try {
                const title = postAdForm.title.value;
                const description = postAdForm.description.value;
                const category = postAdForm.category.value;
                const price = parseFloat(postAdForm.price.value);

                if (!title || !description || !category || !price) {
                     if (errorMessageDiv) errorMessageDiv.textContent = 'يرجى ملء جميع الحقول.';
                     return;
                }

                 const userProfile = await getUserProfile(user.uid);
                 if (!userProfile) {
                     throw new Error("لم يتم العثور على ملف المستخدم.");
                 }

                 const creatorName = `${userProfile.firstName} ${userProfile.lastName}`;
                 const userType = userProfile.userType || 'trader';


                const adData = {
                    title: title,
                    description: description,
                    category: category,
                    price: price,
                    imageURLs: [postAdForm.imageUrl.value || ''],
                    userProfileId: user.uid,
                    creatorName: creatorName,
                    userType: userType,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                };

                const docRef = await db.collection('ads').add(adData);
                window.location.href = `ad-details.html?id=${docRef.id}`;

            } catch (error) {
                console.error("Error adding ad: ", error);
                if (errorMessageDiv) errorMessageDiv.textContent = 'فشل إضافة الإعلان. يرجى المحاولة مرة أخرى.';
            }
        });
    }

    // --- Ad Deletion Logic ---
    async function deleteAdAndAssociatedMessages(adId) {
        try {
            // 1. Delete the ad itself
            await db.collection('ads').doc(adId).delete();
    
            // 2. Find payments related to the ad to get participant UIDs
            const paymentsSnapshot = await db.collection('payments').where('adId', '==', adId).get();
            const participantIds = new Set();
            paymentsSnapshot.forEach(doc => {
                const payment = doc.data();
                if(payment.userId) participantIds.add(payment.userId);
                if(payment.adSellerId) participantIds.add(payment.adSellerId);
            });
    
            // 3. Delete related messages from each participant's inbox
            const inboxDeletionPromises = [];
            participantIds.forEach(userId => {
                const inboxRef = db.collection('users').doc(userId).collection('inbox');
                const messagesQuery = inboxRef.where('chatId', '!=', null); // A proxy to find messages related to transactions
                
                const promise = messagesQuery.get().then(snapshot => {
                    const batch = db.batch();
                    snapshot.forEach(msgDoc => {
                        // This logic is tricky without a direct adId link. We assume any message with a chatId might be related.
                        // A more robust solution would be to add adId to inbox messages.
                        // For now, we'll proceed with a broader deletion and refine if needed.
                        // Let's assume for now we only delete messages for payments that were for THIS ad.
                         const paymentForThisAd = paymentsSnapshot.docs.some(p => p.data().chatId === msgDoc.data().chatId);
                         if (paymentForThisAd) {
                              batch.delete(msgDoc.ref);
                         }
                    });
                    return batch.commit();
                });
                inboxDeletionPromises.push(promise);
            });
    
            await Promise.all(inboxDeletionPromises);
    
            // Optional: Also delete payments and chats if necessary (can be complex)
    
        } catch (error) {
            console.error("Error during comprehensive ad deletion:", error);
            throw error; // Re-throw to be caught by the caller
        }
    }
    
    function deleteAdFromUI(adId, adTitle) {
        if (!confirm(`هل أنت متأكد من حذف الإعلان "${adTitle}"؟\nسيتم حذف جميع الرسائل المتعلقة به أيضًا.`)) {
            return;
        }
    
        deleteAdAndAssociatedMessages(adId)
            .then(() => {
                showToast('نجاح', 'تم حذف الإعلان بنجاح.');
                // Remove the row from the table visually
                const adRow = document.querySelector(`button[data-ad-id="${adId}"]`).closest('tr');
                if (adRow) {
                    adRow.remove();
                }
            })
            .catch(error => {
                console.error("Error deleting ad:", error);
                showToast('خطأ', 'فشل حذف الإعلان. يرجى المحاولة مرة أخرى.');
            });
    }

     // --- Account Page Logic ---
    async function populateUserAds(userId, viewingOwnProfile) {
        const adsTbody = document.getElementById('user-ads-tbody');
        const adsPlaceholder = document.getElementById('user-ads-placeholder');
        if (!adsTbody || !adsPlaceholder) return;

        const adsQuery = db.collection('ads').where('userProfileId', '==', userId);
        const adsSnapshot = await adsQuery.get();

        if (adsSnapshot.empty) {
            adsTbody.innerHTML = '';
            adsPlaceholder.innerHTML = `<p style="text-align: center; color: var(--muted-foreground); margin-top: 1rem;">${viewingOwnProfile ? 'لم تقم بنشر أي إعلانات بعد.' : 'لم يقم هذا المستخدم بنشر أي إعلانات.'}</p>`;
            adsPlaceholder.style.display = 'block';
        } else {
            adsPlaceholder.style.display = 'none';
            adsTbody.innerHTML = '';
            adsSnapshot.forEach(adDoc => {
                const ad = adDoc.data();
                const adId = adDoc.id;
                const adDate = ad.createdAt.toDate().toLocaleDateString('ar-EG', { numberingSystem: 'latn' });
                
                const deleteButtonHTML = viewingOwnProfile 
                    ? `<button class="table-action-btn delete" data-ad-id="${adId}" data-ad-title="${ad.title}">🗑️</button>` 
                    : '';

                const row = adsTbody.insertRow();
                row.innerHTML = `
                    <td><a href="ad-details.html?id=${adId}" class="table-link">${ad.title}</a></td>
                    <td class="text-nowrap">${ad.price} دج</td>
                    <td class="text-nowrap">${adDate}</td>
                    <td class="action-cell">
                        <a href="ad-details.html?id=${adId}" class="table-action-btn">عرض</a>
                        ${deleteButtonHTML}
                    </td>
                `;
            });
             // Add event listeners for delete buttons after they are created
            adsTbody.querySelectorAll('.delete').forEach(button => {
                button.addEventListener('click', (e) => {
                    const adId = e.currentTarget.dataset.adId;
                    const adTitle = e.currentTarget.dataset.adTitle;
                    deleteAdFromUI(adId, adTitle);
                });
            });
        }
    }

    function populateUserMessages(userId) {
        const inboxContainer = document.getElementById('inbox-container');
        const messagesPlaceholder = document.getElementById('user-messages-placeholder');
        if (!inboxContainer || !messagesPlaceholder || !userId) return;
    
        const inboxRef = db.collection("users").doc(userId).collection("inbox");
        const query = inboxRef.orderBy("createdAt", "desc");
    
        query.onSnapshot((snapshot) => {
            if (snapshot.empty) {
                inboxContainer.innerHTML = '';
                messagesPlaceholder.innerHTML = `<p style="text-align: center; color: var(--muted-foreground); margin-top: 1rem;">لا توجد رسائل في صندوق الوارد حاليًا.</p>`;
                messagesPlaceholder.style.display = 'block';
                return;
            }
            
            messagesPlaceholder.style.display = 'none';
            inboxContainer.innerHTML = ''; // Clear previous messages
            
            snapshot.forEach(doc => {
                const msg = doc.data();
                const msgId = doc.id;
                
                const dateObj = msg.createdAt ? msg.createdAt.toDate() : new Date();
                const date = dateObj.toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const time = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

                const messageDiv = document.createElement("div");
                messageDiv.classList.add("inbox-item");
                if (msg.read) messageDiv.classList.add("read");

                let messageContentHTML = `<div class="inbox-message-content">${msg.message}</div>`;
                if (msg.status === 'accepted' && msg.chatId) {
                    messageContentHTML += `<br><a href="chat.html?id=${msg.chatId}" class="chat-btn">اذهب إلى المحادثة</a>`;
                }

                messageDiv.innerHTML = `
                    <button class="delete-btn" title="حذف الرسالة">✖</button>
                    <div class="inbox-title-status">
                        <span class="inbox-title">${msg.title || 'رسالة جديدة'}</span>
                        <span class="status-badge ${msg.status === 'accepted' ? 'status-approved' : 'status-rejected'}">
                            ${msg.status === 'accepted' ? 'مقبول' : 'مرفوض'}
                        </span>
                    </div>
                    ${messageContentHTML}
                    <div class="inbox-datetime">
                        <span class="inbox-date">${date}</span>
                        <span class="inbox-time">${time}</span>
                    </div>
                `;

                // Handle delete button click
                messageDiv.querySelector(".delete-btn").addEventListener("click", async (e) => {
                    e.stopPropagation();
                    try {
                        await db.collection("users").doc(userId).collection("inbox").doc(msgId).delete();
                        // The onSnapshot will automatically remove it from the UI
                    } catch (error) {
                        console.error("Error deleting message:", error);
                        showToast('خطأ', 'فشل حذف الرسالة.');
                    }
                });

                // Handle message click to mark as read and open
                messageDiv.addEventListener("click", async () => {
                    if (!msg.read && msg.chatId) {
                       window.location.href = `chat.html?id=${msg.chatId}`;
                    } else if (msg.chatId) {
                        window.location.href = `chat.html?id=${msg.chatId}`;
                    }
                    if (!msg.read) {
                        try {
                           await db.collection("users").doc(userId).collection("inbox").doc(msgId).update({ read: true });
                        } catch (error) {
                           console.error("Error marking as read:", error);
                        }
                    }
                });

                inboxContainer.appendChild(messageDiv);
            });
        }, (error) => {
             console.error("Error fetching messages:", error);
             messagesPlaceholder.innerHTML = `<p class="error-message" style="text-align: center;">فشل جلب الرسائل.</p>`;
        });
    }
    

    async function populateAccountPage(userId) {
        const viewingOwnProfile = true; // Since this is the user's own account page
        const profileToView = await getUserProfile(userId);

        const profileContent = document.getElementById('profile');
        if (!profileContent) return;

        if (profileToView) {
            document.getElementById('profile-name').textContent = `${profileToView.firstName} ${profileToView.lastName}`;
            document.getElementById('profile-email').textContent = profileToView.email;
            document.getElementById('profile-usertype').textContent = profileToView.userType === 'trader' ? 'تاجر' : 'مسوق';
            document.getElementById('profile-since').textContent = new Date(profileToView.registrationDate).toLocaleDateString('ar-EG', { numberingSystem: 'arab' });

            populateUserAds(userId, viewingOwnProfile);
            populateUserMessages(userId);

        } else {
            profileContent.innerHTML = '<p>لم يتم العثور على بيانات الملف الشخصي لهذا المستخدم.</p>';
            document.getElementById('ads').style.display = 'none';
            document.getElementById('messages').style.display = 'none';
        }
    }

    // --- Tab Switching Logic ---
    function initializeTabs() {
        const tabButtons = document.querySelectorAll(".tab-btn");
        const tabContents = document.querySelectorAll(".tab-content");

        if(tabButtons.length === 0) return;

        // Set first tab as active by default
        tabButtons[0].classList.add("active");
        tabContents[0].style.display = "block";

        tabButtons.forEach(btn => {
          btn.addEventListener("click", () => {
            // إزالة التفعيل من الجميع
            tabButtons.forEach(b => b.classList.remove("active"));
            tabContents.forEach(c => c.style.display = "none");

            // تفعيل الحالي
            btn.classList.add("active");
            const tabId = btn.dataset.tab;
            const activeTab = document.getElementById(tabId);
            if (activeTab) {
                activeTab.style.display = "block";
            }
            
            // Mark all messages as read when messages tab is opened
            if (tabId === 'messages') {
                const user = auth.currentUser;
                if(user) {
                    const inboxRef = db.collection('users').doc(user.uid).collection('inbox');
                    inboxRef.where('read', '==', false).get().then(snapshot => {
                        const batch = db.batch();
                        snapshot.docs.forEach(doc => {
                            batch.update(doc.ref, { read: true });
                        });
                        batch.commit().catch(err => console.error("Error marking messages as read:", err));
                    });
                }
            }
          });
        });
    }


    // --- Initial Page Load Logic ---
    function initializePage() {
        const traderAdsContainer = document.getElementById('trader-ads-container');
        const marketerAdsContainer = document.getElementById('marketer-ads-container');

        if (traderAdsContainer) {
            fetchAndRenderAds('trader', traderAdsContainer);
        }
        if (marketerAdsContainer) {
            fetchAndRenderAds('marketer', marketerAdsContainer);
        }
        if (document.body.id === 'ad-details-page-body') {
            populateAdDetailsPage();
        }
        if (document.body.id === 'account-page-body') {
            initializeTabs();
        }
    }

    (function () {
      const arabicNums = /[٠-٩]/g;
      const map = {
        '٠':'0','١':'1','٢':'2','٣':'3','٤':'4',
        '٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'
      };
    
      function convertTextNode(node) {
        if (node.nodeType === 3) { // Text node
            let text = node.nodeValue;
            
            // Proceed only if there are Arabic numerals
            if (!arabicNums.test(text)) return;
            
            let converted = text.replace(arabicNums, d => map[d]);

            // Check if the node is purely numeric or contains numbers
            // and avoid wrapping non-numeric content like dates.
            // A simple check for digits should suffice for most cases.
            if (/\d/.test(converted)) {
                // If it's just a number, wrap it.
                if (/^\d+$/.test(converted.trim())) {
                    node.nodeValue = '(' + converted.trim() + ')';
                    if (node.parentElement) {
                        node.parentElement.style.direction = 'ltr';
                        node.parentElement.style.unicodeBidi = 'embed';
                    }
                } else {
                    // It's mixed content (like "Page 1 of ١٠"), just convert numbers
                    node.nodeValue = converted;
                }
            }
        }
      }
    
      function walk(node) {
        if (node.nodeType === 3) {
          convertTextNode(node);
        } else if (node.childNodes) {
          node.childNodes.forEach(walk);
        }
      }
    
      // Initial walk on DOMContentLoaded
      walk(document.body);
    
      // Observe for future changes
      const observer = new MutationObserver(mutations => {
        mutations.forEach(m => {
          if (m.addedNodes) {
            m.addedNodes.forEach(n => walk(n));
          }
        });
      });
    
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true // Also observe changes to text nodes
      });
    
    })();

    initializePage();

});
