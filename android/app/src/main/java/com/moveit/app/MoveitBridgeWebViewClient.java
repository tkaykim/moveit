package com.moveit.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import android.webkit.URLUtil;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.net.URISyntaxException;

/**
 * 메인 WebView에서 결제·카드사 등 어떤 웹 URL도 외부 브라우저로 열지 않고 앱 내에서만 로드.
 * (카드사 도메인 나열 없이, http/https는 전부 웹뷰에서 로드.)
 * intent:// 는 토스 웹뷰 연동 가이드대로 카드사 앱 실행 또는 fallback 처리.
 */
public class MoveitBridgeWebViewClient extends BridgeWebViewClient {

    public MoveitBridgeWebViewClient(Bridge bridge) {
        super(bridge);
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri uri = request != null ? request.getUrl() : null;
        if (uri == null) return super.shouldOverrideUrlLoading(view, request);
        return handleUrl(view, uri.toString());
    }

    @SuppressWarnings("deprecation")
    @Override
    public boolean shouldOverrideUrlLoading(WebView view, String url) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            return handleUrl(view, url);
        }
        return super.shouldOverrideUrlLoading(view, url);
    }

    /**
     * shouldOverrideUrlLoading이 호출되지 않고 onPageStarted로 intent/커스텀 스킴이 들어오는 케이스 처리.
     * (삼성카드·현대카드 앱카드 등 일부 카드사 페이지에서 발생하는 알려진 Android WebView 동작)
     */
    @Override
    public void onPageStarted(WebView view, String url, Bitmap favicon) {
        if (url != null
                && !url.startsWith("http://")
                && !url.startsWith("https://")
                && !url.startsWith("about:")
                && !URLUtil.isJavaScriptUrl(url)) {
            Log.d("MoveitPay", "[Bridge] onPageStarted scheme: " + url);
            view.stopLoading();
            handleUrl(view, url);
            return;
        }
        super.onPageStarted(view, url, favicon);
    }

    /** 공통 URL 처리 (토스 웹뷰 가이드: intent/커스텀 스킴 → 카드사·ISP 앱 실행). 리다이렉트 등 모든 로드 경로에서 호출되도록 deprecated 오버로드 사용. */
    private boolean handleUrl(WebView view, String url) {
        if (url == null) return false;

        if (url.startsWith("http://") || url.startsWith("https://")) {
            return false;
        }
        Log.d("MoveitPay", "[Bridge] handleUrl: " + url);
        if (url.startsWith("intent:")) {
            return handleIntentUrl(view, url);
        }
        if (!URLUtil.isNetworkUrl(url) && !URLUtil.isJavaScriptUrl(url)) {
            try {
                Uri schemeUri = Uri.parse(url);
                Intent schemeIntent = new Intent(Intent.ACTION_VIEW, schemeUri);
                schemeIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                view.getContext().startActivity(schemeIntent);
                Log.d("MoveitPay", "[Bridge] startActivity OK: " + url);
            } catch (ActivityNotFoundException e) {
                Log.e("MoveitPay", "[Bridge] ActivityNotFound: " + url + " | " + e.getMessage());
            } catch (Exception e) {
                Log.e("MoveitPay", "[Bridge] startActivity ERR: " + url + " | " + e.getMessage());
            }
            return true; // WebView에 ERR_UNKNOWN_URL_SCHEME 뜨지 않도록
        }
        return false;
    }

    /**
     * 토스페이먼츠 웹뷰 연동 가이드: intent 파싱 후 카드사 앱 실행, 없으면 fallback URL 로드, 없으면 마켓 이동.
     */
    private boolean handleIntentUrl(WebView view, String url) {
        Log.d("MoveitPay", "[Bridge] handleIntentUrl: " + url);
        try {
            Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            Log.d("MoveitPay", "[Bridge] intent pkg=" + intent.getPackage() + " scheme=" + (intent.getData() != null ? intent.getData().getScheme() : "null"));
            try {
                view.getContext().startActivity(intent);
                Log.d("MoveitPay", "[Bridge] intent startActivity OK");
                return true;
            } catch (ActivityNotFoundException e1) {
                Log.e("MoveitPay", "[Bridge] intent ActivityNotFound: " + e1.getMessage());
                // 앱 미설치 또는 Android 11+ 가시성 문제 → fallback 시도
            }
            String fallbackUrl = intent.getStringExtra("browser_fallback_url");
            if (fallbackUrl == null) fallbackUrl = intent.getStringExtra("S.browser_fallback_url");
            if (fallbackUrl != null) {
                Log.d("MoveitPay", "[Bridge] intent fallback: " + fallbackUrl);
                view.loadUrl(fallbackUrl);
                return true;
            }
            if (intent.getPackage() != null) {
                Log.d("MoveitPay", "[Bridge] intent market: " + intent.getPackage());
                try {
                    view.getContext().startActivity(new Intent(Intent.ACTION_VIEW,
                        Uri.parse("market://details?id=" + intent.getPackage())));
                } catch (ActivityNotFoundException e2) {
                    // 마켓도 없음
                }
                return true;
            }
        } catch (URISyntaxException e) {
            Log.e("MoveitPay", "[Bridge] intent URISyntax: " + e.getMessage());
        } catch (Exception e) {
            Log.e("MoveitPay", "[Bridge] intent ERR: " + e.getMessage());
        }
        return false;
    }
}
