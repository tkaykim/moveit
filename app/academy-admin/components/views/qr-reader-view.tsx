"use client";

import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { useAuth } from '@/contexts/AuthContext';
import { ExitQrPasswordModal } from '../exit-qr-password-modal';

import { useState, useEffect, useRef, useCallback } from 'react';
import { QrCode, CheckCircle2, XCircle, Clock, Maximize, Minimize, RotateCcw, SwitchCamera, LayoutDashboard } from 'lucide-react';

interface CheckInLog {
  id: string;
  userName: string;
  className: string;
  startTime?: string;
  checkedInAt: string;
  success: boolean;
  error?: string;
}

interface QrReaderViewProps {
  academyId: string;
}

// BarcodeDetector 타입 (브라우저 네이티브 API)
declare class BarcodeDetector {
  constructor(options?: { formats: string[] });
  detect(image: ImageBitmapSource): Promise<Array<{ rawValue: string }>>;
  static getSupportedFormats(): Promise<string[]>;
}

export function QrReaderView({ academyId }: QrReaderViewProps) {
  const { user } = useAuth();
  const [showExitModal, setShowExitModal] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMethod, setScanMethod] = useState<string>('');
  const [result, setResult] = useState<{
    type: 'success' | 'error' | 'already';
    message: string;
    userName?: string;
    className?: string;
  } | null>(null);
  const [logs, setLogs] = useState<CheckInLog[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tooBright, setTooBright] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const facingModeRef = useRef<'user' | 'environment'>('user');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingRef = useRef(false);
  const mountedRef = useRef(true);

  const handleCheckin = useCallback(async (decodedText: string) => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      const res = await fetchWithAuth('/api/attendance/qr-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: decodedText, academyId }),
      });

      const data = await res.json();
      if (!mountedRef.current) return;

      if (res.ok && data.success) {
        setResult({
          type: 'success',
          message: '출석 완료!',
          userName: data.userName,
          className: data.booking?.className,
        });
        setLogs(prev => [{
          id: Date.now().toString(),
          userName: data.userName,
          className: data.booking?.className || '',
          startTime: data.booking?.startTime,
          checkedInAt: data.checkedInAt,
          success: true,
        }, ...prev].slice(0, 50));
      } else if (res.status === 409 && data.alreadyCheckedIn) {
        setResult({ type: 'already', message: '이미 출석 처리된 예약입니다.' });
      } else {
        setResult({ type: 'error', message: data.error || '출석 처리에 실패했습니다.' });
        setLogs(prev => [{
          id: Date.now().toString(),
          userName: '알 수 없음',
          className: '',
          checkedInAt: new Date().toISOString(),
          success: false,
          error: data.error,
        }, ...prev].slice(0, 50));
      }
    } catch {
      if (!mountedRef.current) return;
      setResult({ type: 'error', message: '네트워크 오류가 발생했습니다.' });
    }

    if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current);
    resultTimeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setResult(null);
      processingRef.current = false;
    }, 4000);
  }, [academyId]);

  const stopScanner = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (mountedRef.current) {
      setScanning(false);
    }
  }, []);

  const startScanner = useCallback(async () => {
    try {
      // 카메라 스트림 획득 (facingModeRef에 따라 전면/후면 카메라 선택)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingModeRef.current,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;

      // 카메라 고급 설정: 연속 초점
      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          const caps = track.getCapabilities() as any;
          const adv: any = {};
          if (caps?.focusMode?.includes('continuous')) adv.focusMode = 'continuous';
          if (caps?.exposureMode?.includes('continuous')) adv.exposureMode = 'continuous';
          if (Object.keys(adv).length > 0) {
            await track.applyConstraints({ advanced: [adv] } as any);
          }
        } catch { /* 미지원 시 무시 */ }
      }

      if (!videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      video.srcObject = stream;
      await video.play();

      if (mountedRef.current) setScanning(true);

      // QR 디코더 준비
      const hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
      let detector: any = null;
      let jsQR: any = null;

      if (hasBarcodeDetector) {
        setScanMethod('native');
        detector = new BarcodeDetector({ formats: ['qr_code'] });
      } else {
        setScanMethod('jsqr');
        try {
          const mod = await import('jsqr');
          jsQR = typeof mod.default === 'function' ? mod.default : mod;
        } catch {
          setResult({ type: 'error', message: 'QR 스캐너를 초기화할 수 없습니다.' });
          return;
        }
      }

      // 축소 캔버스 크기 (성능 최적화)
      const SCAN_W = 640;
      const SCAN_H = 360;
      let detecting = false;

      // 1x1 캔버스: 중앙 밝기 측정용 (drawImage 축소 → 자동 평균)
      const tinyCanvas = document.createElement('canvas');
      tinyCanvas.width = 1;
      tinyCanvas.height = 1;
      const tinyCtx = tinyCanvas.getContext('2d');
      let brightCount = 0; // 연속 밝음 프레임 카운터

      // === 심플한 스캔 루프 ===
      scanIntervalRef.current = setInterval(async () => {
        if (!mountedRef.current || !streamRef.current || detecting) return;
        if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
        if (video.videoWidth === 0 || video.videoHeight === 0) return;

        detecting = true;
        const vw = video.videoWidth;
        const vh = video.videoHeight;

        // 중앙 50% 평균 밝기 측정 (1픽셀 읽기, ~0ms)
        if (tinyCtx) {
          tinyCtx.drawImage(video, vw * 0.25, vh * 0.25, vw * 0.5, vh * 0.5, 0, 0, 1, 1);
          const px = tinyCtx.getImageData(0, 0, 1, 1).data;
          const avg = (px[0] * 77 + px[1] * 150 + px[2] * 29) >> 8;
          if (avg > 200) {
            brightCount++;
            if (brightCount >= 5) setTooBright(true); // 5프레임(~0.6초) 연속 밝으면
          } else {
            brightCount = 0;
            setTooBright(false);
          }
        }

        try {
          let found = false;

          // 1차: 원본 비디오에서 바로 인식 (가장 빠름)
          if (detector) {
            try {
              const barcodes = await detector.detect(video);
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                handleCheckin(barcodes[0].rawValue);
                found = true;
              }
            } catch { /* 무시 */ }
          } else if (jsQR) {
            canvas.width = SCAN_W;
            canvas.height = SCAN_H;
            ctx.drawImage(video, 0, 0, SCAN_W, SCAN_H);
            const imgData = ctx.getImageData(0, 0, SCAN_W, SCAN_H);
            const code = jsQR(imgData.data, SCAN_W, SCAN_H, {
              inversionAttempts: 'attemptBoth',
            });
            if (code?.data?.length) {
              handleCheckin(code.data);
              found = true;
            }
          }

          // 2차: 중앙 60% 크롭 확대 (QR이 작거나 멀 때)
          if (!found) {
            canvas.width = SCAN_W;
            canvas.height = SCAN_H;
            ctx.drawImage(
              video,
              vw * 0.2, vh * 0.2, vw * 0.6, vh * 0.6,
              0, 0, SCAN_W, SCAN_H
            );

            if (detector) {
              const barcodes2 = await detector.detect(canvas);
              if (barcodes2.length > 0 && barcodes2[0].rawValue) {
                handleCheckin(barcodes2[0].rawValue);
                found = true;
              }
            } else if (jsQR) {
              const cropData = ctx.getImageData(0, 0, SCAN_W, SCAN_H);
              const code2 = jsQR(cropData.data, SCAN_W, SCAN_H, {
                inversionAttempts: 'attemptBoth',
              });
              if (code2?.data?.length) {
                handleCheckin(code2.data);
                found = true;
              }
            }
          }

          // 3차: GPU 대비 보정 후 시도 (밝기 문제 대응)
          if (!found) {
            canvas.width = SCAN_W;
            canvas.height = SCAN_H;
            ctx.filter = 'brightness(0.5) contrast(8)';
            ctx.drawImage(video, 0, 0, SCAN_W, SCAN_H);
            ctx.filter = 'none';

            if (detector) {
              const barcodes3 = await detector.detect(canvas);
              if (barcodes3.length > 0 && barcodes3[0].rawValue) {
                handleCheckin(barcodes3[0].rawValue);
              }
            } else if (jsQR) {
              const filteredData = ctx.getImageData(0, 0, SCAN_W, SCAN_H);
              const code3 = jsQR(filteredData.data, SCAN_W, SCAN_H, {
                inversionAttempts: 'attemptBoth',
              });
              if (code3?.data?.length) {
                handleCheckin(code3.data);
              }
            }
          }
        } catch {
          // 무시
        }

        detecting = false;
      }, 120);
    } catch (err) {
      console.error('Camera error:', err);
      if (mountedRef.current) {
        setResult({ type: 'error', message: '카메라를 사용할 수 없습니다. 카메라 권한을 확인해주세요.' });
      }
    }
  }, [handleCheckin]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current);
    };
  }, []);

  const switchCamera = useCallback(() => {
    const newMode = facingModeRef.current === 'user' ? 'environment' : 'user';
    facingModeRef.current = newMode;
    setFacingMode(newMode);
    if (scanning) {
      stopScanner();
      // 약간의 딜레이 후 새 카메라로 재시작
      setTimeout(() => startScanner(), 300);
    }
  }, [scanning, stopScanner, startScanner]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full min-h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950">
      <div className="flex-shrink-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-[#CCFF00]/20 flex items-center justify-center">
              <QrCode size={24} className="text-primary dark:text-[#CCFF00]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-black dark:text-white">QR 출석 리더</h1>
              <p className="text-sm text-neutral-500">학생의 QR 코드를 스캔하여 출석을 처리합니다</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExitModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium text-sm transition-colors"
              title="다른 관리자 메뉴로 이동 (비밀번호 입력 필요)"
            >
              <LayoutDashboard size={18} />
              관리자 메뉴로
            </button>
            <button
              onClick={switchCamera}
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 transition-colors"
              title={facingMode === 'user' ? '후면 카메라로 전환' : '전면 카메라로 전환'}
            >
              <SwitchCamera size={20} />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 transition-colors"
              title={isFullscreen ? '전체 화면 해제' : '전체 화면'}
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto max-w-4xl mx-auto w-full p-6 space-y-6">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <div className="relative">
            <div className={scanning ? 'block' : 'hidden'}>
              <video
                ref={videoRef}
                className="w-full max-h-[480px] object-cover bg-black"
                style={facingMode === 'user' ? { transform: 'scaleX(-1)' } : undefined}
                playsInline
                muted
              />
            </div>
            <canvas ref={canvasRef} className="hidden" />

            {!scanning && (
              <div className="w-full aspect-square max-h-[480px] bg-black flex items-center justify-center">
                <div className="text-center p-8">
                  <QrCode size={64} className="text-neutral-600 mx-auto mb-4" />
                  <p className="text-neutral-400 text-lg mb-6">카메라를 시작하여 QR 스캔을 준비하세요</p>
                  <button
                    onClick={startScanner}
                    className="px-8 py-3 bg-primary dark:bg-[#CCFF00] text-white dark:text-black font-bold rounded-xl hover:opacity-90 transition-opacity text-lg"
                  >
                    스캔 시작
                  </button>
                </div>
              </div>
            )}

            {scanning && !result && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-60 h-60 border-2 border-white/50 rounded-2xl relative">
                  <div className="absolute -top-0.5 -left-0.5 w-8 h-8 border-t-4 border-l-4 border-[#CCFF00] rounded-tl-lg" />
                  <div className="absolute -top-0.5 -right-0.5 w-8 h-8 border-t-4 border-r-4 border-[#CCFF00] rounded-tr-lg" />
                  <div className="absolute -bottom-0.5 -left-0.5 w-8 h-8 border-b-4 border-l-4 border-[#CCFF00] rounded-bl-lg" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-8 h-8 border-b-4 border-r-4 border-[#CCFF00] rounded-br-lg" />
                </div>
              </div>
            )}

            {/* 화면 밝기 경고 오버레이 */}
            {scanning && !result && tooBright && (
              <div className="absolute inset-x-0 top-0 z-20 pointer-events-none flex justify-center pt-4 animate-in fade-in duration-300">
                <div className="bg-red-600/90 backdrop-blur-sm text-white px-5 py-3 rounded-xl shadow-lg max-w-[90%] text-center">
                  <p className="text-sm font-bold">화면이 너무 밝습니다</p>
                  <p className="text-xs mt-1 opacity-90">QR코드 휴대폰 화면의 밝기를 낮춰주세요</p>
                </div>
              </div>
            )}

            {result && (
              <div className={`absolute inset-0 flex items-center justify-center z-10 ${
                result.type === 'success' ? 'bg-green-500/90' :
                result.type === 'already' ? 'bg-yellow-500/90' : 'bg-red-500/90'
              } animate-in fade-in duration-200`}>
                <div className="text-center text-white p-8">
                  {result.type === 'success' ? (
                    <CheckCircle2 size={80} className="mx-auto mb-4" />
                  ) : (
                    <XCircle size={80} className="mx-auto mb-4" />
                  )}
                  <div className="text-3xl font-bold mb-2">{result.message}</div>
                  {result.userName && <div className="text-xl opacity-90">{result.userName}</div>}
                  {result.className && <div className="text-lg opacity-80 mt-1">{result.className}</div>}
                </div>
              </div>
            )}
          </div>

          {scanning && (
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  스캔 대기 중...
                </span>
                {scanMethod && (
                  <span className="text-xs text-neutral-400 ml-1">
                    ({scanMethod === 'native' ? '네이티브' : 'jsQR'})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={switchCamera}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                  title={facingMode === 'user' ? '후면 카메라로 전환' : '전면 카메라로 전환'}
                >
                  <SwitchCamera size={14} /> {facingMode === 'user' ? '전면' : '후면'}
                </button>
                <button
                  onClick={() => { stopScanner(); setTimeout(() => startScanner(), 300); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                >
                  <RotateCcw size={14} /> 재시작
                </button>
                <button
                  onClick={stopScanner}
                  className="px-4 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  중지
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
            <h2 className="text-lg font-bold text-black dark:text-white flex items-center gap-2">
              <Clock size={20} /> 최근 출석 기록
            </h2>
          </div>
          {logs.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-neutral-400 text-sm">아직 출석 기록이 없습니다</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {logs.map((log) => (
                <div key={log.id} className="px-6 py-3 flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    log.success ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
                  }`}>
                    {log.success ? (
                      <CheckCircle2 size={16} className="text-green-600 dark:text-green-400" />
                    ) : (
                      <XCircle size={16} className="text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-black dark:text-white truncate">
                      {log.success ? log.userName : '오류'}
                    </div>
                    <div className="text-xs text-neutral-500 truncate">
                      {log.success ? log.className : log.error}
                    </div>
                  </div>
                  <div className="text-xs text-neutral-400 font-mono flex-shrink-0">
                    {formatTime(log.checkedInAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ExitQrPasswordModal
        isOpen={showExitModal}
        onClose={() => setShowExitModal(false)}
        email={user?.email ?? ''}
        academyId={academyId}
      />
    </div>
  );
}
