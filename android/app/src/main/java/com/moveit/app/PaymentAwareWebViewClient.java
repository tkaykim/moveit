package com.moveit.app;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * 토스페이먼츠/카드사 앱 호출 시 외부 브라우저 이탈 방지.
 * intent://, ispmobile://, kb-acp:// 등 금융 앱 스킴을 가로채어 해당 앱만 실행.
 */
public class PaymentAwareWebViewClient extends WebViewClient {

    private static final String[] PAYMENT_SCHEMES = {
            "intent", "ispmobile", "kb-acp", "kbbank", "newliiv", "liivbank",
            "supertoss", "kakaobank", "shinhan-sr-ansimclick", "smshinhanansimclick",
            "samsungpay", "mpocket.", "wooricard", "newsmartpib"
    };

    private final WebViewClient delegate;

    public PaymentAwareWebViewClient(WebViewClient delegate) {
        this.delegate = delegate;
    }

    private boolean isPaymentScheme(String url) {
        if (url == null) return false;
        String lower = url.toLowerCase();
        for (String scheme : PAYMENT_SCHEMES) {
            if (lower.startsWith(scheme + ":") || lower.contains("://" + scheme)) {
                return true;
            }
        }
        return lower.startsWith("intent://");
    }

    @Override
    @SuppressLint("QueryPermissionsNeeded")
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        String url = request.getUrl() != null ? request.getUrl().toString() : null;
        if (url == null) return delegate != null && delegate.shouldOverrideUrlLoading(view, request);

        if (isPaymentScheme(url)) {
            try {
                Intent intent;
                if (url.startsWith("intent://")) {
                    intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                    intent.addCategory(Intent.CATEGORY_BROWSABLE);
                    intent.setComponent(null);
                } else {
                    intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                }
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                view.getContext().startActivity(intent);
            } catch (ActivityNotFoundException e) {
                // 앱 미설치 시 무시 (토스가 대체 플로우 제공)
            } catch (Exception e) {
                // parseUri 실패 시 무시
            }
            return true;
        }

        return delegate != null && delegate.shouldOverrideUrlLoading(view, request);
    }

    @Override
    @SuppressLint("QueryPermissionsNeeded")
    public boolean shouldOverrideUrlLoading(WebView view, String url) {
        if (url == null) return delegate != null && delegate.shouldOverrideUrlLoading(view, url);

        if (isPaymentScheme(url)) {
            try {
                Intent intent;
                if (url.startsWith("intent://")) {
                    intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                    intent.addCategory(Intent.CATEGORY_BROWSABLE);
                    intent.setComponent(null);
                } else {
                    intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                }
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                view.getContext().startActivity(intent);
            } catch (ActivityNotFoundException e) {
            } catch (Exception e) {
            }
            return true;
        }

        return delegate != null && delegate.shouldOverrideUrlLoading(view, url);
    }
}
