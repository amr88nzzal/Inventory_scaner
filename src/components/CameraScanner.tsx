import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { playSuccessBeep, playErrorBeep } from "../lib/audio";
import { api } from "../lib/api";

interface CameraScannerProps {
  taskId: string;
  activeShelf: string;
  assignedWarehouseName: string;
  onScanDone: () => void;
  onClose: () => void;
}

export default function CameraScanner({
  taskId,
  activeShelf,
  assignedWarehouseName,
  onScanDone,
  onClose,
}: CameraScannerProps) {
  const [cameraState, setCameraState] = useState<"INITIALIZING" | "SCANNING" | "ERROR">("INITIALIZING");
  const [errorMessage, setErrorMessage] = useState("");
  const [lastScanned, setLastScanned] = useState<{ barcode: string; name?: string; status: "SUCCESS" | "ERROR"; time: string } | null>(null);
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const lastBarcodeRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);

  // Initialize Camera Scanner
  useEffect(() => {
    let isMounted = true;
    const scannerId = "continuous-camera-reader";

    async function initCamera() {
      try {
        setCameraState("INITIALIZING");
        setErrorMessage("");

        // Get available camera devices
        const devices = await Html5Qrcode.getCameras().catch(() => []);
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back/environment camera if available
          const backCam = devices.find((d) => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("environment"));
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        }

        const qrCodeInstance = new Html5Qrcode(scannerId);
        html5QrcodeRef.current = qrCodeInstance;

        // Configuration for fast continuous barcode reading
        const config = {
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minDim = Math.min(viewfinderWidth, viewfinderHeight);
            return {
              width: Math.min(Math.floor(viewfinderWidth * 0.85), 320),
              height: Math.min(Math.floor(viewfinderHeight * 0.45), 180),
            };
          },
          aspectRatio: 1.777778,
        };

        // Try starting with rear camera facingMode first, or selected camera id
        const cameraConfig = devices && devices.length > 0 ? { deviceId: { exact: devices[0].id } } : { facingMode: "environment" };

        await qrCodeInstance.start(
          cameraConfig,
          config,
          handleBarCodeDetected,
          () => {} // silent on frame errors
        );

        if (isMounted) {
          setCameraState("SCANNING");
        }
      } catch (err: any) {
        console.error("Failed to start primary camera, trying fallback facingMode:", err);
        // Fallback start with generic environment facing mode
        try {
          if (html5QrcodeRef.current) {
            await html5QrcodeRef.current.start(
              { facingMode: "environment" },
              { fps: 12, qrbox: { width: 280, height: 150 } },
              handleBarCodeDetected,
              () => {}
            );
            if (isMounted) setCameraState("SCANNING");
            return;
          }
        } catch (fallbackErr: any) {
          console.error("Camera fallback failed:", fallbackErr);
          if (isMounted) {
            setCameraState("ERROR");
            setErrorMessage(
              fallbackErr?.message || err?.message || "لم نتمكن من الوصول لكاميرا الهاتف. يرجى السماح لصلاحية الكاميرا بالمتصفح."
            );
          }
        }
      }
    }

    initCamera();

    return () => {
      isMounted = false;
      if (html5QrcodeRef.current) {
        if (html5QrcodeRef.current.isScanning) {
          html5QrcodeRef.current.stop().then(() => {
            html5QrcodeRef.current?.clear();
          }).catch(() => {});
        }
      }
    };
  }, []);

  // Handle camera switch
  async function handleSwitchCamera(cameraId: string) {
    if (!html5QrcodeRef.current) return;
    try {
      if (html5QrcodeRef.current.isScanning) {
        await html5QrcodeRef.current.stop();
      }
      setSelectedCameraId(cameraId);
      await html5QrcodeRef.current.start(
        { deviceId: { exact: cameraId } },
        { fps: 15, qrbox: { width: 280, height: 150 } },
        handleBarCodeDetected,
        () => {}
      );
      setCameraState("SCANNING");
    } catch (err: any) {
      console.error("Camera switch error:", err);
    }
  }

  // Core Continuous Barcode Handler
  async function handleBarCodeDetected(decodedText: string) {
    const cleanText = decodedText.trim();
    if (!cleanText) return;

    const now = Date.now();
    // Prevent duplicate scans of the exact same barcode within 1.8 seconds
    if (cleanText === lastBarcodeRef.current && now - lastScanTimeRef.current < 1800) {
      return;
    }

    lastBarcodeRef.current = cleanText;
    lastScanTimeRef.current = now;

    setIsProcessingScan(true);

    try {
      // 1. Search item by barcode in server/database
      const searchRes = await api.searchItems(cleanText);
      const itemsList = Array.isArray(searchRes) ? searchRes : searchRes.items || [];
      const item = itemsList.find(
        (it: any) =>
          it.barcode === cleanText ||
          (it.barcodes && Array.isArray(it.barcodes) && it.barcodes.includes(cleanText))
      ) || itemsList[0];

      if (item) {
        // 2. Automatically record scan entry in current audit task
        await api.recordScan({
          taskId,
          itemId: item.id,
          barcodeScanned: cleanText,
          qtyInUnit: 1,
          locationLabel: activeShelf,
          condition: "NORMAL",
        });

        // 3. Play SUCCESS sound chime!
        playSuccessBeep();

        // 4. Update camera overlay toast banner
        setLastScanned({
          barcode: cleanText,
          name: item.name,
          status: "SUCCESS",
          time: new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        });

        // 5. Signal parent to reload recent list in background
        onScanDone();
      } else {
        // Barcode not found in database!
        playErrorBeep();

        setLastScanned({
          barcode: cleanText,
          name: "غير معروف بالنظام ⚠️",
          status: "ERROR",
          time: new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        });
      }
    } catch (err: any) {
      console.error("Continuous scan recording error:", err);
      playErrorBeep();
      setLastScanned({
        barcode: cleanText,
        name: "خطأ بالاتصال ⚠️",
        status: "ERROR",
        time: new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      });
    } finally {
      setIsProcessingScan(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-ink/90 backdrop-blur-md flex flex-col justify-between p-2 sm:p-4 text-right overflow-hidden" dir="rtl">
      {/* Top Header */}
      <div className="bg-ink border-b border-white/10 p-3 rounded-t-md flex items-center justify-between shrink-0 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-signal animate-ping inline-block" />
          <div>
            <h3 className="font-bold text-sm text-paper flex items-center gap-1.5">
              <span>📷 الجرد المستمر بالكاميرا (تلقائي)</span>
            </h3>
            <div className="text-[11px] text-white/60 font-mono">
              الموقع الحالي: <span className="text-signal font-bold">{activeShelf}</span> ({assignedWarehouseName})
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="bg-white/10 hover:bg-warn text-paper font-bold px-3 py-1.5 rounded text-xs transition-colors cursor-pointer"
        >
          ✕ إغلاق الكاميرا
        </button>
      </div>

      {/* Main Camera Video Viewport Area */}
      <div className="flex-1 relative flex flex-col items-center justify-center my-2 bg-black rounded-md overflow-hidden border border-white/10 shadow-inner">
        {cameraState === "INITIALIZING" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink/80 text-paper z-10 space-y-3">
            <div className="w-8 h-8 border-4 border-signal border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold">جاري فتح كاميرا الهاتف للـجـرد...</p>
          </div>
        )}

        {cameraState === "ERROR" && (
          <div className="p-6 text-center text-paper max-w-sm space-y-3 z-10">
            <div className="text-3xl">⚠️</div>
            <h4 className="font-bold text-sm text-warn">تعذر تشغيل الكاميرا</h4>
            <p className="text-xs text-white/80 leading-relaxed">{errorMessage}</p>
            <button
              type="button"
              onClick={onClose}
              className="bg-signal text-paper font-bold px-4 py-2 rounded text-xs hover:bg-white hover:text-ink transition-colors cursor-pointer mt-2"
            >
              إغلاق واستخدام قارئ الباركود اليدوي
            </button>
          </div>
        )}

        {/* Video reader DOM element for html5-qrcode */}
        <div id="continuous-camera-reader" className="w-full h-full max-h-[60vh] object-cover" />

        {/* Floating Scan Result Toast Barcode Card */}
        {lastScanned && (
          <div
            className={`absolute top-3 left-3 right-3 p-3 rounded-md shadow-2xl border backdrop-blur-md transition-all duration-300 z-20 ${
              lastScanned.status === "SUCCESS"
                ? "bg-good/90 text-white border-good"
                : "bg-warn/90 text-white border-warn animate-bounce"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold">
              <div className="flex items-center gap-2">
                <span className="text-base">{lastScanned.status === "SUCCESS" ? "✅" : "⚠️"}</span>
                <div>
                  <div className="text-sm font-bold truncate max-w-[200px]">{lastScanned.name}</div>
                  <div className="font-mono text-[11px] opacity-90">الباركود: {lastScanned.barcode}</div>
                </div>
              </div>
              <div className="text-left shrink-0">
                <span className="bg-black/30 px-2 py-0.5 rounded text-[10px] font-mono block">
                  {lastScanned.time}
                </span>
                {lastScanned.status === "SUCCESS" && (
                  <span className="text-[11px] font-extrabold text-white block mt-0.5">+1 قطعة</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Camera Target Scan Frame Reticle */}
        {cameraState === "SCANNING" && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-64 h-36 border-2 border-signal/80 rounded-lg relative shadow-[0_0_15px_rgba(255,87,34,0.5)]">
              <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-signal -mt-1 -mr-1" />
              <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-signal -mt-1 -ml-1" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-signal -mb-1 -mr-1" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-signal -mb-1 -ml-1" />
              {/* Laser sweep animation line */}
              <div className="w-full h-0.5 bg-signal shadow-[0_0_8px_#ff5722] absolute top-1/2 -translate-y-1/2 animate-pulse" />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Camera Selector & Instructions */}
      <div className="bg-ink border-t border-white/10 p-3 rounded-b-md flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="text-[11px] text-white/70 font-medium">
          💡 <span className="font-bold text-white">طريقة العمل:</span> مَرّر باركود المواد متتالياً أمام الكاميرا لمسحها تلقائياً بدون توقف.
        </div>

        {cameras.length > 1 && (
          <div className="flex items-center gap-1.5 text-xs text-white">
            <span>📷 الكاميرا:</span>
            <select
              value={selectedCameraId}
              onChange={(e) => handleSwitchCamera(e.target.value)}
              className="bg-white/10 border border-white/20 text-white rounded px-2 py-1 text-xs focus:outline-none cursor-pointer"
            >
              {cameras.map((c, idx) => (
                <option key={c.id} value={c.id} className="bg-ink text-paper">
                  {c.label || `كاميرا ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
