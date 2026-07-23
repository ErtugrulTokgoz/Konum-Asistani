/* ===== YAKИНIMDA NE VAR? - main.js ===== */
'use strict';
var googleService = null;
var API_LIMIT = 5000;
var aktifApi = 'google';

// --- Global State ---
var lat = null;
var lng = null;
var currentMode = 'daily';

// --- API KOTA KONTROLÜ (localStorage) ---
function sayaciKontrolEt() {
    var sayac = localStorage.getItem('google_api_sayac');
    if (!sayac) {
        sayac = 0;
        localStorage.setItem('google_api_sayac', 0);
    }
    if (parseInt(sayac) >= API_LIMIT) {
        aktifApi = 'overpass';
    } else {
        aktifApi = 'google';
    }
}

function sayaciArtir() {
    var sayac = parseInt(localStorage.getItem('google_api_sayac') || 0);
    sayac++;
    localStorage.setItem('google_api_sayac', sayac);
    if (sayac >= API_LIMIT) {
        aktifApi = 'overpass';
    }
}

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

function submitFeedback(e) {
    if (e) e.preventDefault(); // Sayfa yenilemesini veya dışarı atmasını engelle

    var formElement = document.getElementById('feedback-form');
    var formData = new FormData(formElement);

    // Form içerisindeki veriyi test için konsola basalım
    console.log('Giden Veri:', Object.fromEntries(formData));

    // Gönder Butonunu geçici olarak devre dışı bırakıp beklediğimizi gösterelim
    var btn = document.getElementById('fb-submit-btn');
    var originalText = '';
    if (btn) {
        originalText = btn.innerHTML;
        btn.innerHTML = '<span class="loader" style="width:14px;height:14px;border-width:2px;margin-right:6px;"></span> Gönderiliyor...';
        btn.disabled = true;
    }

    // Formspree API Gönderimi (Body olarak formData kullanıyoruz)
    fetch('https://formspree.io/f/xkolylvo', {
        method: 'POST',
        headers: {
            'Accept': 'application/json'
        },
        body: formData
    })
    .then(function(response) {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }

        if (response.ok) {
            // 1. Modalı kapat
            closeFeedback();

            // 2. Temizlik: Form inputlarını sıfırla
            formElement.reset();

            // 3. Ekrana şık bir Toast alert yazdır
            var toast = document.createElement('div');
            toast.innerText = '✅ Mesajınız başarıyla gönderildi! Geri bildiriminiz için teşekkürler.';
            toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#22c55e;color:white;padding:12px 24px;border-radius:999px;font-weight:700;font-size:13px;z-index:9999;box-shadow:0 4px 14px rgba(0,0,0,.2);';
            document.body.appendChild(toast);

            // Toast'ı 3 saniye sonra kaldır
            setTimeout(function() { 
                if (toast.parentNode) toast.parentNode.removeChild(toast); 
            }, 3000);
        } else {
            console.error('Formspree sunucusu hata döndürdü.');
            alert('Bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
        }
    })
    .catch(function(error) {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
        console.error('Ağ hatası:', error);
        alert('Bir hata oluştu. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.');
    });
}


// --- SPLASH SCREEN ---
window.addEventListener('load', function() {
    setTimeout(function() {
        var splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(function() {
                splash.style.display = 'none';
            }, 500);
        }
    }, 1500);
});

// --- Sayfa Hazır ---
document.addEventListener('DOMContentLoaded', function() {
    try {
        if (window.google && window.google.maps && window.google.maps.places) {
            googleService = new google.maps.places.PlacesService(document.createElement('div'));
        }
    } catch(e) {
        console.warn('Google Maps yüklenemedi:', e);
    }
    
    sayaciKontrolEt();
    startLocation();

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
                reklamKontroluYap(lat, lng);
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
                lat = parseFloat(d.latitude);
                lng = parseFloat(d.longitude);
                setLocText((d.city || 'Tahmini Konum') + ' (Ağ)');
                window.bulunanGuncelIlce = d.city || 'Merkez';
                reklamKontroluYap(lat, lng);
                ilceSponsorlariniGoster(d.city || 'Merkez');
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
            
            // İlçe bilgisini buradan doğrudan sponsor fonksiyonuna gönderiyoruz
            var ilce = a.town || a.county || a.city_district || a.suburb || a.city || "Merkez";
            ilce = ilce.replace(" İlçesi", "").replace(" District", "");
            window.bulunanGuncelIlce = ilce;
            ilceSponsorlariniGoster(ilce);
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
                window.bulunanGuncelIlce = q.trim();
                reklamKontroluYap(lat, lng);
                ilceSponsorlariniGoster(q.trim());
            } else {
                alert('Konum bulunamadı. Başka bir ad deneyin.');
                setLocText('Konum bulunamadı — tıkla');
            }
        })
        .catch(function() { setLocText('Hata — tekrar dene'); });
}

// --- KATEGORİ BUTON TIKLAMA ---
function catClick(type, isDuty) {
    if (isDuty) {
        window.open('https://www.eczaneler.gen.tr/', '_blank');
        return;
    }

    if (lat === null || lng === null) {
        alert('Konumunuz henüz belirlenmedi.\nLütfen birkaç saniye bekleyin veya konumu tıklayarak girin.');
        return;
    }

    openModal(type);
}


// --- GOOGLE PLACES ARAMASI (KLASİK KARARLI SÜRÜM) ---
function googlePlacesArama(type) {
    if (!googleService) {
        console.warn('Google Service aktif değil, Overpass yedeğine geçiliyor.');
        fetchPlaces(type);
        return;
    }

    var konum = new google.maps.LatLng(lat, lng);
    
    var istek = {
        location: konum,
        rankBy: google.maps.places.RankBy.DISTANCE
    };

    var turkishKeywords = {
        'supermarket': 'market bakkal tekel büfe süpermarket',
        'hair_care': 'kuaför berber güzellik salonu',
        'pharmacy': 'eczane',
        'nobetci_eczane': 'eczane nöbetçi',
        'atm': 'atm bankamatik',
        'hospital': 'hastane poliklinik sağlık ocağı tıp merkezi',
        'restaurant': 'restoran kafe lokanta',
        'local_food': 'kebap döner pide lahmacun ev yemekleri',
        'fuel': 'benzinlik akaryakıt istasyonu',
        'clothes': 'giyim mağaza butik tuhafiye',
        'parking': 'otopark',
        'taxi': 'taksi durağı',
        'tourism': 'turistik müze ören yeri park',
        'hotel': 'otel pansiyon konaklama',
        'post_office': 'kargo ptt postane',
        'assembly_point': 'toplanma alanı park',
        'police': 'polis karakol emniyet'
    };

    istek.keyword = turkishKeywords[type] || (LABELS[type] || type);

    sayaciArtir(); // Google API çağrıldığında sayacı 1 artır

    try {
        // Zaman aşımı koruması (Google 5 saniye içinde cevap vermezse veya callback çökürse yedeğe geç)
        var zamanAsimi = setTimeout(function() {
            console.error('Google Maps cevap vermedi (Timeout) -> Overpass Yedeğine Geçiliyor.');
            fetchPlaces(type);
        }, 5000);

        googleService.nearbySearch(istek, function(sonuclar, durum) {
            clearTimeout(zamanAsimi); // Google cevap verdiyse zaman aşımını iptal et
            
            if (durum === google.maps.places.PlacesServiceStatus.OK && sonuclar && sonuclar.length > 0) {
                var donusturulmus = [];
                for (var i = 0; i < sonuclar.length; i++) {
                    var yer = sonuclar[i];
                    if (!yer.geometry || !yer.geometry.location) continue;
                    
                    var photoUrl = null;
                    if (yer.photos && yer.photos.length > 0) {
                        photoUrl = yer.photos[0].getUrl({maxWidth: 100, maxHeight: 100});
                    }

                    var isOpen = null;
                    if (yer.opening_hours) {
                        isOpen = typeof yer.opening_hours.isOpen === 'function' ? yer.opening_hours.isOpen() : yer.opening_hours.open_now;
                    }

                    donusturulmus.push({
                        lat: yer.geometry.location.lat(),
                        lon: yer.geometry.location.lng(),
                        rating: yer.rating || null,
                        photo_url: photoUrl,
                        open_now: isOpen,
                        tags: {
                            name: yer.name
                        }
                    });
                }
                renderPlaces(donusturulmus, type, 5000);
            } else {
                console.error('[Google Maps Başarısız] Durum Kodu:', durum, '-> Overpass Yedeğine Geçiliyor.');
                fetchPlaces(type);
            }
        });
    } catch(e) {
        console.error('Google nearbySearch çöktü:', e);
        fetchPlaces(type);
    }
}

// --- OVERPASS API (YEDEK SİSTEM) ---
function nwr(filter, r, la, lo) {
    return 'nwr' + filter + '(around:' + r + ',' + la + ',' + lo + ');';
}

function fetchPlaces(type, radiusOverride) {
    var latF = parseFloat(lat).toFixed(6);
    var lngF = parseFloat(lng).toFixed(6);
    var r = radiusOverride || 5000;
    var q = '';

    switch(type) {
        case 'atm': q = nwr('["amenity"="atm"]', r, latF, lngF); break;
        case 'hospital': q = nwr('["amenity"~"hospital|clinic"]', r, latF, lngF); break;
        case 'restaurant': q = nwr('[~"amenity|shop"~"restaurant|cafe|fast_food|kiosk|bakery"]', r, latF, lngF); break;
        case 'local_food': q = nwr('[~"amenity|cuisine|name"~"fast_food|restaurant|kebab|doner|pide|lahmacun|Döner|Kebap|Büfe",i]', r, latF, lngF); break;
        case 'supermarket': q = nwr('["shop"~"supermarket|convenience"]', r, latF, lngF); break;
        case 'clothes': q = nwr('["shop"~"clothes|fashion"]', r, latF, lngF); break;
        case 'tourism': q = nwr('["tourism"~"attraction|museum|viewpoint"]', r, latF, lngF); break;
        case 'hotel': q = nwr('["tourism"~"hotel|motel"]', r, latF, lngF); break;
        case 'post_office': q = nwr('["amenity"="post_office"]', r, latF, lngF); break;
        case 'assembly_point': q = nwr('["emergency"="assembly_point"]', r, latF, lngF); break;
        case 'police': q = nwr('["amenity"="police"]', r, latF, lngF); break;
        case 'pharmacy': q = nwr('["amenity"="pharmacy"]', r, latF, lngF); break;
        case 'fuel': q = nwr('["amenity"="fuel"]', r, latF, lngF); break;
        case 'parking': q = nwr('["amenity"="parking"]', r, latF, lngF); break;
        case 'taxi': q = nwr('["amenity"="taxi"]', r, latF, lngF); break;
        case 'hair_care': q = nwr('["shop"="hairdresser"]', r, latF, lngF); break;
        default: q = nwr('["amenity"="' + type + '"]', r, latF, lngF);
    }

    var fullQ = '[out:json][timeout:15];(' + q + ');out center 50;';
    
    // 503 ve CORS Hatalarına karşı stabil yedek sunucular
    var overpassEndpoints = [
        'https://overpass-api.de/api/interpreter',
        'https://lz4.overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter'
    ];

    function tryFetch(index) {
        if (index >= overpassEndpoints.length) {
            var list = document.getElementById('result-list');
            if (list) {
                var label = LABELS[type] || type;
                var mapsSearch = 'https://www.google.com/maps/search/' + encodeURIComponent(label) + '/@' + latF + ',' + lngF + ',14z';
                list.innerHTML = '<div style="text-align:center;padding:30px;">' +
                    '<p style="color:#ef4444;margin-bottom:12px;">Tüm yedek sunucular meşgul (503). Sonuç alınamadı.</p>' +
                    '<a href="' + mapsSearch + '" target="_blank" style="background:#3b82f6;color:white;padding:10px 20px;border-radius:12px;text-decoration:none;font-weight:700;font-size:13px;">Google Haritalar\'da Ara</a>' +
                    '</div>';
            }
            return;
        }

        var endpoint = overpassEndpoints[index];
        console.log('[Overpass Yedek Sorgu]', endpoint);
        
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
            renderPlaces(elements, type, r);
        })
        .catch(function(e) {
            console.warn(endpoint + ' başarısız (' + e.message + '), diğer yedeğe geçiliyor...');
            tryFetch(index + 1);
        });
    }

    tryFetch(0);
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
    pharmacy: 'En Yakın Eczaneler',
    hair_care: 'Kuaför & Güzellik'
};

function openModal(type) {
    var modal = document.getElementById('result-modal');
    var title = document.getElementById('result-title');
    var list = document.getElementById('result-list');

    if (!modal || !title || !list) { console.error('Modal elementleri bulunamadı!'); return; }

    title.innerHTML = '<i class="fa-solid fa-map-location-dot" style="color:#3b82f6;"></i> ' + (LABELS[type] || type);
    list.innerHTML = '<div style="text-align:center;padding:40px;"><span class="loader"></span><p style="color:#6b7280;margin-top:12px;font-size:13px;">Aranıyor...</p></div>';
    modal.style.display = 'flex';

    sayaciKontrolEt();

    if (aktifApi === 'google') {
        googlePlacesArama(type);
    } else {
        fetchPlaces(type);
    }
}

function closeModal() {
    var modal = document.getElementById('result-modal');
    if (modal) modal.style.display = 'none';
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

        if (currentRadius < 75000) {
            html += '<button onclick="fetchPlaces(\'' + type + '\', 75000)" style="display:block;width:100%;background:#3b82f6;color:white;padding:14px;border-radius:14px;border:none;font-weight:700;margin-bottom:10px;cursor:pointer;">' +
                    '🔍 75km Çapında Daha Geniş Ara (Yedek)</button>';
        }

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

    enriched.sort(function(a, b) { return a.dist - b.dist; });

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

        html += '<div style="background:white;border:1px solid #e5e7eb;border-radius:14px;padding:12px 14px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:12px;">';
        
        if (item.el.photo_url) {
            html += '<img src="' + item.el.photo_url + '" style="width:44px;height:44px;border-radius:8px;object-fit:cover;flex-shrink:0;">';
        }

        html += '<div style="flex:1;min-width:0;">' +
            '<div style="font-weight:700;color:#1f2937;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + name + '</div>';
            
        html += '<div style="font-size:11px;color:#6b7280;margin-top:4px;display:flex;align-items:center;flex-wrap:wrap;gap:6px;">' +
            '<span style="background:#f3f4f6;padding:2px 6px;border-radius:6px;"><i class="fa-solid fa-route" style="margin-right:4px;"></i>' + distStr + '</span>';

        if (item.el.rating) {
            html += '<span style="background:#fffbeb;color:#d97706;padding:2px 6px;border-radius:6px;font-weight:600;"><i class="fa-solid fa-star" style="margin-right:3px;"></i>' + item.el.rating + '</span>';
        }

        if (item.el.open_now !== null && item.el.open_now !== undefined) {
            if (item.el.open_now) {
                html += '<span style="color:#10b981;font-weight:700;">Açık</span>';
            } else {
                html += '<span style="color:#ef4444;font-weight:700;">Kapalı</span>';
            }
        }

        html += '</div></div>' +
            '<a href="' + mapsUrl + '" target="_blank" style="background:#3b82f6;color:white;font-size:11px;font-weight:700;padding:8px 12px;border-radius:10px;text-decoration:none;white-space:nowrap;flex-shrink:0;">Yol Tarifi</a>' +
            '</div>';
    }
    list.innerHTML = html;
}

// --- MOD DEĞİŞTİRME ---
function applyMode(mode) {
    currentMode = mode;

    var modes = ['daily', 'tourist', 'emergency'];
    for (var i = 0; i < modes.length; i++) {
        var mBtn = document.getElementById('m-' + modes[i]);
        if (mBtn) mBtn.className = 'mode-btn' + (modes[i] === mode ? ' active' : '');
    }

    var emgDiv = document.getElementById('emg-actions');
    var stdDiv = document.getElementById('std-actions');
    if (mode === 'emergency') {
        if (emgDiv) emgDiv.style.display = 'flex';
        if (stdDiv) stdDiv.style.display = 'none';
    } else {
        if (emgDiv) emgDiv.style.display = 'none';
        if (stdDiv) stdDiv.style.display = 'flex';
    }

    filterButtons(mode);
}

function filterButtons(mode) {
    var catBtns = document.querySelectorAll('.cat-btn');

    var EMERGENCY_ORDER = ['hospital', 'nobetci_eczane', 'police', 'assembly_point', 'pharmacy'];
    var TOURIST_PRIORITY = ['tourism', 'local_food', 'hotel', 'restaurant', 'taxi', 'post_office', 'atm', 'pharmacy'];

    for (var i = 0; i < catBtns.length; i++) {
        var btn = catBtns[i];
        var type = btn.getAttribute('data-type') || '';

        btn.style.display = 'flex';
        btn.style.opacity = '1';
        btn.style.order = String(i);

        if (mode === 'emergency') {
            var eIdx = EMERGENCY_ORDER.indexOf(type);
            if (eIdx !== -1) {
                btn.style.display = 'flex';
                btn.style.order = String(eIdx - 10);
                btn.style.opacity = '1';
            } else {
                btn.style.display = 'none';
            }
        } else if (mode === 'tourist') {
            var tIdx = TOURIST_PRIORITY.indexOf(type);
            if (tIdx !== -1) {
                btn.style.order = String(tIdx - 10);
                btn.style.opacity = '1';
            } else {
                btn.style.order = String(50 + i);
                btn.style.opacity = '0.5';
            }
        } else {
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

// --- GEOFENCING & REKLAM (SPONSOR) SİSTEMİ ---
var sponsorMekanlar = [
    { id: 1, ad: 'Self Food Millet Bahçesi', mesaj: 'ücretsiz içecek ikramı 🥤', lat: 40.7615, lng: 29.9355, ilce: 'İzmit' },
    { id: 2, ad: 'Mutfak', mesaj: 'günün menüsünde öğrenciye özel indirim 🍽️', lat: 40.7635, lng: 29.9370, ilce: 'İzmit' },
    { id: 3, ad: 'Meşhur İzmit Pişmaniyecisi', mesaj: '1 Alana 1 Bedava Pişmaniye 🍬', lat: 40.7620, lng: 29.9360, ilce: 'İzmit' },
    { id: 4, ad: 'Moda Giyim Mağazası', mesaj: 'Tişörtlerde %30 Yaz İndirimi 👕', lat: 40.7640, lng: 29.9380, ilce: 'İzmit' },
    { id: 5, ad: 'Merkez Kafe', mesaj: 'Filtre Kahve 35 TL ☕', lat: 40.7610, lng: 29.9340, ilce: 'İzmit' }
];

function reklamKontroluYap(userLat, userLng) {
    if (!userLat || !userLng) return;

    // Gerçek mekanları sponsor olarak eklemek için dinamik sorgu atalım (300m çapında Kafe/Restoran/Giyim)
    var query = '[out:json][timeout:10];(node["amenity"~"cafe|restaurant|fast_food"](around:300,' + userLat + ',' + userLng + ');node["shop"~"clothes"](around:300,' + userLat + ',' + userLng + '););out body 5;';
    
    var overpassEndpoints = [
        'https://overpass-api.de/api/interpreter',
        'https://lz4.overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter'
    ];

    function tryFetch(index) {
        if (index >= overpassEndpoints.length) {
            console.warn("Gerçek sponsorlar hiçbir yedek sunucudan çekilemedi.");
            tamamla();
            return;
        }

        fetch(overpassEndpoints[index], {
            method: 'POST',
            body: query
        })
        .then(function(r) { 
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json(); 
        })
        .then(function(d) {
            if (d && d.elements && d.elements.length > 0) {
                var msgs = ["Günün menüsünde %20 indirim 🍽️", "Ücretsiz kahve ikramı ☕", "Sezon sonu dev indirim 👕", "Öğrenciye %15 indirim!"];
                for (var i = 0; i < d.elements.length; i++) {
                    var el = d.elements[i];
                    if (!el.tags || !el.tags.name) continue;
                    var name = el.tags.name;
                    
                    var exists = false;
                    for (var j = 0; j < sponsorMekanlar.length; j++) {
                        if (sponsorMekanlar[j].ad === name) { exists = true; break; }
                    }
                    
                    if (!exists) {
                        var randMsg = msgs[i % msgs.length];
                        sponsorMekanlar.push({
                            id: 'gercek_' + el.id,
                            ad: name,
                            mesaj: randMsg,
                            lat: el.lat,
                            lng: el.lon,
                            ilce: 'Gerçek' // Dinamik olarak eklenen gerçek mekan bayrağı
                        });
                    }
                }
            }
            tamamla();
        })
        .catch(function(e) { 
            console.warn(overpassEndpoints[index] + " başarısız oldu:", e.message); 
            tryFetch(index + 1); 
        });
    }

    function tamamla() {
        bildirimiAtesle(userLat, userLng);
        // Eğer ilçe bulunduysa banner'ı güncelle (gerçek mekanlar dahil olsun)
        if (window.bulunanGuncelIlce) {
            ilceSponsorlariniGoster(window.bulunanGuncelIlce);
        }
    }

    tryFetch(0);
}

function bildirimiAtesle(userLat, userLng) {
    var gosterilenler = localStorage.getItem('gosterilen_reklamlar');
    if (gosterilenler) {
        gosterilenler = JSON.parse(gosterilenler);
    } else {
        gosterilenler = [];
    }

    var yakindakiSponsorlar = [];
    var yeniGosterilenler = [];

    // 300 Metre kuralını kontrol et
    for (var i = 0; i < sponsorMekanlar.length; i++) {
        var sponsor = sponsorMekanlar[i];
        
        // Spam Koruması: Daha önce gösterildiyse geç
        if (gosterilenler.indexOf(sponsor.id) !== -1) {
            continue;
        }

        var mesafe = haversine(userLat, userLng, sponsor.lat, sponsor.lng);
        
        // 300 Metre = 0.3 km
        if (mesafe <= 0.3) {
            yakindakiSponsorlar.push(sponsor.ad + "'da " + sponsor.mesaj);
            yeniGosterilenler.push(sponsor.id);
        }
    }

    if (yakindakiSponsorlar.length === 0) {
        return; // Yakında yeni sponsor yok
    }

    // Grup Bildirimi (Smart Batching)
    var birlesikMesaj = yakindakiSponsorlar.join(", ") + " hemen yanı başında!";

    // Gerçek Telefon Bildirimi (Native Notification)
    var title = "📍 Yakınında Fırsatlar Var!";
    if ("Notification" in window) {
        if (Notification.permission === "granted") {
            new Notification(title, { body: birlesikMesaj, icon: "icon.png" });
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(function (permission) {
                if (permission === "granted") {
                    new Notification(title, { body: birlesikMesaj, icon: "icon.png" });
                } else {
                    alert(title + " " + birlesikMesaj);
                }
            });
        } else {
            alert(title + " " + birlesikMesaj); // İzin reddedildiyse eski usül alert
        }
    } else {
        alert(title + " " + birlesikMesaj); // Tarayıcı desteklemiyorsa alert
    }

    // Spam koruması için gösterilenleri localStorage'a kaydet
    for (var j = 0; j < yeniGosterilenler.length; j++) {
        gosterilenler.push(yeniGosterilenler[j]);
    }
    localStorage.setItem('gosterilen_reklamlar', JSON.stringify(gosterilenler));
}



function ilceSponsorlariniGoster(bulunanIlce) {
    var kutu = document.getElementById('bolge-sponsorlari');
    if (!kutu) return;
    
    var eslesenler = [];
    
    // İlçe adına göre veya dinamik gerçek sponsor filtreleme
    for (var i = 0; i < sponsorMekanlar.length; i++) {
        var mekan = sponsorMekanlar[i];
        if (mekan.ilce === 'Gerçek' || (mekan.ilce && mekan.ilce.toLowerCase() === bulunanIlce.toLowerCase())) {
            eslesenler.push(mekan);
        }
    }
    
    // YENİ: Eğer bulunduğun ilçede kayıtlı sponsor yoksa dinamik (sahte) sponsorlar üretelim!
    if (eslesenler.length === 0) {
        eslesenler.push({ ad: bulunanIlce + ' Kafe', mesaj: bulunanIlce + ' sakinlerine özel taze kahve', ilce: bulunanIlce });
        eslesenler.push({ ad: bulunanIlce + ' Merkez Lokantası', mesaj: 'bugün tüm menülerde %15 indirim', ilce: bulunanIlce });
        eslesenler.push({ ad: bulunanIlce + ' Butik Giyim', mesaj: 'sezon sonu %50 dev indirim', ilce: bulunanIlce });
    }
    
    // Eğer ilçede sponsor varsa html'e yazdır (Banner Modeli)
    if (eslesenler.length > 0) {
        // Banner metnini oluştur (sadece 1 satır)
        kutu.innerHTML = '<div style="display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-star" style="color:#d97706; font-size:20px;"></i><strong style="color:#92400e; font-size:14px;">' + bulunanIlce + ' Bölgesindeki ' + eslesenler.length + ' Fırsatı İncele!</strong></div><i class="fa-solid fa-chevron-right" style="color:#92400e;"></i>';
        kutu.style.display = 'flex'; // Banner olarak göster
        
        // Modal içerisindeki listeyi oluştur
        var html = '<div style="display:flex; flex-direction:column; gap:12px;">';
        
        for (var j = 0; j < eslesenler.length; j++) {
            var s = eslesenler[j];
            html += '<div class="sponsor-kart">';
            html += '<div><strong style="color:#111827;">' + s.ad + '</strong><br><span style="font-size:13px; color:#4b5563;">' + s.mesaj + '</span></div>';
            html += '<button class="sponsor-kart-btn" onclick="alert(\'' + s.ad + ' fırsatına yönlendiriliyorsunuz...\')">Kullan</button>';
            html += '</div>';
        }
        
        html += '</div>';
        
        var modalList = document.getElementById('sponsor-modal-list');
        var modalTitle = document.getElementById('sponsor-modal-title');
        
        if (modalList) modalList.innerHTML = html;
        if (modalTitle) modalTitle.innerHTML = '<i class="fa-solid fa-star" style="color:#f59e0b;"></i> ' + bulunanIlce + ' Fırsatları';
        
    } else {
        kutu.style.display = 'none'; // Sponsor yoksa gizle
    }
}

function openSponsorModal() {
    var m = document.getElementById('sponsor-modal');
    if (m) m.style.display = 'flex';
}

function closeSponsorModal() {
    var m = document.getElementById('sponsor-modal');
    if (m) m.style.display = 'none';
}
