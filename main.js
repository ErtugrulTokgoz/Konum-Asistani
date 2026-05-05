/* ===== YAKИНIMDA NE VAR? - main.js ===== */
'use strict';

// --- Global State ---
var lat = null;
var lng = null;
var currentMode = 'daily';

// --- GERİ BİLDİRİM MODAL ---
function openFeedback() {
    var m = document.getElementById('feedback-modal');
    if (!m) return;
    document.getElementById('fb-message').value = '';
    document.getElementById('fb-topic').value = 'bug';
    m.style.display = 'flex';
}

function closeFeedback() {
    var m = document.getElementById('feedback-modal');
    if (m) m.style.display = 'none';
}

function closeFeedbackIfBackdrop(e) {
    if (e.target === document.getElementById('feedback-modal')) closeFeedback();
}

function submitFeedback() {
    var msg = (document.getElementById('fb-message').value || '').trim();
    var topicEl = document.getElementById('fb-topic');
    var topicLabels = { bug: 'Hata Bildirimi', suggestion: 'Öneri', other: 'Diğer' };
    var topicVal = topicEl ? topicEl.value : 'other';
    var topicText = topicLabels[topicVal] || topicVal;

    if (!msg) {
        alert('Lütfen bir mesaj yazın.');
        return;
    }

    // mailto ile gönder
    var subject = encodeURIComponent('YakınımdaNeVar? - ' + topicText);
    var body = encodeURIComponent('Konu: ' + topicText + '\n\nMesaj:\n' + msg);
    window.location.href = 'mailto:ertugrultokgoz25@gmail.com?subject=' + subject + '&body=' + body;

    closeFeedback();

    // Toast bildirimi
    var toast = document.createElement('div');
    toast.innerText = '✅ Mail uygulaması açıldı!';
    toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#22c55e;color:white;padding:12px 24px;border-radius:999px;font-weight:700;font-size:13px;z-index:9999;box-shadow:0 4px 14px rgba(0,0,0,.2);';
    document.body.appendChild(toast);
    setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 3000);
}


// --- Sayfa Hazır ---
document.addEventListener('DOMContentLoaded', function() {
    // Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js').catch(function(e) {
            console.warn('SW kayıt hatası:', e);
        });
    }

    // Konum al
    startLocation();

    // loc-text tıklaması
    var locEl = document.getElementById('loc-text');
    if (locEl) {
        locEl.addEventListener('click', function() {
            manualLocation();
        });
    }
});

// --- KONUM ALMA ---
function startLocation() {
    setLocText('Konum aranıyor...');
    lat = null; lng = null;

    if (!navigator.geolocation) {
        setLocText('GPS desteklenmiyor (tıkla)');
        return;
    }

    try {
        navigator.geolocation.getCurrentPosition(
            function(pos) {
                lat = pos.coords.latitude;
                lng = pos.coords.longitude;
                reverseGeocode(lat, lng);
            },
            function(err) {
                console.warn('GPS hatası:', err.code, err.message);
                tryIpLocation();
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
        );
    } catch(e) {
        console.error('Geolocation exception:', e);
        tryIpLocation();
    }
}

function tryIpLocation() {
    setLocText('Ağ konumu aranıyor...');
    fetch('https://get.geojs.io/v1/ip/geo.json')
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (d && d.latitude && d.longitude) {
                lat = parseFloat(d.latitude);
                lng = parseFloat(d.longitude);
                setLocText((d.city || 'Tahmini Konum') + ' (Ağ)');
            } else {
                setLocText('Konum alınamadı — tıkla');
            }
        })
        .catch(function() {
            setLocText('Konum alınamadı — tıkla');
        });
}

function reverseGeocode(la, lo) {
    fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + la + '&lon=' + lo + '&zoom=18&addressdetails=1', {
        headers: { 'Accept-Language': 'tr' }
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
        if (d && d.address) {
            var a = d.address;
            var parts = [];
            if (a.road) parts.push(a.road);
            if (a.suburb) parts.push(a.suburb);
            if (a.city || a.town) parts.push(a.city || a.town);
            setLocText(parts.join(', ') || 'Konum Alındı');
        } else {
            setLocText(la.toFixed(3) + ', ' + lo.toFixed(3));
        }
    })
    .catch(function() {
        setLocText(la.toFixed(3) + ', ' + lo.toFixed(3));
    });
}

function setLocText(text) {
    var el = document.getElementById('loc-text');
    if (el) el.innerText = text;
}

function manualLocation() {
    var q = prompt('İlçe veya semt adı girin:');
    if (!q || !q.trim()) return;
    setLocText('Aranıyor...');
    fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(q.trim() + ', Türkiye') + '&limit=1')
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (d && d.length > 0) {
                lat = parseFloat(d[0].lat);
                lng = parseFloat(d[0].lon);
                setLocText(q.trim() + ' (Manuel)');
            } else {
                alert('Konum bulunamadı. Başka bir ad deneyin.');
                setLocText('Konum bulunamadı — tıkla');
            }
        })
        .catch(function() { setLocText('Hata — tekrar dene'); });
}

// --- KATEGORİ BUTON TIKLAMA ---
function catClick(type, isDuty) {
    console.log('catClick:', type, isDuty);

    // Nöbetçi eczane → dış link
    if (isDuty) {
        window.open('https://www.eczaneler.gen.tr/', '_blank');
        return;
    }

    // Konum yok → uyar
    if (lat === null || lng === null) {
        alert('Konumunuz henüz belirlenmedi.\nLütfen birkaç saniye bekleyin veya konumu tıklayarak girin.');
        return;
    }

    // Modal aç
    openModal(type);
}

// --- MODAL ---
var LABELS = {
    atm: 'En Yakın ATM',
    hospital: 'En Yakın Hastaneler',
    restaurant: 'Cafe & Restoranlar',
    supermarket: 'En Yakın Marketler',
    fuel: 'En Yakın Benzinlikler',
    clothes: 'Giyim Mağazaları',
    parking: 'En Yakın Otoparklar',
    taxi: 'Taksi Durakları',
    tourism: 'Turistik Yerler',
    hotel: 'En Yakın Oteller',
    post_office: 'Kargo Şubeleri',
    assembly_point: 'Toplanma Alanları',
    police: 'Polis Merkezi',
    pharmacy: 'En Yakın Eczaneler'
};

function openModal(type) {
    var modal = document.getElementById('result-modal');
    var title = document.getElementById('result-title');
    var list = document.getElementById('result-list');

    if (!modal || !title || !list) { console.error('Modal elementleri bulunamadı!'); return; }

    title.innerHTML = '<i class="fa-solid fa-map-location-dot" style="color:#3b82f6;"></i> ' + (LABELS[type] || type);
    list.innerHTML = '<div style="text-align:center;padding:40px;"><span class="loader"></span><p style="color:#6b7280;margin-top:12px;font-size:13px;">Aranıyor...</p></div>';
    modal.style.display = 'flex';

    fetchPlaces(type);
}

function closeModal() {
    var modal = document.getElementById('result-modal');
    if (modal) modal.style.display = 'none';
}

// --- OVERPASS API (node + way — relation out center ile uyumsuz) ---
function nw(filter, r) {
    // node ve way — Türkiye'deki hastane/polis gibi yapılar way olarak çizilir
    return 'node' + filter + '(around:' + r + ',' + lat + ',' + lng + ');' +
           'way'  + filter + '(around:' + r + ',' + lat + ',' + lng + ');';
}

function fetchPlaces(type) {
    var r = 15000;
    var q = '';

    switch(type) {
        case 'atm':
            q = nw('["amenity"="atm"]', r) +
                nw('["amenity"="bank"]["atm"="yes"]', r);
            break;
        case 'hospital':
            q = nw('["amenity"="hospital"]', r) +
                nw('["amenity"="clinic"]', r);
            break;
        case 'restaurant':
            q = nw('["amenity"~"restaurant|cafe|fast_food"]', r);
            break;
        case 'supermarket':
            q = nw('["shop"~"supermarket|convenience"]', r);
            break;
        case 'clothes':
            q = nw('["shop"~"clothes|fashion"]', r);
            break;
        case 'tourism':
            q = nw('["tourism"~"attraction|museum|viewpoint"]', r);
            break;
        case 'hotel':
            q = nw('["tourism"~"hotel|motel|hostel|guest_house"]', r);
            break;
        case 'post_office':
            q = nw('["amenity"="post_office"]', r);
            break;
        case 'assembly_point':
            q = nw('["emergency"="assembly_point"]', r) +
                nw('["amenity"="shelter"]', r);
            break;
        case 'police':
            q = nw('["amenity"="police"]', r);
            break;
        case 'pharmacy':
            q = nw('["amenity"="pharmacy"]', r);
            break;
        case 'fuel':
            q = nw('["amenity"="fuel"]', r);
            break;
        case 'parking':
            q = nw('["amenity"="parking"]', r);
            break;
        case 'taxi':
            q = nw('["amenity"="taxi"]', r);
            break;
        default:
            q = nw('["amenity"="' + type + '"]', r);
    }

    var fullQ = '[out:json][timeout:25];(' + q + ');out center;';
    var currentType = type;

    fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(fullQ))
        .then(function(res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        })
        .then(function(data) {
            renderPlaces(data.elements || [], currentType);
        })
        .catch(function(e) {
            console.error('Overpass hatası:', e);
            var list = document.getElementById('result-list');
            if (list) {
                var label = LABELS[currentType] || currentType;
                var mapsSearch = 'https://www.google.com/maps/search/' +
                    encodeURIComponent(label) + '/@' + lat + ',' + lng + ',14z';
                list.innerHTML = '<div style="text-align:center;padding:30px;">' +
                    '<p style="color:#ef4444;margin-bottom:12px;">Sunucuya bağlanılamadı.</p>' +
                    '<a href="' + mapsSearch + '" target="_blank" style="background:#3b82f6;color:white;padding:10px 20px;border-radius:12px;text-decoration:none;font-weight:700;font-size:13px;">Google Maps\'te Ara</a>' +
                    '</div>';
            }
        });
}


function renderPlaces(items, type) {
    var list = document.getElementById('result-list');
    if (!list) return;

    if (!items || items.length === 0) {
        // Sonuç yok — Google Maps fallback
        var searchTerm = LABELS[type] || type;
        var mapsSearch = 'https://www.google.com/maps/search/' + encodeURIComponent(searchTerm) + '/@' + lat + ',' + lng + ',14z';
        list.innerHTML = '<div style="text-align:center;padding:30px;">' +
            '<p style="color:#9ca3af;margin-bottom:16px;font-size:14px;">Yakınınızda OpenStreetMap\'te kayıtlı sonuç bulunamadı.</p>' +
            '<a href="' + mapsSearch + '" target="_blank" style="display:inline-block;background:#3b82f6;color:white;padding:12px 24px;border-radius:14px;text-decoration:none;font-weight:700;font-size:13px;box-shadow:0 4px 12px rgba(59,130,246,.35);">' +
            '<i class="fa-brands fa-google" style="margin-right:6px;"></i>Google Maps\'te Ara</a>' +
            '</div>';
        return;
    }

    var html = '';
    for (var i = 0; i < items.length; i++) {
        var el = items[i];
        var name = (el.tags && el.tags.name) ? el.tags.name : 'İsimsiz Yer';
        var elat = el.lat || (el.center && el.center.lat) || '';
        var elon = el.lon || (el.center && el.center.lon) || '';
        if (!elat || !elon) continue; // koordinatsız sonucu atla
        var mapsUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + elat + ',' + elon;
        html += '<div style="background:white;border:1px solid #e5e7eb;border-radius:14px;padding:14px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
            '<span style="font-weight:700;color:#1f2937;font-size:13px;flex:1;">' + name + '</span>' +
            '<a href="' + mapsUrl + '" target="_blank" style="background:#3b82f6;color:white;font-size:11px;font-weight:700;padding:8px 12px;border-radius:10px;text-decoration:none;white-space:nowrap;">Yol Tarifi</a>' +
            '</div>';
    }
    if (!html) {
        list.innerHTML = '<p style="text-align:center;padding:30px;color:#9ca3af;">İsimli sonuç bulunamadı.</p>';
    } else {
        list.innerHTML = html;
    }
}


// --- MOD DEĞİŞTİRME ---
function applyMode(mode) {
    currentMode = mode;

    // Mod butonlarını güncelle
    var modes = ['daily', 'tourist', 'emergency'];
    for (var i = 0; i < modes.length; i++) {
        var mBtn = document.getElementById('m-' + modes[i]);
        if (mBtn) mBtn.className = 'mode-btn' + (modes[i] === mode ? ' active' : '');
    }

    // Alt aksiyon alanlarını güncelle
    var emgDiv = document.getElementById('emg-actions');
    var stdDiv = document.getElementById('std-actions');
    if (mode === 'emergency') {
        if (emgDiv) emgDiv.style.display = 'flex';
        if (stdDiv) stdDiv.style.display = 'none';
    } else {
        if (emgDiv) emgDiv.style.display = 'none';
        if (stdDiv) stdDiv.style.display = 'flex';
    }

    // Butonları filtrele ve sırala
    filterButtons(mode);
}

function filterButtons(mode) {
    var catBtns = document.querySelectorAll('.cat-btn');

    // Acil modunda sadece bu görünür (sıralı)
    var EMERGENCY_ORDER = ['hospital', 'nobetci_eczane', 'police', 'assembly_point', 'pharmacy'];

    // Turist modunda öncelik sırası
    var TOURIST_PRIORITY = ['tourism', 'hotel', 'restaurant', 'taxi', 'post_office', 'atm', 'pharmacy'];

    for (var i = 0; i < catBtns.length; i++) {
        var btn = catBtns[i];
        var type = btn.getAttribute('data-type') || '';

        // Her geçişte önce sıfırla
        btn.style.display = 'flex';
        btn.style.opacity = '1';
        btn.style.order = String(i);

        if (mode === 'emergency') {
            var eIdx = EMERGENCY_ORDER.indexOf(type);
            if (eIdx !== -1) {
                btn.style.display = 'flex';
                btn.style.order = String(eIdx - 10); // negatif = en başa
                btn.style.opacity = '1';
            } else {
                btn.style.display = 'none';
            }

        } else if (mode === 'tourist') {
            var tIdx = TOURIST_PRIORITY.indexOf(type);
            if (tIdx !== -1) {
                btn.style.order = String(tIdx - 10); // negatif = en başa
                btn.style.opacity = '1';
            } else {
                btn.style.order = String(50 + i);
                btn.style.opacity = '0.5';
            }

        } else {
            // Günlük: DOM sırası
            btn.style.order = String(i);
            btn.style.opacity = '1';
        }
    }
}

// --- PAYLAŞIM ---
function shareWhatsApp() {
    if (lat === null) { alert('Konum bulunamadı.'); return; }
    var url = 'https://www.google.com/maps?q=' + lat + ',' + lng;
    window.open('https://wa.me/?text=' + encodeURIComponent('Güncel konumum: ' + url));
}

function sendSMS() {
    if (lat === null) { alert('Konum bulunamadı.'); return; }
    var url = 'https://www.google.com/maps?q=' + lat + ',' + lng;
    window.open('sms:?body=' + encodeURIComponent('Acil! Konumum: ' + url));
}
