// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js');
    });
}

let userLocation = null;
let currentAddress = "";

// Tüm kodları sayfa yüklendikten sonra çalışacak şekilde sarmalıyoruz (Beyaz ekranı önlemek için)
window.onload = () => {
    console.log("Uygulama başlatılıyor...");

    // Elementleri bul
    const locText = document.getElementById('location-text');
    const locPing = document.getElementById('location-ping');
    const modal = document.getElementById('results-modal');
    const resContainer = document.getElementById('results-container');
    const mTitle = document.getElementById('modal-title');

    // 1. Konumu Başlat
    getLocation();

    // 2. Kategori Tıklamaları
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.duty === 'true') {
                window.open('https://www.eczaneler.gen.tr/', '_blank');
                return;
            }
            if (!userLocation) {
                alert("Konum aranıyor, lütfen bekleyin...");
                return;
            }
            const type = btn.dataset.type;
            const title = btn.querySelector('span').innerText;
            mTitle.innerHTML = `<i class="fa-solid fa-map-location-dot"></i> ${title}`;
            resContainer.innerHTML = '<div class="py-10 text-center"><span class="loader"></span></div>';
            modal.classList.remove('hidden');
            fetchData(type);
        });
    });

    // 3. Konum Bulma Fonksiyonu
    function getLocation() {
        if (!locText) return;
        locText.innerText = "Konum aranıyor (GPS)...";
        if (locPing) locPing.style.display = 'block';

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    reverseGeocode(userLocation.lat, userLocation.lng);
                },
                (err) => {
                    console.warn("GPS hatası, IP'ye geçiliyor:", err.message);
                    fetch('https://get.geojs.io/v1/ip/geo.json')
                        .then(r => r.json())
                        .then(data => {
                            userLocation = { lat: parseFloat(data.latitude), lng: parseFloat(data.longitude) };
                            reverseGeocode(userLocation.lat, userLocation.lng, true);
                        })
                        .catch(() => {
                            locText.innerText = "Konum bulunamadı";
                            if (locPing) locPing.style.display = 'none';
                        });
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        }
    }

    async function reverseGeocode(lat, lng, isFallback = false) {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
                headers: { 'Accept-Language': 'tr' }
            });
            const data = await res.json();
            if (data && data.address) {
                const addr = data.address;
                const short = [addr.road, addr.suburb, addr.city || addr.town].filter(Boolean).join(', ');
                locText.innerText = (short || "Konum Belirlendi") + (isFallback ? " (Tahmini)" : "");
            }
        } catch (e) {
            locText.innerText = `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
        } finally {
            if (locPing) locPing.style.display = 'none';
        }
    }

    async function fetchData(type) {
        const radius = 15000;
        let tags = `["amenity"="${type}"]`;
        if (type === 'supermarket') tags = '["shop"~"supermarket|convenience"]';
        if (type === 'restaurant') tags = '["amenity"~"restaurant|cafe"]';
        if (type === 'tourism') tags = '["tourism"~"attraction|museum"]';

        const query = `[out:json][timeout:25];(node${tags}(around:${radius},${userLocation.lat},${userLocation.lng});way${tags}(around:${radius},${userLocation.lat},${userLocation.lng}););out center;`;
        try {
            const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
            const data = await res.json();
            renderResults(data.elements);
        } catch (e) {
            resContainer.innerHTML = '<p class="text-center p-4">Hata oluştu.</p>';
        }
    }

    function renderResults(elements) {
        if (!elements || elements.length === 0) {
            resContainer.innerHTML = '<p class="text-center p-10">Sonuç bulunamadı.</p>';
            return;
        }
        let html = '';
        elements.forEach(el => {
            const name = el.tags?.name || "İsimsiz Yer";
            const lat = el.lat || el.center.lat;
            const lon = el.lon || el.center.lon;
            html += `<div class="bg-white border border-gray-200 rounded-2xl p-4 mb-3 shadow-sm flex justify-between items-center"><h4 class="font-bold text-gray-800 text-sm">${name}</h4><a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}" target="_blank" class="bg-blue-500 text-white text-[10px] font-bold py-2 px-3 rounded-xl">Tarif</a></div>`;
        });
        resContainer.innerHTML = html;
    }

    // Modal Kapatma
    document.getElementById('close-modal').onclick = () => modal.classList.add('hidden');
    document.getElementById('modal-backdrop').onclick = () => modal.classList.add('hidden');

    // Paylaşım ve Diğerleri
    const btnSms = document.getElementById('btn-sms-location');
    if (btnSms) {
        btnSms.onclick = () => {
            if (!userLocation) return;
            window.open(`sms:?body=${encodeURIComponent("Konumum: https://www.google.com/maps?q=" + userLocation.lat + "," + userLocation.lng)}`);
        };
    }

    const btnShare = document.getElementById('btn-share-location');
    if (btnShare) {
        btnShare.onclick = () => {
            if (!userLocation) return;
            window.open(`https://wa.me/?text=${encodeURIComponent("Konumum: https://www.google.com/maps?q=" + userLocation.lat + "," + userLocation.lng)}`);
        };
    }

    // Manuel Konum
    locText.onclick = manualPrompt;
    const btnEdit = document.getElementById('edit-location');
    if (btnEdit) btnEdit.onclick = manualPrompt;

    const btnRefresh = document.getElementById('refresh-location');
    if (btnRefresh) btnRefresh.onclick = getLocation;

    function manualPrompt() {
        const q = prompt("Semt/İlçe girin:");
        if (q) {
            locText.innerText = "Aranıyor...";
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q + ', Türkiye')}&limit=1`)
                .then(r => r.json()).then(d => {
                    if (d.length > 0) {
                        userLocation = { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
                        locText.innerText = q + " (Manuel)";
                        if (locPing) locPing.style.display = 'none';
                    }
                });
        }
    }
};

// Mod Değiştirme (Global Kapsamda Olmalı)
window.handleModeSwitch = function (btn, mode) {
    const modeBtns = document.querySelectorAll('.mode-btn');
    modeBtns.forEach(b => b.classList.remove('active-mode'));
    btn.classList.add('active-mode');

    const eActions = document.getElementById('emergency-actions');
    const sActions = document.getElementById('standard-actions');
    const catBtns = document.querySelectorAll('.category-btn');
    const body = document.body;

    body.classList.remove('emergency-mode');
    if (eActions) eActions.classList.add('hidden');
    if (sActions) sActions.classList.remove('hidden');
    catBtns.forEach(b => { b.classList.remove('hidden'); b.style.order = "0"; });

    if (mode === 'emergency') {
        body.classList.add('emergency-mode');
        if (eActions) eActions.classList.remove('hidden');
        if (sActions) sActions.classList.add('hidden');
        catBtns.forEach(b => {
            const type = b.dataset.type;
            const isDuty = b.dataset.duty === 'true';
            if (type === 'hospital' || type === 'police' || type === 'assembly_point' || (type === 'pharmacy' && isDuty)) {
                b.classList.remove('hidden');
            } else {
                b.classList.add('hidden');
            }
        });
    } else if (mode === 'tourist') {
        const touristOrder = ['tourism', 'hotel', 'restaurant', 'taxi', 'pharmacy', 'post_office', 'atm'];
        catBtns.forEach(b => {
            const index = touristOrder.indexOf(b.dataset.type);
            b.style.order = index !== -1 ? index + 1 : "99";
        });
    }
};
if (elements.length === 0) {
    container.innerHTML = '<div class="text-center p-12 text-gray-500"><i class="fa-solid fa-face-frown text-4xl mb-4"></i><p>Yakınınızda sonuç bulunamadı.</p></div>';
    return;
}

let html = '';
elements.forEach(el => {
    const name = el.tags?.name || "İsimsiz Yer";
    const lat = el.lat || el.center.lat;
    const lon = el.lon || el.center.lon;
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;

    html += `
            <div class="bg-white border border-gray-100 rounded-2xl p-4 mb-3 shadow-sm flex justify-between items-center animate-fadeIn">
                <div class="flex flex-col">
                    <h4 class="font-bold text-gray-800 text-sm mb-1">${name}</h4>
                    <span class="text-[10px] text-gray-400 font-medium"><i class="fa-solid fa-map-pin mr-1"></i> OSM Verisi</span>
                </div>
                <a href="${mapsUrl}" target="_blank" class="bg-blue-600 text-white text-[10px] font-bold py-2 px-4 rounded-xl shadow-md active:scale-95 transition-transform">Tarif</a>
            </div>
        `;
});
container.innerHTML = html;
}

// 5. Mod ve Diğer İşlemler
window.handleModeSwitch = function (btn, mode) {
    const modeBtns = document.querySelectorAll('.mode-btn');
    modeBtns.forEach(b => b.classList.remove('active-mode'));
    btn.classList.add('active-mode');

    const body = document.body;
    body.classList.remove('emergency-mode');
    document.getElementById('emergency-actions').classList.add('hidden');
    document.getElementById('standard-actions').classList.remove('hidden');
    document.querySelectorAll('.category-btn').forEach(b => {
        b.classList.remove('hidden');
        b.style.order = "0";
    });

    if (mode === 'emergency') {
        body.classList.add('emergency-mode');
        document.getElementById('emergency-actions').classList.remove('hidden');
        document.getElementById('standard-actions').classList.add('hidden');
        document.querySelectorAll('.category-btn').forEach(b => {
            const type = b.dataset.type;
            const isDuty = b.dataset.duty === 'true';
            if (['hospital', 'police', 'assembly_point'].includes(type) || (type === 'pharmacy' && isDuty)) {
                b.classList.remove('hidden');
            } else {
                b.classList.add('hidden');
            }
        });
    } else if (mode === 'tourist') {
        const touristOrder = ['tourism', 'hotel', 'restaurant', 'taxi', 'pharmacy', 'post_office', 'atm'];
        document.querySelectorAll('.category-btn').forEach(b => {
            const idx = touristOrder.indexOf(b.dataset.type);
            b.style.order = idx !== -1 ? idx + 1 : "99";
        });
    }
};

// Modal Kapatma
document.getElementById('close-modal').onclick = () => document.getElementById('results-modal').classList.add('hidden');
document.getElementById('modal-backdrop').onclick = () => document.getElementById('results-modal').classList.add('hidden');

// Konum Paylaşım (SMS & WhatsApp)
document.getElementById('btn-sms-location').onclick = () => {
    if (!userLocation) return;
    window.open(`sms:?body=${encodeURIComponent("Acil Durum! Konumum: https://www.google.com/maps?q=" + userLocation.lat + "," + userLocation.lng)}`);
};
document.getElementById('btn-share-location').onclick = () => {
    if (!userLocation) return;
    window.open(`https://wa.me/?text=${encodeURIComponent("Güncel Konumum: https://www.google.com/maps?q=" + userLocation.lat + "," + userLocation.lng)}`);
};

document.getElementById('refresh-location').onclick = getLocation;
document.getElementById('location-text').onclick = () => {
    const q = prompt("Semt veya ilçe girin:");
    if (q) {
        document.getElementById('location-text').innerText = "Aranıyor...";
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q + ', Türkiye')}&limit=1`)
            .then(r => r.json()).then(d => {
                if (d.length > 0) {
                    userLocation = { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
                    document.getElementById('location-text').innerText = q + " (Manuel)";
                }
            });
    }
};
document.getElementById('btn-bildir').onclick = () => window.location.href = "mailto:ertugrultokgoz25@gmail.com";
