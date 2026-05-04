// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js');
    });
}

// Global Variables
let userLocation = null;
let currentAddress = "";

// Element Selectors
const locationText = () => document.getElementById('location-text');
const locationPing = () => document.getElementById('location-ping');
const categoryGrid = () => document.getElementById('category-grid');
const emergencyActions = () => document.getElementById('emergency-actions');
const standardActions = () => document.getElementById('standard-actions');
const modal = document.getElementById('results-modal');
const resultsContainer = document.getElementById('results-container');
const modalTitle = document.getElementById('modal-title');

// 1. Initialize
window.onload = () => {
    getLocation();
    // Otomatik gece modu devre dışı (Yazıların soluklaşmaması için)
};

// 2. Mode Switching Logic
window.handleModeSwitch = function(btn, mode) {
    console.log("Mod Değişti:", mode);
    const modeBtns = document.querySelectorAll('.mode-btn');
    modeBtns.forEach(b => b.classList.remove('active-mode'));
    btn.classList.add('active-mode');
    
    const body = document.body;
    const grid = categoryGrid();
    const eActions = emergencyActions();
    const sActions = standardActions();
    const catBtns = document.querySelectorAll('.category-btn');

    body.classList.remove('emergency-mode');
    eActions.classList.add('hidden');
    sActions.classList.remove('hidden');
    catBtns.forEach(b => { b.classList.remove('hidden'); b.style.order = "0"; });

    if (mode === 'emergency') {
        body.classList.add('emergency-mode');
        eActions.classList.remove('hidden');
        sActions.classList.add('hidden');
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

// 3. Geolocation Logic
function getLocation() {
    const textEl = locationText();
    const pingEl = locationPing();
    if (!textEl) return;

    textEl.innerText = "Konum aranıyor...";
    pingEl.style.display = 'block';

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                reverseGeocode(userLocation.lat, userLocation.lng);
            },
            (err) => {
                console.error("GPS Hatası:", err);
                textEl.innerText = "Konum bulunamadı (Tıklayın)";
                pingEl.style.display = 'none';
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }
}

async function reverseGeocode(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
            headers: { 'Accept-Language': 'tr' }
        });
        const data = await response.json();
        if (data && data.address) {
            const addr = data.address;
            currentAddress = data.display_name;
            const short = [addr.road, addr.suburb, addr.city || addr.town].filter(Boolean).join(', ');
            locationText().innerText = short || "Konum Belirlendi";
        }
    } catch (e) {
        locationText().innerText = `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
    } finally {
        locationPing().style.display = 'none';
    }
}

// 4. Manual Location Prompt
function manualLocationPrompt() {
    const query = prompt("Bulunduğunuz semt veya ilçeyi yazın:");
    if (query) {
        locationText().innerText = "Aranıyor...";
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Türkiye')}&limit=1`)
            .then(r => r.json())
            .then(data => {
                if (data.length > 0) {
                    userLocation = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
                    locationText().innerText = query + " (Manuel)";
                    locationPing().style.display = 'none';
                }
            });
    }
}

// 5. Category Clicks
document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const isDuty = btn.dataset.duty === 'true';
        if (isDuty) { window.open('https://www.eczaneler.gen.tr/', '_blank'); return; }
        if (!userLocation) { alert("Lütfen konumun bulunmasını bekleyin."); return; }
        
        const type = btn.dataset.type;
        const title = btn.querySelector('span').innerText;
        
        modalTitle.innerHTML = `<i class="fa-solid fa-map-location-dot"></i> ${title}`;
        resultsContainer.innerHTML = '<div class="py-10 text-center"><span class="loader"></span></div>';
        modal.classList.remove('hidden');
        
        fetchOverpassData(type);
    });
});

async function fetchOverpassData(type) {
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
        resultsContainer.innerHTML = '<p class="text-center text-red-500 p-4">Veri çekilemedi.</p>';
    }
}

function renderResults(elements) {
    if (!elements || elements.length === 0) {
        resultsContainer.innerHTML = '<p class="text-center p-10 text-gray-500">Sonuç bulunamadı.</p>';
        return;
    }
    
    let html = '';
    elements.forEach(el => {
        const name = el.tags?.name || "İsimsiz Yer";
        const lat = el.lat || el.center.lat;
        const lon = el.lon || el.center.lon;
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
        
        html += `
            <div class="bg-white border border-gray-200 rounded-2xl p-4 mb-3 shadow-sm">
                <h4 class="font-bold text-gray-800 mb-2">${name}</h4>
                <div class="flex justify-end">
                    <a href="${mapsUrl}" target="_blank" class="bg-blue-500 text-white text-xs font-bold py-2 px-4 rounded-xl">Yol Tarifi</a>
                </div>
            </div>
        `;
    });
    resultsContainer.innerHTML = html;
}

// Modal Close
document.getElementById('close-modal').onclick = () => modal.classList.add('hidden');
document.getElementById('modal-backdrop').onclick = () => modal.classList.add('hidden');

// SMS & WhatsApp
document.getElementById('btn-sms-location').onclick = () => {
    if (!userLocation) return;
    const text = `Acil Konumum: https://www.google.com/maps?q=${userLocation.lat},${userLocation.lng}`;
    window.open(`sms:?body=${encodeURIComponent(text)}`);
};

document.getElementById('btn-share-location').onclick = () => {
    if (!userLocation) return;
    const text = `Konumum: https://www.google.com/maps?q=${userLocation.lat},${userLocation.lng}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
};

// Events for location text
document.getElementById('location-text').onclick = manualLocationPrompt;
document.getElementById('edit-location').onclick = manualLocationPrompt;
document.getElementById('refresh-location').onclick = getLocation;
document.getElementById('btn-bildir').onclick = () => window.location.href = "mailto:ertugrultokgoz25@gmail.com";
