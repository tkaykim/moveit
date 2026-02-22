package com.moveit.app;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Message;
import android.util.Log;
import android.view.ViewGroup;
import android.webkit.URLUtil;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.widget.FrameLayout;
import androidx.appcompat.app.AppCompatActivity;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;
import java.net.URISyntaxException;

/**
 * 결제 등 window.open() 시 외부 브라우저로 나가지 않고 앱 내 WebView에서만 열기 위해
 * 새 창 요청을 오버레이 WebView로 처리하고, 우리 도메인(success/fail)으로 돌아오면
 * 메인 WebView로 전환해 세션이 유지된 상태로 보여줌.
 */
public class MoveitWebChromeClient extends BridgeWebChromeClient {

    private final Bridge bridge;
    private FrameLayout overlayContainer;
    private WebView overlayWebView;

    public MoveitWebChromeClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
    }

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
        Log.d("MoveitPay", "[Chrome] onCreateWindow isUserGesture=" + isUserGesture);
        if (resultMsg == null || resultMsg.obj == null) {
            return false;
        }

        WebView mainWebView = bridge.getWebView();
        if (mainWebView == null) {
            return false;
        }

        AppCompatActivity activity = (AppCompatActivity) bridge.getContext();
        if (activity == null) {
            return false;
        }

        // 오버레이용 WebView 생성 (결제 창을 앱 내에서 표시)
        overlayWebView = new WebView(activity);
        overlayWebView.setLayoutParams(new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        overlayWebView.getSettings().setJavaScriptEnabled(true);
        overlayWebView.getSettings().setSupportMultipleWindows(true);
        overlayWebView.getSettings().setDomStorageEnabled(true);
        overlayWebView.getSettings().setJavaScriptCanOpenWindowsAutomatically(true);
        overlayWebView.setBackgroundColor(Color.WHITE);

        // 우리 앱 도메인으로 로드되면 메인 WebView로 옮기고 오버레이 제거
        String appUrl = bridge.getAppUrl();
        Uri appUri = appUrl != null ? Uri.parse(appUrl) : null;
        String appHost = appUri != null ? appUri.getHost() : null;

        overlayWebView.setWebViewClient(new android.webkit.WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView w, WebResourceRequest request) {
                Uri uri = request != null ? request.getUrl() : null;
                if (uri == null) return false;
                return handleOverlayUrl(w, uri.toString(), uri.getHost());
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView w, String url) {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
                    Uri u = url != null ? Uri.parse(url) : null;
                    String host = u != null ? u.getHost() : null;
                    return handleOverlayUrl(w, url, host);
                }
                return super.shouldOverrideUrlLoading(w, url);
            }

            private boolean handleOverlayUrl(WebView w, String url, String host) {
                if (url == null) return false;
                if (!url.startsWith("http://") && !url.startsWith("https://")) {
                    Log.d("MoveitPay", "[Overlay] handleUrl: " + url);
                }
                if (url.startsWith("intent:")) {
                    return handleIntentUrlInOverlay(activity, w, url);
                }
                if (!URLUtil.isNetworkUrl(url) && !URLUtil.isJavaScriptUrl(url)) {
                    return handleCustomSchemeInOverlay(activity, url);
                }
                if (appHost != null && host != null && appHost.equalsIgnoreCase(host)) {
                    Log.d("MoveitPay", "[Overlay] return to app: " + url);
                    activity.runOnUiThread(() -> {
                        mainWebView.loadUrl(url);
                        removeOverlay();
                    });
                    return true;
                }
                return false;
            }

            /**
             * shouldOverrideUrlLoading이 호출되지 않고 onPageStarted로 intent/커스텀 스킴이 들어오는 케이스 처리.
             * (삼성카드·현대카드 앱카드 등 일부 카드사 페이지에서 발생하는 알려진 Android WebView 동작)
             */
            @Override
            public void onPageStarted(WebView w, String url, Bitmap favicon) {
                if (url != null
                        && !url.startsWith("http://")
                        && !url.startsWith("https://")
                        && !url.startsWith("about:")
                        && !URLUtil.isJavaScriptUrl(url)) {
                    Log.d("MoveitPay", "[Overlay] onPageStarted scheme: " + url);
                    w.stopLoading();
                    Uri u = Uri.parse(url);
                    handleOverlayUrl(w, url, u.getHost());
                }
            }
        });

        // 결제 페이지 내부에서 "다음" 등으로 또 window.open() 하면 여기서 처리.
        // 같은 오버레이 WebView에 로드해 두어, 결제 전체가 앱 안에서만 진행되게 함.
        overlayWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                if (resultMsg != null && resultMsg.obj != null && overlayWebView != null) {
                    WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                    transport.setWebView(overlayWebView);
                    resultMsg.sendToTarget();
                    return true;
                }
                return false;
            }

            @Override
            public void onCloseWindow(WebView w) {
                activity.runOnUiThread(() -> removeOverlay());
            }
        });

        overlayContainer = new FrameLayout(activity);
        overlayContainer.setLayoutParams(new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        overlayContainer.setBackgroundColor(Color.WHITE);
        overlayContainer.addView(overlayWebView);

        activity.runOnUiThread(() -> {
            ViewGroup root = activity.findViewById(android.R.id.content);
            if (root != null) {
                root.addView(overlayContainer);
            }
        });

        WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
        transport.setWebView(overlayWebView);
        resultMsg.sendToTarget();
        return true;
    }

    /**
     * hdcardappcardansimclick://, ispmobile:// 등 커스텀 스킴 → 카드사 앱 실행 (토스 웹뷰 가이드).
     */
    private static boolean handleCustomSchemeInOverlay(AppCompatActivity activity, String url) {
        Log.d("MoveitPay", "[Overlay] customScheme: " + url);
        try {
            Uri schemeUri = Uri.parse(url);
            Intent intent = new Intent(Intent.ACTION_VIEW, schemeUri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
            Log.d("MoveitPay", "[Overlay] customScheme startActivity OK");
        } catch (ActivityNotFoundException e) {
            Log.e("MoveitPay", "[Overlay] customScheme ActivityNotFound: " + url + " | " + e.getMessage());
        } catch (Exception e) {
            Log.e("MoveitPay", "[Overlay] customScheme ERR: " + url + " | " + e.getMessage());
        }
        return true; // WebView에 ERR_UNKNOWN_URL_SCHEME 뜨지 않도록
    }

    /**
     * 토스페이먼츠 웹뷰 연동 가이드: intent 파싱 후 카드사 앱 실행, 없으면 fallback URL을 오버레이에서 로드, 없으면 마켓 이동.
     */
    private static boolean handleIntentUrlInOverlay(AppCompatActivity activity, WebView overlay, String url) {
        Log.d("MoveitPay", "[Overlay] intentUrl: " + url);
        try {
            Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            Log.d("MoveitPay", "[Overlay] intent pkg=" + intent.getPackage() + " scheme=" + (intent.getData() != null ? intent.getData().getScheme() : "null"));
            try {
                activity.startActivity(intent);
                Log.d("MoveitPay", "[Overlay] intent startActivity OK");
                return true;
            } catch (ActivityNotFoundException e1) {
                Log.e("MoveitPay", "[Overlay] intent ActivityNotFound: " + e1.getMessage());
                // 앱 미설치 또는 Android 11+ 가시성 문제 → fallback 시도
            }
            String fallbackUrl = intent.getStringExtra("browser_fallback_url");
            if (fallbackUrl == null) fallbackUrl = intent.getStringExtra("S.browser_fallback_url");
            if (fallbackUrl != null) {
                Log.d("MoveitPay", "[Overlay] intent fallback: " + fallbackUrl);
                overlay.loadUrl(fallbackUrl);
                return true;
            }
            if (intent.getPackage() != null) {
                Log.d("MoveitPay", "[Overlay] intent market: " + intent.getPackage());
                try {
                    activity.startActivity(new Intent(Intent.ACTION_VIEW,
                        Uri.parse("market://details?id=" + intent.getPackage())));
                } catch (ActivityNotFoundException e2) {
                    // 마켓도 없음
                }
                return true;
            }
        } catch (URISyntaxException e) {
            Log.e("MoveitPay", "[Overlay] intent URISyntax: " + e.getMessage());
        } catch (Exception e) {
            Log.e("MoveitPay", "[Overlay] intent ERR: " + e.getMessage());
        }
        return false;
    }

    private void removeOverlay() {
        if (overlayContainer != null && overlayContainer.getParent() != null) {
            ((ViewGroup) overlayContainer.getParent()).removeView(overlayContainer);
            overlayContainer = null;
        }
        overlayWebView = null;
    }

    /** MainActivity에서 moveitapp:// 복귀 시 결제 오버레이를 정리하기 위해 외부에서 호출. */
    public void removeOverlayFromMainThread() {
        AppCompatActivity activity = (AppCompatActivity) bridge.getContext();
        if (activity == null) return;
        activity.runOnUiThread(this::removeOverlay);
    }
}
