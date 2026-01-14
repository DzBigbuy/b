document.addEventListener('DOMContentLoaded', () => {
    // إعداد Firebase
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

    const supabaseClient = supabase.createClient(
        'https://udzvuqqfuuggimgzlwhl.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkenZ1cXFmdXVnZ2ltZ3psd2hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MjM5MzcsImV4cCI6MjA4MzM5OTkzN30.Dflw05jI_gx1ObugkLRBUap-RO1VEoDFKfQXAaNBvLo'
    );

    // العناصر في الصفحة
    const paymentProofInput = document.getElementById('paymentProof');
    const paymentSubmitBtn = document.getElementById('payment-submit-btn');
    const paymentErrorMessage = document.getElementById('payment-error-message');
    const paymentAmountEl = document.getElementById('payment-amount');
    const paymentAdTitleEl = document.getElementById('payment-ad-title');

    // الحصول على معرف الإعلان من الرابط
    const urlParams = new URLSearchParams(window.location.search);
    const adId = urlParams.get('id');

    let userId = null;
    let adData = null; // Store ad data globally in this script
    let userProfile = null; // Store user profile data

    // Helper to get user profile
    async function getUserProfile(uid) {
        if (!uid) return null;
        try {
            const userProfileRef = db.collection('users').doc(uid).collection('profile').doc(uid);
            const doc = await userProfileRef.get();
            return doc.exists ? doc.data() : null;
        } catch (error) {
            console.error("Error fetching user profile:", error);
            return null;
        }
    }


    // تحقق تسجيل الدخول
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            userId = user.uid;
            // Fetch both ad and user data
            [adData, userProfile] = await Promise.all([
                loadAdData(adId),
                getUserProfile(userId)
            ]);
        } else {
            // إذا لم يسجل المستخدم الدخول، إعادة توجيه لصفحة تسجيل الدخول
            window.location.href = 'login.html';
        }
    });

    // تحميل بيانات الإعلان
    async function loadAdData(id) {
        if (!id) return null;
        try {
            const adDoc = await db.collection('ads').doc(id).get();
            if (adDoc.exists) {
                const data = adDoc.data();
                paymentAdTitleEl.textContent = data.title || 'إعلان';
                paymentAmountEl.textContent = data.price ? `${data.price} دج` : 'غير محدد';
                return data; // Return the data
            } else {
                paymentAdTitleEl.textContent = 'الإعلان غير موجود';
                paymentAmountEl.textContent = '-';
                return null;
            }
        } catch (error) {
            console.error('خطأ عند جلب بيانات الإعلان:', error);
            paymentAdTitleEl.textContent = 'خطأ';
            paymentAmountEl.textContent = '-';
            return null;
        }
    }

    // رفع إثبات الدفع
    if(paymentSubmitBtn){
        paymentSubmitBtn.addEventListener('click', async () => {
            paymentErrorMessage.textContent = '';
            const file = paymentProofInput.files[0];

            if (!file) {
                paymentErrorMessage.textContent = 'الرجاء اختيار ملف إثبات الدفع.';
                return;
            }
             if (!adData || !userProfile) {
                paymentErrorMessage.textContent = 'لم يتم تحميل بيانات الإعلان أو المستخدم. يرجى تحديث الصفحة.';
                return;
            }

            // تفعيل حالة الرفع
            paymentSubmitBtn.textContent = 'جاري الرفع...';
            paymentSubmitBtn.disabled = true;

            try {
                const filePath = `payments/${userId}_${Date.now()}_${file.name}`;
                
                const { error: uploadError } = await supabaseClient.storage
                    .from("DzBigbuy")
                    .upload(filePath, file, {
                        cacheControl: "3600",
                        upsert: false
                    });

                if (uploadError) {
                    throw uploadError;
                }

                 // 2. Get public URL
                const { data: urlData } = supabaseClient.storage
                    .from("DzBigbuy")
                    .getPublicUrl(filePath);

                const proofUrl = urlData.publicUrl;

                // إضافة سجل الدفع إلى Firestore مع البيانات المنسوخة
                await db.collection('payments').add({
                    userId,
                    adId,
                    proofUrl: proofUrl,
                    status: 'pending',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    // Denormalized data
                    userName: `${userProfile.firstName} ${userProfile.lastName}`,
                    adTitle: adData.title,
                    adPrice: adData.price,
                    adSellerId: adData.userProfileId 
                });

                alert('تم إرسال إثبات الدفع بنجاح، في انتظار الموافقة.');
                window.location.href = "account.html";
                
            } catch (error) {
                console.error('خطأ أثناء رفع الملف:', error);
                paymentErrorMessage.textContent = 'حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.';
            } finally {
                // إعادة الزر لحالته الأصلية
                paymentSubmitBtn.textContent = 'تأكيد عملية الدفع';
                paymentSubmitBtn.disabled = false;
            }
        });
    }
});
