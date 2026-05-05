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
    local_food: 'Yerel Lezzetler',
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

// --- OVERPASS API (node + way + relation — POST ile gönder) ---
function nwr(filter, r, la, lo) {
    return 'node'     + filter + '(around:' + r + ',' + la + ',' + lo + ');' +
           'way'      + filter + '(around:' + r + ',' + la + ',' + lo + ');' +
           'relation' + filter + '(around:' + r + ',' + la + ',' + lo + ');';
}

// Önbellek yardımcıları (1 dakika geçerli)
function getCache(key) {
    var cached = sessionStorage.getItem('osm_cache_' + key);
    if (!cached) return null;
    var data = JSON.parse(cached);
    if (Date.now() - data.time > 60000) {
        sessionStorage.removeItem('osm_cache_' + key);
        return null;
    }
    return data.elements;
}

function setCache(key, elements) {
    var data = { time: Date.now(), elements: elements };
    sessionStorage.setItem('osm_cache_' + key, JSON.stringify(data));
}

function fetchPlaces(type, radiusOverride) {
    // Koordinat kontrolü — null gelirse hata göster
    if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
        var list = document.getElementById('result-list');
        if (list) list.innerHTML = '<p style="text-align:center;padding:30px;color:#ef4444;">Konum koordinatı alınamadı. Lütfen konumu yenileyin.</p>';
        return;
    }

    var latF = parseFloat(lat).toFixed(6);
    var lngF = parseFloat(lng).toFixed(6);
    
    // Önbellek kontrolü (radiusOverride yoksa kullan)
    if (!radiusOverride) {
        var cachedData = getCache(type);
        if (cachedData) {
            console.log('[Cache Hit]', type);
            renderPlaces(cachedData, type);
            return;
        }
    }

    // Yarıçap mantığı: Başlangıç 5000m, override varsa onu kullan
    var r = radiusOverride || 5000;
    
    var q = '';

    switch(type) {
        case 'atm':
            q = nwr('["amenity"="atm"]', r, latF, lngF);
            break;
        case 'hospital':
            q = nwr('["amenity"~"hospital|clinic"]', r, latF, lngF);
            break;
        case 'restaurant':
            q = nwr('["amenity"~"restaurant|cafe|fast_food"]', r, latF, lngF) +
                nwr('["shop"~"kiosk|bakery"]', r, latF, lngF);
            break;
        case 'local_food':
            // Agresif ama sadeleştirilmiş sorgu
            q = nwr('["amenity"~"fast_food|restaurant"]', r, latF, lngF) +
                nwr('["cuisine"~"kebab|doner|pide|lahmacun"]', r, latF, lngF) +
                nwr('["name"~"Döner|Pide|Kebap|Lahmacun|Büfe",i]', r, latF, lngF);
            break;
        case 'supermarket':
            q = nwr('["shop"~"supermarket|convenience"]', r, latF, lngF);
            break;
        case 'clothes':
            q = nwr('["shop"~"clothes|fashion"]', r, latF, lngF);
            break;
        case 'tourism':
            q = nwr('["tourism"~"attraction|museum|viewpoint"]', r, latF, lngF);
            break;
        case 'hotel':
            q = nwr('["tourism"~"hotel|motel"]', r, latF, lngF);
            break;
        case 'post_office':
            q = nwr('["amenity"="post_office"]', r, latF, lngF);
            break;
        case 'assembly_point':
            q = nwr('["emergency"="assembly_point"]', r, latF, lngF);
            break;
        case 'police':
            q = nwr('["amenity"="police"]', r, latF, lngF);
            break;
        case 'pharmacy':
            q = nwr('["amenity"="pharmacy"]', r, latF, lngF);
            break;
        case 'fuel':
            q = nwr('["amenity"="fuel"]', r, latF, lngF);
            break;
        case 'parking':
            q = nwr('["amenity"="parking"]', r, latF, lngF);
            break;
        case 'taxi':
            q = nwr('["amenity"="taxi"]', r, latF, lngF);
            break;
        default:
            q = nwr('["amenity"="' + type + '"]', r, latF, lngF);
    }

    // [timeout:10] ve out 50 limitleri eklendi
    var fullQ = '[out:json][timeout:10];(' + q + ');out center 50;';
    console.log('[Overpass Sorgu]', fullQ);

    var currentType = type;
    var endpoint = 'https://overpass-api.de/api/interpreter';

    fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(fullQ)
    })
        .then(function(res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        })
        .then(function(data) {
            var elements = data.elements || [];
            if (!radiusOverride) setCache(currentType, elements);
            renderPlaces(elements, currentType, r);
        })
        .catch(function(e) {
            console.error('[Overpass Hata]', e);
            var list = document.getElementById('result-list');
            if (list) {
                var label = LABELS[currentType] || currentType;
                var mapsSearch = 'https://www.google.com/maps/search/' +
                    encodeURIComponent(label) + '/@' + latF + ',' + lngF + ',14z';
                list.innerHTML = '<div style="text-align:center;padding:30px;">' +
                    '<p style="color:#ef4444;margin-bottom:12px;">Sunucu hatası: ' + e.message + '</p>' +
                    '<a href="' + mapsSearch + '" target="_blank" style="background:#3b82f6;color:white;padding:10px 20px;border-radius:12px;text-decoration:none;font-weight:700;font-size:13px;">Google Maps\'te Ara</a>' +
                    '</div>';
            }
        });
}



// Haversine mesafe hesaplama (km)
function haversine(la1, lo1, la2, lo2) {
    var R = 6371;
    var dLat = (la2 - la1) * Math.PI / 180;
    var dLon = (lo2 - lo1) * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function formatDist(km) {
    if (km < 1) return Math.round(km * 1000) + ' m';
    return km.toFixed(1) + ' km';
}

function renderPlaces(items, type, currentRadius) {
    var list = document.getElementById('result-list');
    if (!list) return;

    if (!items || items.length === 0) {
        var searchTerm = LABELS[type] || type;
        var mapsSearch = 'https://www.google.com/maps/search/' + encodeURIComponent(searchTerm) + '/@' + lat + ',' + lng + ',14z';
        
        var html = '<div style="text-align:center;padding:30px;">';
        html += '<p style="color:#9ca3af;margin-bottom:16px;font-size:14px;">5km içinde sonuç bulunamadı.</p>';
        
        // "Daha geniş alanda ara" butonu (75km)
        if (currentRadius < 75000) {
            html += '<button onclick="fetchPlaces(\'' + type + '\', 75000)" style="display:block;width:100%;background:#3b82f6;color:white;padding:14px;border-radius:14px;border:none;font-weight:700;margin-bottom:10px;cursor:pointer;">' +
                    '🔍 75km Çapında Daha Geniş Ara</button>';
        }

        // local_food icin ozel ve buyuk fallback butonu
        if (type === 'local_food') {
            var mapsFood = 'https://www.google.com/maps/search/d%C3%B6nerci+pide+kebap/@' + lat + ',' + lng + ',15z';
            html += '<a href="' + mapsFood + '" target="_blank" style="display:block;background:linear-gradient(135deg,#ea580c,#f97316);color:white;padding:16px 24px;border-radius:16px;text-decoration:none;font-weight:800;font-size:14px;box-shadow:0 4px 14px rgba(234,88,12,.4);margin-bottom:10px;">' +
                    '🗺️ Google Haritalar\'da Dönerci Ara</a>';
        }

        html += '<a href="' + mapsSearch + '" target="_blank" style="display:block;background:#f1f5f9;color:#374151;padding:12px;border-radius:14px;text-decoration:none;font-weight:600;font-size:13px;">' +
                'Google Maps\'te Ara</a></div>';
        
        list.innerHTML = html;
        return;
    }

    // Koordinatları olan öğeleri filtrele ve mesafeyi hesapla
    var enriched = [];
    for (var i = 0; i < items.length; i++) {
        var el = items[i];
        var elat = el.lat || (el.center && el.center.lat);
        var elon = el.lon || (el.center && el.center.lon);
        if (!elat || !elon) continue;
        var dist = haversine(parseFloat(lat), parseFloat(lng), parseFloat(elat), parseFloat(elon));
        enriched.push({ el: el, elat: elat, elon: elon, dist: dist });
    }

    if (enriched.length === 0) {
        list.innerHTML = '<p style="text-align:center;padding:30px;color:#9ca3af;">Koordinatlı sonuç bulunamadı.</p>';
        return;
    }

    // Mesafeye göre sırala (en yakın önce)
    enriched.sort(function(a, b) { return a.dist - b.dist; });

    // local_food için: Döner veya Pide ismini taşıyanları öne al (Reklam önceliği)
    if (type === 'local_food') {
        enriched.sort(function(a, b) {
            var aN = (a.el.tags && a.el.tags.name) ? a.el.tags.name.toLowerCase() : '';
            var bN = (b.el.tags && b.el.tags.name) ? b.el.tags.name.toLowerCase() : '';
            var aP = (aN.indexOf('döner') !== -1 || aN.indexOf('pide') !== -1) ? 0 : 1;
            var bP = (bN.indexOf('döner') !== -1 || bN.indexOf('pide') !== -1) ? 0 : 1;
            if (aP !== bP) return aP - bP;
            return a.dist - b.dist;
        });
    }

    var html = '';
    for (var j = 0; j < enriched.length; j++) {
        var item = enriched[j];
        var defaultName = (type === 'restaurant' || type === 'local_food') ? 'İsimsiz İşletme' : 'İsimsiz Yer';
        var name = (item.el.tags && item.el.tags.name && item.el.tags.name.trim()) ? item.el.tags.name.trim() : defaultName;
        var mapsUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + item.elat + ',' + item.elon;
        var distStr = formatDist(item.dist);

        html += '<div style="background:white;border:1px solid #e5e7eb;border-radius:14px;padding:12px 14px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
            '<div style="flex:1;min-width:0;">' +
                '<div style="font-weight:700;color:#1f2937;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + name + '</div>' +
                '<div style="font-size:11px;color:#6b7280;margin-top:2px;"><i class="fa-solid fa-route" style="margin-right:3px;"></i>' + distStr + '</div>' +
            '</div>' +
            '<a href="' + mapsUrl + '" target="_blank" style="background:#3b82f6;color:white;font-size:11px;font-weight:700;padding:8px 12px;border-radius:10px;text-decoration:none;white-space:nowrap;flex-shrink:0;">Yol Tarifi</a>' +
            '</div>';
    }
    list.innerHTML = html;
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
    var TOURIST_PRIORITY = ['tourism', 'local_food', 'hotel', 'restaurant', 'taxi', 'post_office', 'atm', 'pharmacy'];

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
