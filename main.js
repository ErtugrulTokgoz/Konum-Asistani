// Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(console.error);
}

// Global Durum
let userLocation = null;

// Sayfa Hazır
window.onload = function() {
    getLocation();
};

// KONUM BULMA
function getLocation() {
    var locText = document.getElementById('location-text');
    if (!locText) return;
    locText.innerText = 'Konum aranıyor...';

    if (!navigator.geolocation) {
        locText.innerText = 'Konum desteklenmiyor';
        return;
    }

    navigator.geolocation.getCurrentPosition(
        function(pos) {
            userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            getAddress(userLocation.lat, userLocation.lng);
        },
        function(err) {
            // GPS başarısız, IP ile dene
            fetch('https://get.geojs.io/v1/ip/geo.json')
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (data && data.latitude) {
                        userLocation = { lat: parseFloat(data.latitude), lng: parseFloat(data.longitude) };
                        locText.innerText = (data.city || 'Tahmini Konum') + ' (Ağ)';
                    } else {
                        locText.innerText = 'Konum alınamadı (Tıkla)';
                    }
                })
                .catch(function() {
                    locText.innerText = 'Konum alınamadı (Tıkla)';
                });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
}

function getAddress(lat, lng) {
    fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&zoom=18&addressdetails=1', {
        headers: { 'Accept-Language': 'tr' }
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        var locText = document.getElementById('location-text');
        if (data && data.address) {
            var addr = data.address;
            var parts = [addr.road, addr.suburb, addr.city || addr.town].filter(Boolean);
            locText.innerText = parts.join(', ') || 'Konum Alındı';
        }
    })
    .catch(function() {
        document.getElementById('location-text').innerText = lat.toFixed(3) + ', ' + lng.toFixed(3);
    });
}

// MANUEL KONUM
function manualLocationPrompt() {
    var q = prompt('Bulunduğunuz ilçe veya semt:');
    if (!q) return;
    var locText = document.getElementById('location-text');
    locText.innerText = 'Aranıyor...';
    fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(q + ', Türkiye') + '&limit=1')
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (d && d.length > 0) {
                userLocation = { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
                locText.innerText = q + ' (Manuel)';
            } else {
                alert('Konum bulunamadı.');
                locText.innerText = 'Bulunamadı (Tekrar tıkla)';
            }
        });
}

// KATEGORİ ARAMA - Her buton bu fonksiyonu çağırıyor
function searchCategory(type, isDuty) {
    // Nöbetçi eczane özel durumu
    if (isDuty) {
        window.open('https://www.eczaneler.gen.tr/', '_blank');
        return;
    }

    // Konum var mı kontrol et
    if (!userLocation) {
        alert('Konum henüz belirlenmedi. Lütfen bekleyin veya konumu manuel girin.');
        return;
    }

    var modal = document.getElementById('results-modal');
    var container = document.getElementById('results-container');
    var title = document.getElementById('modal-title');

    // Modal başlığını güncelle
    var labels = {
        'atm': 'En Yakın ATM',
        'hospital': 'En Yakın Hastaneler',
        'restaurant': 'Cafe & Restoranlar',
        'supermarket': 'En Yakın Marketler',
        'fuel': 'En Yakın Benzinlikler',
        'clothes': 'Giyim Mağazaları',
        'parking': 'En Yakın Otoparklar',
        'taxi': 'Taksi Durakları',
        'tourism': 'Turistik Yerler',
        'hotel': 'En Yakın Oteller',
        'post_office': 'Kargo Şubeleri',
        'assembly_point': 'Toplanma Alanları',
        'police': 'Polis Merkezi',
        'pharmacy': 'En Yakın Eczaneler'
    };

    title.innerHTML = '<i class="fa-solid fa-map-location-dot" style="color:#3b82f6;"></i> ' + (labels[type] || type);
    container.innerHTML = '<div style="padding:40px; text-align:center;"><span class="loader"></span><p style="color:#6b7280; margin-top:12px;">Aranıyor...</p></div>';
    modal.style.display = 'flex';

    // Overpass sorgu oluştur
    var radius = 15000;
    var queryBody = '';

    switch(type) {
        case 'atm':
            queryBody = 'node["amenity"="atm"](around:' + radius + ',' + userLocation.lat + ',' + userLocation.lng + ');node["amenity"="bank"]["atm"="yes"](around:' + radius + ',' + userLocation.lat + ',' + userLocation.lng + ');';
            break;
        case 'restaurant':
            queryBody = 'node["amenity"~"restaurant|cafe|fast_food"](around:' + radius + ',' + userLocation.lat + ',' + userLocation.lng + ');';
            break;
        case 'supermarket':
            queryBody = 'node["shop"~"supermarket|convenience"](around:' + radius + ',' + userLocation.lat + ',' + userLocation.lng + ');';
            break;
        case 'clothes':
            queryBody = 'node["shop"="clothes"](around:' + radius + ',' + userLocation.lat + ',' + userLocation.lng + ');';
            break;
        case 'tourism':
            queryBody = 'node["tourism"~"attraction|museum|viewpoint"](around:' + radius + ',' + userLocation.lat + ',' + userLocation.lng + ');';
            break;
        case 'hotel':
            queryBody = 'node["tourism"="hotel"](around:' + radius + ',' + userLocation.lat + ',' + userLocation.lng + ');';
            break;
        case 'post_office':
            queryBody = 'node["amenity"="post_office"](around:' + radius + ',' + userLocation.lat + ',' + userLocation.lng + ');';
            break;
        case 'assembly_point':
            queryBody = 'node["emergency"="assembly_point"](around:' + radius + ',' + userLocation.lat + ',' + userLocation.lng + ');';
            break;
        default:
            queryBody = 'node["amenity"="' + type + '"](around:' + radius + ',' + userLocation.lat + ',' + userLocation.lng + ');';
    }

    var query = '[out:json][timeout:25];(' + queryBody + ');out center;';

    fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query))
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var elements = data.elements || [];
            if (elements.length === 0) {
                container.innerHTML = '<p style="text-align:center; padding:40px; color:#9ca3af;">Yakınınızda sonuç bulunamadı.</p>';
                return;
            }
            var html = '';
            elements.forEach(function(el) {
                var name = (el.tags && el.tags.name) ? el.tags.name : 'İsimsiz Yer';
                var lat = el.lat || (el.center && el.center.lat);
                var lon = el.lon || (el.center && el.center.lon);
                var mapsUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lon;
                html += '<div style="background:white; border:1px solid #e5e7eb; border-radius:16px; padding:16px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">' +
                    '<span style="font-weight:700; color:#1f2937; font-size:13px; flex:1; margin-right:8px;">' + name + '</span>' +
                    '<a href="' + mapsUrl + '" target="_blank" style="background:#3b82f6; color:white; font-size:11px; font-weight:700; padding:8px 14px; border-radius:10px; text-decoration:none; white-space:nowrap;">Yol Tarifi</a>' +
                    '</div>';
            });
            container.innerHTML = html;
        })
        .catch(function() {
            container.innerHTML = '<p style="text-align:center; padding:40px; color:#ef4444;">Sunucu hatası. Tekrar deneyin.</p>';
        });
}

// MODAL KAPAT
function closeModal() {
    document.getElementById('results-modal').style.display = 'none';
}

// MOD DEĞİŞTİRME
function switchMode(mode, btn) {
    // Aktif buton stilini güncelle
    document.querySelectorAll('.mode-btn').forEach(function(b) {
        b.classList.remove('active-mode');
    });
    if (btn) btn.classList.add('active-mode');

    var emergencyActions = document.getElementById('emergency-actions');
    var standardActions = document.getElementById('standard-actions');
    var catBtns = document.querySelectorAll('.category-btn');
    
    document.body.classList.remove('emergency-mode');
    emergencyActions.style.display = 'none';
    standardActions.style.display = 'flex';
    catBtns.forEach(function(b) {
        b.style.display = 'flex';
        b.style.order = '0';
    });

    if (mode === 'emergency') {
        document.body.classList.add('emergency-mode');
        emergencyActions.style.display = 'flex';
        standardActions.style.display = 'none';
    } else if (mode === 'tourist') {
        var order = ['tourism', 'hotel', 'restaurant', 'taxi', 'pharmacy', 'post_office', 'atm'];
        catBtns.forEach(function(b) {
            var type = b.getAttribute('onclick').match(/'([^']+)'/);
            if (type) {
                var idx = order.indexOf(type[1]);
                b.style.order = idx !== -1 ? idx + 1 : 99;
            }
        });
    }
}

// PAYLAŞIM
function shareLocation() {
    if (!userLocation) { alert('Konum henüz belirlenmedi.'); return; }
    var url = 'https://www.google.com/maps?q=' + userLocation.lat + ',' + userLocation.lng;
    window.open('https://wa.me/?text=' + encodeURIComponent('Güncel konumum: ' + url));
}

function sendSMS() {
    if (!userLocation) { alert('Konum henüz belirlenmedi.'); return; }
    var url = 'https://www.google.com/maps?q=' + userLocation.lat + ',' + userLocation.lng;
    window.open('sms:?body=' + encodeURIComponent('Acil! Konumum: ' + url));
}
