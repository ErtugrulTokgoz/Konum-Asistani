// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

const locationText = document.getElementById('location-text');
const locationPing = document.getElementById('location-ping');
const refreshLocationBtn = document.getElementById('refresh-location');
const editLocationBtn = document.getElementById('edit-location');
const shareLocationBtn = document.getElementById('btn-share-location');
const categoryBtns = document.querySelectorAll('.category-btn');

const modal = document.getElementById('results-modal');
const modalBackdrop = document.getElementById('modal-backdrop');
const modalContent = document.getElementById('modal-content');
const closeModalBtn = document.getElementById('close-modal');
const resultsContainer = document.getElementById('results-container');
const modalTitle = document.getElementById('modal-title');

let userLocation = null;
let currentAddress = "";

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    getLocation();
});

refreshLocationBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    getLocation();
});

locationText.addEventListener('click', manualLocationPrompt);
editLocationBtn.addEventListener('click', manualLocationPrompt);

shareLocationBtn.addEventListener('click', () => {
    if (!userLocation) {
        alert("Konumunuz henüz bulunamadı. Lütfen konum izni verdiğinizden emin olun.");
        return;
    }
    const mapsUrl = `https://www.google.com/maps?q=${userLocation.lat},${userLocation.lng}`;
    const text = `Benim güncel konumum: ${currentAddress}\n\nHaritada görmek için:\n${mapsUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
});

// Category button clicks
categoryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const isDuty = btn.dataset.duty === 'true';
        
        // Eğer Nöbetçi Eczane butonuna basıldıysa direkt siteye yönlendir
        if (isDuty) {
            window.open('https://www.eczaneler.gen.tr/', '_blank');
            return;
        }

        if (!userLocation) {
            alert("Lütfen önce konumunuzun bulunmasını bekleyin.");
            return;
        }
        
        const type = btn.dataset.type;
        const title = btn.querySelector('span').innerText;
        
        openModal(title);
        fetchOverpassData(type, false);
    });
});

// Modal functions
function openModal(title) {
    modalTitle.innerHTML = `<i class="fa-solid fa-map-location-dot"></i> ${title}`;
    resultsContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12">
            <span class="loader mb-4"></span>
            <p class="text-gray-500 font-medium">Çevrenizdeki yerler aranıyor...</p>
        </div>
    `;
    
    modal.classList.remove('hidden');
    // small delay to allow display:block to apply before transition
    setTimeout(() => {
        modalBackdrop.classList.remove('opacity-0');
        modalContent.classList.remove('translate-y-full');
    }, 10);
}

function closeModal() {
    modalBackdrop.classList.add('opacity-0');
    modalContent.classList.add('translate-y-full');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

closeModalBtn.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);

// Geolocation
function getLocation() {
    locationText.innerText = "Konum aranıyor (GPS)...";
    locationPing.style.display = 'block';
    
    if (navigator.geolocation) {
        // 1. Önce Yüksek Doğrulukla (GPS) aramayı deneyelim
        navigator.geolocation.getCurrentPosition(
            (position) => handlePositionSuccess(position),
            (error) => {
                console.warn("GPS konumu başarısız:", error.message);
                
                if (error.code === error.PERMISSION_DENIED) {
                    alert("Konum izni reddedildi. Doğru sonuçlar için tarayıcı ayarlarından (adres çubuğundaki kilit simgesinden) izin verip sayfayı yenileyin.");
                    locationPing.style.display = 'none';
                    locationText.innerText = "Konum izni reddedildi";
                    return;
                }
                
                // 2. GPS zaman aşımına uğrarsa (telefonlarda çok sık olur), 
                // hücresel ağ/wifi (baz istasyonu) ile daha düşük doğrulukta ama hızlı bir arama yapalım.
                locationText.innerText = "Ağ konumu aranıyor...";
                navigator.geolocation.getCurrentPosition(
                    (pos) => handlePositionSuccess(pos),
                    (err) => {
                        console.error("İkinci konum denemesi de başarısız:", err.message);
                        locationPing.style.display = 'none';
                        locationText.innerText = "Bulunamadı (Tıklayıp elle girin)";
                        // DİKKAT: Ankara/Samsun gibi yanlış şehirlere atanmaması için otomatik IP fallback işlemini kaldırdık.
                        // Kullanıcının yenile butonuna basarak tekrar GPS/Ağ araması yapması daha güvenli.
                    },
                    { enableHighAccuracy: false, timeout: 15000, maximumAge: 1800000 } // 30 mins cache
                );
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 } // 5 mins cache
        );
    } else {
        getIpLocationFallback();
    }
}

function handlePositionSuccess(position) {
    userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
    };
    reverseGeocode(userLocation.lat, userLocation.lng);
}

async function getIpLocationFallback() {
    locationText.innerText = "Ağ üzerinden konum aranıyor...";
    try {
        const response = await fetch('https://get.geojs.io/v1/ip/geo.json');
        const data = await response.json();
        
        if (data && data.latitude && data.longitude) {
            userLocation = {
                lat: parseFloat(data.latitude),
                lng: parseFloat(data.longitude)
            };
            currentAddress = `${data.city || 'Bilinmeyen Şehir'}, ${data.region || ''}`;
            locationText.innerText = currentAddress + " (Tahmini)";
            
            // Eğer daha önce uyarılmadıysa kullanıcıyı uyaralım (sayfa her yenilendiğinde tekrar çıkabilir, bu yüzden isterseniz localStorage ile de sınırlandırılabilir, ancak şimdilik net bilgi vermek için doğrudan alert veriyoruz)
            alert("Cihazınızın tam GPS konumu alınamadı (İzin verilmemiş veya sinyal zayıf). İnternet sağlayıcınızın merkezi baz alınarak tahmini bir ağ konumu gösteriliyor. Sonuçlar yaşadığınız şehirden farklı (Örn: Ankara, Samsun vb.) olabilir.");
            
            // Get better address translation if possible, but save API limits
            reverseGeocode(userLocation.lat, userLocation.lng, true); 
        } else {
            throw new Error("Ağ verisi geçersiz");
        }
    } catch (error) {
        console.error("IP Konum hatası:", error);
        locationPing.style.display = 'none';
        locationText.innerText = "Konum otomatik bulunamadı.";
    }
}

async function reverseGeocode(lat, lng, isFallback = false) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
            headers: {
                'Accept-Language': 'tr'
            }
        });
        const data = await response.json();
        
        if (data && data.address) {
            const addr = data.address;
            currentAddress = data.display_name;
            const shortAddress = [addr.road, addr.suburb, addr.city || addr.town || addr.village]
                .filter(Boolean)
                .join(', ');
                
            locationText.innerText = (shortAddress || currentAddress) + (isFallback ? " (Tahmini Ağ Konumu)" : "");
        } else {
            locationText.innerText = `${lat.toFixed(4)}, ${lng.toFixed(4)}` + (isFallback ? " (Tahmini Ağ Konumu)" : "");
        }
    } catch (error) {
        console.error("Reverse geocoding error:", error);
        locationText.innerText = `${lat.toFixed(4)}, ${lng.toFixed(4)}` + (isFallback ? " (Tahmini Ağ Konumu)" : "");
    } finally {
        locationPing.style.display = 'none';
    }
}

// Manual Location Search
function manualLocationPrompt() {
    const query = prompt("Otomatik konumda sorun yaşıyorsanız:\nLütfen bulunduğunuz semti, ilçeyi veya şehri yazın (Örn: Kadıköy, İstanbul veya Merkez, Tokat):");
    if (query && query.trim() !== "") {
        searchLocationByText(query.trim());
    }
}

async function searchLocationByText(query) {
    locationText.innerText = "Konum aranıyor...";
    locationPing.style.display = 'block';
    
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Türkiye')}&limit=1`, {
            headers: {
                'Accept-Language': 'tr'
            }
        });
        const data = await response.json();
        
        if (data && data.length > 0) {
            userLocation = {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon)
            };
            
            currentAddress = data[0].display_name;
            const nameParts = currentAddress.split(',');
            // Show first two parts
            locationText.innerText = (nameParts[0] + (nameParts[1] ? "," + nameParts[1] : "")) + " (Manuel)";
        } else {
            alert("Girdiğiniz konum bulunamadı. Lütfen daha bilindik bir ilçe/il adı girin.");
            locationText.innerText = "Bulunamadı (Tıklayıp girin)";
        }
    } catch (error) {
        console.error("Manuel konum arama hatası:", error);
        locationText.innerText = "Arama hatası";
    } finally {
        locationPing.style.display = 'none';
    }
}

// Overpass API
async function fetchOverpassData(type, isDuty) {
    // Determine the query
    let queryTag = "";
    const radius = 15000; // 15km radius
    
    switch(type) {
        case 'pharmacy':
            queryTag = '["amenity"="pharmacy"]';
            break;
        case 'atm':
            queryTag = '["amenity"="atm"]';
            break;
        case 'hospital':
            queryTag = '["amenity"="hospital"]';
            break;
        case 'supermarket':
            queryTag = '["shop"~"supermarket|convenience"]';
            break;
        case 'fuel':
            queryTag = '["amenity"="fuel"]';
            break;
        case 'parking':
            queryTag = '["amenity"="parking"]';
            break;
        case 'hotel':
            queryTag = '["tourism"="hotel"]';
            break;
        case 'post_office':
            queryTag = '["amenity"="post_office"]';
            break;
        case 'assembly_point':
            queryTag = '["emergency"="assembly_point"]';
            break;
        case 'police':
            queryTag = '["amenity"="police"]';
            break;
        case 'fire_station':
            queryTag = '["amenity"="fire_station"]';
            break;
        default:
            queryTag = `["amenity"="${type}"]`;
    }

    // if duty pharmacy, we just query pharmacies and show a warning, 
    // or try opening_hours=24/7 if we want to be strict.
    // Given the limits of OpenStreetMap for Turkish duty pharmacies, we query all pharmacies.
    
    let queryBody = "";
    if (type === 'atm') {
        // ATM'ler için hem müstakil ATM'leri hem de ATM'si olan bankaları arıyoruz
        queryBody = `
          node["amenity"="atm"](around:${radius},${userLocation.lat},${userLocation.lng});
          way["amenity"="atm"](around:${radius},${userLocation.lat},${userLocation.lng});
          node["amenity"="bank"]["atm"="yes"](around:${radius},${userLocation.lat},${userLocation.lng});
          way["amenity"="bank"]["atm"="yes"](around:${radius},${userLocation.lat},${userLocation.lng});
        `;
    } else {
        queryBody = `
          node${queryTag}(around:${radius},${userLocation.lat},${userLocation.lng});
          way${queryTag}(around:${radius},${userLocation.lat},${userLocation.lng});
        `;
    }

    const query = `
        [out:json][timeout:25];
        (
${queryBody}
        );
        out center;
    `;

    try {
        const endpoints = [
        'https://overpass-api.de/api/interpreter',
        'https://lz4.overpass-api.de/api/interpreter',
        'https://z.overpass-api.de/api/interpreter'
    ];

    let data = null;
    let lastError = null;

    for (const endpoint of endpoints) {
        try {
            const overpassUrl = `${endpoint}?data=${encodeURIComponent(query)}`;
            const response = await fetch(overpassUrl);
            
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errText.substring(0, 50)}...`);
            }
            
            data = await response.json();
            break; // Başarılı olursa döngüden çık
        } catch (error) {
            console.warn(`Endpoint failed: ${endpoint}`, error);
            lastError = error;
        }
    }

    if (!data) {
        throw lastError || new Error("Tüm sunucular başarısız oldu.");
    }

    renderResults(data.elements, type, isDuty);
    } catch (error) {
        console.error("Overpass error:", error);
        resultsContainer.innerHTML = `
            <div class="text-center text-red-500 py-8 px-4">
                <i class="fa-solid fa-circle-exclamation text-3xl mb-3"></i>
                <p class="font-bold">Sunucuya bağlanılamadı.</p>
                <p class="text-xs mt-3 text-red-600 break-words border border-red-200 bg-red-50 p-2 rounded">Hata detayı: ${error.message === 'Failed to fetch' ? 'Tarayıcı engelledi veya bağlantı yok (Failed to fetch)' : error.message}</p>
                <p class="text-sm mt-3 text-gray-500">Güvenlik ayarları veya reklam engelleyiciniz engelliyor olabilir.</p>
            </div>
        `;
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2-lat1);
    const dLon = deg2rad(lon2-lon1); 
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
      ; 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI/180);
}

function renderResults(elements, type, isDuty) {
    if (!elements || elements.length === 0) {
        resultsContainer.innerHTML = `
            <div class="text-center text-gray-400 py-10">
                <i class="fa-solid fa-folder-open text-4xl mb-4 text-gray-300"></i>
                <p class="font-medium">Yakınınızda sonuç bulunamadı (15km yarıçap).</p>
            </div>
        `;
        return;
    }

    // Parse and sort by distance
    const results = elements.map(el => {
        const lat = el.lat || el.center.lat;
        const lon = el.lon || el.center.lon;
        const distance = calculateDistance(userLocation.lat, userLocation.lng, lat, lon);
        const name = el.tags?.name || (isDuty ? 'Eczane' : 'İsimsiz Yer');
        return { ...el, lat, lon, distance, name };
    }).sort((a, b) => a.distance - b.distance);

    let html = '';
    
    if (isDuty) {
        html += `
            <div class="bg-blue-50 border border-blue-100 text-blue-600 text-sm rounded-xl p-3 mb-4 flex gap-3">
                <i class="fa-solid fa-circle-info mt-0.5 shrink-0"></i>
                <p>Harita verileri anlık nöbetçi eczaneleri garanti etmeyebilir. Çevrenizdeki eczaneler listelenmektedir.</p>
            </div>
        `;
    }

    results.forEach(res => {
        const distStr = res.distance < 1 ? `${Math.round(res.distance * 1000)}m` : `${res.distance.toFixed(1)}km`;
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${res.lat},${res.lon}`;
        
        let extraInfo = '';
        if (res.tags?.opening_hours) {
            extraInfo += `<span class="inline-block bg-gray-100 text-[11px] px-2 py-1 rounded-md text-gray-600 font-medium mr-2"><i class="fa-regular fa-clock"></i> ${res.tags.opening_hours}</span>`;
        }
        if (res.tags?.phone) {
            extraInfo += `<a href="tel:${res.tags.phone}" class="inline-block bg-green-50 text-[11px] px-2 py-1 rounded-md text-green-700 font-medium mr-2"><i class="fa-solid fa-phone"></i> ${res.tags.phone}</a>`;
        }

        html += `
            <div class="bg-white border border-gray-200 rounded-2xl p-4 mb-3 shadow-sm flex flex-col gap-2">
                <div class="flex justify-between items-start gap-2">
                    <h4 class="font-bold text-gray-800 leading-tight">${res.name}</h4>
                    <span class="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-lg whitespace-nowrap">${distStr}</span>
                </div>
                ${extraInfo ? `<div class="mt-1">${extraInfo}</div>` : ''}
                <div class="mt-2 flex justify-end">
                    <a href="${mapsUrl}" target="_blank" class="bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold py-2 px-4 rounded-xl transition-colors flex items-center gap-2 shadow-sm">
                        <i class="fa-solid fa-location-arrow"></i> Yol Tarifi
                    </a>
                </div>
            </div>
        `;
    });

    resultsContainer.innerHTML = html;
}

// Feedback Modal & Toast Logic
const btnBildir = document.getElementById('btn-bildir');
const feedbackModal = document.getElementById('feedback-modal');
const feedbackBackdrop = document.getElementById('feedback-backdrop');
const feedbackContent = document.getElementById('feedback-content');
const closeFeedbackBtn = document.getElementById('close-feedback');
const submitFeedbackBtn = document.getElementById('btn-submit-feedback');
const feedbackText = document.getElementById('feedback-text');
const toast = document.getElementById('toast');

function openFeedbackModal() {
    feedbackModal.classList.remove('hidden');
    setTimeout(() => {
        feedbackBackdrop.classList.remove('opacity-0');
        feedbackContent.classList.remove('opacity-0', 'scale-95');
        feedbackContent.classList.add('opacity-100', 'scale-100');
    }, 10);
}

function closeFeedbackModal() {
    feedbackBackdrop.classList.add('opacity-0');
    feedbackContent.classList.remove('opacity-100', 'scale-100');
    feedbackContent.classList.add('opacity-0', 'scale-95');
    setTimeout(() => {
        feedbackModal.classList.add('hidden');
    }, 300);
}

function showToast() {
    toast.classList.remove('-translate-y-16', 'opacity-0');
    toast.classList.add('translate-y-4', 'opacity-100');
    setTimeout(() => {
        toast.classList.remove('translate-y-4', 'opacity-100');
        toast.classList.add('-translate-y-16', 'opacity-0');
    }, 3000);
}

btnBildir.addEventListener('click', openFeedbackModal);
closeFeedbackBtn.addEventListener('click', closeFeedbackModal);
feedbackBackdrop.addEventListener('click', closeFeedbackModal);

submitFeedbackBtn.addEventListener('click', () => {
    const text = feedbackText.value.trim();
    if (!text) {
        alert("Lütfen göndermeden önce bir mesaj yazın.");
        return;
    }
    
    // Create mailto link
    const email = "ertugrultokgoz25@gmail.com";
    const subject = encodeURIComponent("Konum Asistanı Geri Bildirim");
    const body = encodeURIComponent(text);
    const mailtoUrl = `mailto:${email}?subject=${subject}&body=${body}`;
    
    // Open default mail client
    window.location.href = mailtoUrl;
    
    // Clean up and show success
    feedbackText.value = "";
    closeFeedbackModal();
    
    // Small delay before showing toast to ensure it's visible after modal closes
    setTimeout(() => {
        showToast();
    }, 300);
});
