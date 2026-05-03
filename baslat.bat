@echo off
echo =========================================
echo Konum Asistani Sunucusu Baslatiliyor...
echo =========================================
echo.
echo Tarayiciniz otomatik olarak acilacaktir.
echo Eger acilmazsa su adrese gidin: http://localhost:8000
echo.
echo Kapatmak icin bu pencereyi (siyah ekrani) carpisindan kapatabilirsiniz.
echo.

start http://localhost:8000
python -m http.server 8000
