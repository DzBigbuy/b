

document.addEventListener('DOMContentLoaded', () => {
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

    const loginSection = document.getElementById('admin-login-section');
    const dashboardSection = document.getElementById('admin-dashboard-section');
    const loginForm = document.getElementById('admin-login-form');
    const errorMessageDiv = document.getElementById('admin-error-message');
    const logoutBtn = document.getElementById('admin-logout-btn');

    const usersTbody = document.getElementById('users-tbody');
    const usersPlaceholder = document.getElementById('users-placeholder');
    const adsTbody = document.getElementById('ads-tbody');
    const adsPlaceholder = document.getElementById('ads-placeholder');
    const paymentsTbody = document.getElementById('payments-tbody');
    const paymentsPlaceholder = document.getElementById('payments-placeholder');

    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // --- Pagination State ---
    let allPayments = [];
    let currentPage = 1;
    const rowsPerPage = 10;
    const paginationControls = document.getElementById('pagination-controls');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    const pageInfo = document.getElementById('page-info');

    function showDashboard() {
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';
    }

    function showLogin() {
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
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
    
     async function getAdDetails(adId) {
        if (!adId) return null;
        try {
            const adRef = db.collection('ads').doc(adId);
            const doc = await adRef.get();
            return doc.exists ? { id: doc.id, ...doc.data() } : null;
        } catch (error) {
            console.error("Error fetching ad details:", error);
            return null;
        }
    }

    async function fetchAndDisplayUsers() {
        if (!usersTbody || !usersPlaceholder) return;
        try {
            const usersSnapshot = await db.collection('users').get();
    
            if (usersSnapshot.empty) {
                usersPlaceholder.innerHTML = '<p style="text-align: center;">لا يوجد مستخدمون مسجلون حاليًا.</p>';
                usersPlaceholder.style.display = 'block';
                return;
            }
            
            usersTbody.innerHTML = '';
            usersPlaceholder.style.display = 'none';
    
            for (const userDoc of usersSnapshot.docs) {
                const profileDoc = await userDoc.ref.collection('profile').doc(userDoc.id).get();
                
                if (!profileDoc.exists) {
                    console.warn(`Profile not found for user ID: ${userDoc.id}`);
                    continue;
                }
    
                const user = profileDoc.data();
                const registrationDate = user.registrationDate ? new Date(user.registrationDate).toLocaleDateString('ar-EG', { numberingSystem: 'latn' }) : 'غير متوفر';
    
                const row = usersTbody.insertRow();
                row.innerHTML = `
                    <td>${user.firstName} ${user.lastName}</td>
                    <td>${user.email}</td>
                    <td>${user.userType === 'trader' ? 'تاجر' : 'مسوق'}</td>
                    <td class="text-nowrap">${registrationDate}</td>
                `;
            }
        } catch (error) {
            console.error("Error fetching users collection:", error);
            usersPlaceholder.innerHTML = `<p class="error-message" style="text-align: center;">فشل جلب بيانات المستخدمين. الخطأ: ${error.message}</p>`;
            usersPlaceholder.style.display = 'block';
        }
    }

    async function fetchAndDisplayAds() {
        if (!adsTbody || !adsPlaceholder) return;
        try {
            const snapshot = await db.collection('ads').orderBy('createdAt', 'desc').get();

            if (snapshot.empty) {
                adsPlaceholder.innerHTML = '<p style="text-align: center;">لا توجد إعلانات منشورة حاليًا.</p>';
                return;
            }

            adsTbody.innerHTML = '';
            adsPlaceholder.style.display = 'none';

            for (const doc of snapshot.docs) {
                const ad = doc.data();
                const adId = doc.id;
                let creatorName = ad.creatorName || 'غير معروف';

                const adDate = ad.createdAt && ad.createdAt.toDate ? ad.createdAt.toDate().toLocaleDateString('ar-EG', { numberingSystem: 'latn' }) : (ad.createdAt ? new Date(ad.createdAt).toLocaleDateString('ar-EG', { numberingSystem: 'latn' }) : 'غير متوفر');
                const row = adsTbody.insertRow();
                row.innerHTML = `
                    <td><a href="ad-details.html?id=${adId}" class="table-link" target="_blank">${ad.title}</a></td>
                    <td>${creatorName}</td>
                    <td class="text-nowrap">${ad.price} دج</td>
                    <td class="text-nowrap">${adDate}</td>
                `;
            }

        } catch (error) {
            console.error("Error fetching ads:", error);
            adsPlaceholder.innerHTML = `<p class="error-message" style="text-align: center;">فشل جلب الإعلانات. الخطأ: ${error.message}</p>`;
        }
    }
    
    function getStatusBadge(status) {
        switch (status) {
            case 'approved':
                return '<span class="status-badge status-approved">مقبول</span>';
            case 'rejected':
                return '<span class="status-badge status-rejected">مرفوض</span>';
            case 'pending':
            default:
                return '<span class="status-badge status-pending">قيد المراجعة</span>';
        }
    }
    
    function getActionButtons(payment) {
        const { status, id: paymentId, userId, adId, adSellerId, chatId } = payment;

        if (status === 'pending') {
            return `
                <button class="table-action-btn approve-btn" data-payment-id="${paymentId}" data-user-id="${userId}" data-ad-id="${adId}" data-seller-id="${adSellerId || ''}">قبول</button>
                <button class="table-action-btn reject-btn" data-payment-id="${paymentId}" data-user-id="${userId}" data-ad-id="${adId}">رفض</button>
            `;
        }
        if (status === 'approved' && chatId) {
            return `<a href="chat.html?id=${chatId}" target="_blank" class="table-action-btn chat-btn-admin">محادثة</a>`;
        }
        return 'لا يوجد إجراء';
    }
    
    function handleViewProof(proofUrl) {
        if (proofUrl) {
            window.open(proofUrl, '_blank');
        } else {
            alert('رابط إثبات الدفع غير متوفر.');
        }
    }

    async function fetchAllPayments() {
        try {
            const snapshot = await db.collection('payments').orderBy('createdAt', 'desc').get();
            const paymentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return paymentsData;
        } catch (error) {
            console.error("Error fetching payments:", error);
            paymentsPlaceholder.innerHTML = `<p class="error-message" style="text-align: center;">فشل جلب سجلات الدفع. الخطأ: ${error.message}</p>`;
            return [];
        }
    }

    async function displayPaymentsPage(page) {
        paymentsTbody.innerHTML = '';
        currentPage = page;
        const start = (page - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        const paginatedItems = allPayments.slice(start, end);

        if (paginatedItems.length === 0 && page === 1) {
            paymentsPlaceholder.innerHTML = '<p style="text-align: center;">لا توجد سجلات دفع حاليًا.</p>';
            paymentsPlaceholder.style.display = 'block';
            paginationControls.style.display = 'none';
            return;
        }

        paymentsPlaceholder.style.display = 'none';

        for (const payment of paginatedItems) {
            const paymentId = payment.id;

            let userName = payment.userName || 'مستخدم غير معروف';
            let adTitle = payment.adTitle;
            let adSellerId = payment.adSellerId;
            let adPrice = payment.adPrice || "0";

            if (!payment.userName && payment.userId) {
                const userProfile = await getUserProfile(payment.userId);
                userName = userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'مستخدم محذوف';
            }
            if (!adTitle && payment.adId) {
                const adDetails = await getAdDetails(payment.adId);
                if (adDetails) {
                    adTitle = adDetails.title;
                    adSellerId = adDetails.userProfileId; // Ensure sellerId is fetched if missing
                    payment.adSellerId = adDetails.userProfileId; // Update payment object for getActionButtons
                    adPrice = adDetails.price || adPrice;
                } else {
                    adTitle = 'إعلان محذوف';
                }
            }
            
            const paymentDate = payment.createdAt ? payment.createdAt.toDate().toLocaleString('ar-EG', { numberingSystem: 'latn' }) : 'غير متوفر';
            const adLinkIcon = payment.adId ? `<a href="ad-details.html?id=${payment.adId}" target="_blank" title="فتح الإعلان في تبويب جديد" class="table-link-icon">📢</a>` : '—';
            
            const formattedUserName = userName.replace(' ', '<br>');

            const row = paymentsTbody.insertRow();
            row.id = `payment-${paymentId}`;
            row.innerHTML = `
                <td>${formattedUserName}</td>
                <td><a href="#" class="table-link view-proof-btn" data-proof-url="${payment.proofUrl || ''}">عرض</a></td>
                <td class="price-cell">${adPrice}</td>
                <td>${adLinkIcon}</td>
                <td class="text-nowrap">${paymentDate}</td>
                <td>${getStatusBadge(payment.status)}</td>
                <td class="action-cell">${getActionButtons(payment)}</td>
            `;
        }
        updatePaginationControls();
    }

    function updatePaginationControls() {
        const totalPages = Math.ceil(allPayments.length / rowsPerPage);
        if (totalPages <= 1) {
            paginationControls.style.display = 'none';
            return;
        }

        paginationControls.style.display = 'flex';
        pageInfo.textContent = `صفحة ${currentPage} من ${totalPages}`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages;
    }


    async function initializePaymentsView() {
        if (!paymentsTbody || !paymentsPlaceholder) return;
        
        allPayments = await fetchAllPayments();

        if (allPayments.length === 0) {
            paymentsPlaceholder.innerHTML = '<p style="text-align: center;">لا توجد سجلات دفع حاليًا.</p>';
            paymentsPlaceholder.style.display = 'block';
            paymentsTbody.innerHTML = '';
            paginationControls.style.display = 'none';
        } else {
            paymentsPlaceholder.style.display = 'none';
            await displayPaymentsPage(1);
        }
    }
    
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                displayPaymentsPage(currentPage - 1);
            }
        });
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(allPayments.length / rowsPerPage);
            if (currentPage < totalPages) {
                displayPaymentsPage(currentPage + 1);
            }
        });
    }


    async function handlePaymentAction(paymentId, newStatus, userId, adId, sellerId = null) {
        try {
            const paymentRef = db.collection('payments').doc(paymentId);
            
            if (newStatus === 'approved' && userId) {
                 if (!sellerId) {
                    alert('خطأ: لم يتم العثور على معرّف صاحب الإعلان. لا يمكن إنشاء المحادثة.');
                    console.error("handlePaymentAction failed: sellerId is null or undefined for adId:", adId);
                    await paymentRef.update({ status: 'rejected' }); // Mark as rejected to avoid re-processing
                    return;
                }

                const chatRef = await db.collection('chats').add({
                    participants: [sellerId, userId, ADMIN_UID],
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Update payment with new status and chatId
                await paymentRef.update({ status: newStatus, chatId: chatRef.id });

                const buyerMessage = {
                    title: `تم قبول طلبكم للإعلان`,
                    message: `تهانينا! تمت الموافقة على الدفع. يمكنك الآن التواصل مباشرة مع المعلن لبدء التعامل.`,
                    status: 'accepted',
                    type: 'payment',
                    chatId: chatRef.id,
                    from: 'admin',
                    read: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                await db.collection('users').doc(userId).collection('inbox').add(buyerMessage);
                
                const sellerMessage = {
                    title: `طلب<br>على إعلانك`,
                    message: `تهانينا! لقد أبدى أحد المستخدمين اهتمامه بإعلانك وقام بالدفع. يمكنك الآن التواصل معه مباشرة.`,
                    status: 'accepted',
                    type: 'payment',
                    chatId: chatRef.id,
                    from: 'admin',
                    read: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                await db.collection('users').doc(sellerId).collection('inbox').add(sellerMessage);


            } else if (newStatus === 'rejected') { 
                await paymentRef.update({ status: newStatus });
                const rejectMessage = {
                    title: `تم رفض طلبكم للإعلان`,
                    message: 'تم رفض إثبات الدفع الذي قدمته. قد يكون السبب هو عدم وضوح الرقم أو عدم مطابقته. يرجى المحاولة مرة أخرى أو التواصل مع الدعم.',
                    status: 'rejected',
                    type: 'payment',
                    from: 'admin',
                    read: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                 await db.collection('users').doc(userId).collection('inbox').add(rejectMessage);
            }

            // Refresh view
            const paymentIndex = allPayments.findIndex(p => p.id === paymentId);
            if(paymentIndex > -1) {
                allPayments[paymentIndex].status = newStatus;
                if(newStatus === 'approved') {
                    const paymentDoc = await paymentRef.get();
                    allPayments[paymentIndex].chatId = paymentDoc.data().chatId;
                }
            }
            await displayPaymentsPage(currentPage);
            
        } catch (error) {
            console.error(`Error updating payment status for ${paymentId}:`, error);
            alert('فشل تحديث حالة الدفع. يرجى المحاولة مرة أخرى.');
        }
    }

    if (paymentsTbody) {
        paymentsTbody.addEventListener('click', (e) => {
            const target = e.target;
            
            if (target.classList.contains('view-proof-btn')) {
                e.preventDefault();
                const proofUrl = target.dataset.proofUrl;
                handleViewProof(proofUrl);
                return;
            }
            
             if (target.classList.contains('table-link-icon')) {
                // This is a normal link, let the browser handle it
                return;
            }

            if (target.classList.contains('approve-btn') || target.classList.contains('reject-btn')) {
                e.preventDefault();
                const parentRow = target.closest('tr');
                if (!parentRow) return;

                const actionCell = target.closest('.action-cell');
                if (!actionCell) return;
                
                const approveBtn = actionCell.querySelector('.approve-btn');
                const rejectBtn = actionCell.querySelector('.reject-btn');

                const paymentId = (approveBtn || rejectBtn)?.dataset.paymentId;
                const userId = (approveBtn || rejectBtn)?.dataset.userId;
                const adId = (approveBtn || rejectBtn)?.dataset.adId;
                const sellerId = (approveBtn || rejectBtn)?.dataset.sellerId;

                if (target.classList.contains('approve-btn')) {
                    if(paymentId && userId && adId) handlePaymentAction(paymentId, 'approved', userId, adId, sellerId);
                }
                if (target.classList.contains('reject-btn')) {
                     if(paymentId && userId && adId) handlePaymentAction(paymentId, 'rejected', userId, adId); 
                }
            }
        });
    }

    if (tabs.length > 0) {
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = document.querySelector(tab.dataset.tabTarget);

                tabContents.forEach(content => {
                    content.classList.remove('active');
                });
                tabs.forEach(t => {
                    t.classList.remove('active');
                });

                tab.classList.add('active');
                target.classList.add('active');

                // Reset chat notification counter if clicking on payments tab
                if (tab.dataset.tabTarget === '#payments-content') {
                     db.collection("admin").doc("notifications").set({ chatUnread: 0 }, { merge: true });
                }
            });
        });
    }

    function listenForAdminNotifications() {
        const notifRef = db.collection("admin").doc("notifications");
        const badge = document.getElementById("chat-badge");

        if (!notifRef || !badge) return;

        notifRef.onSnapshot(doc => {
            if (!doc.exists || !doc.data().chatUnread) {
                badge.style.display = "none";
                return;
            }
            const count = doc.data().chatUnread;
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = "inline-block";
            } else {
                badge.style.display = "none";
            }
        }, err => {
            console.error("Error listening to admin notifications:", err);
            badge.style.display = "none";
        });
    }


    auth.onAuthStateChanged(user => {
        if (user && user.uid === ADMIN_UID) {
            showDashboard();
            user.getIdToken(true).then(() => {
                fetchAndDisplayUsers();
                fetchAndDisplayAds();
                initializePaymentsView();
                listenForAdminNotifications();
            });
        } else {
            showLogin();
            if (user) {
                auth.signOut();
            }
        }
    });

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = loginForm['admin-email'].value;
            const password = loginForm['admin-password'].value;

            auth.signInWithEmailAndPassword(email, password)
                .catch(error => {
                    console.error("Admin Login Error:", error);
                    errorMessageDiv.textContent = 'فشل تسجيل الدخول. يرجى التحقق من البيانات.';
                });
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            auth.signOut();
        });
    }
});
