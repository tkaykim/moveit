package com.moveit.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

/**
 * 결제/금융 앱 스킴(intent://, ispmobile:// 등)을 가로채서
 * 외부 브라우저가 아닌 해당 앱만 실행하도록 합니다.
 */
public class PaymentIntentWebViewClient extends BridgeWebViewClient {

    private static final String[] FINANCE_SCHEMES = {
        "intent",
        "ispmobile",
        "kftc-bankpay",
        "bankpay",
        "kb-acp",
        "mpocket.online.ansimclick",
        "lottesmartpay",
        "lpay",
        "cloudpay",
        "payco",
        "hanawallet"
    };

    public PaymentIntentWebViewClient(Bridge bridge) {
        super(bridge);
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri url = request.getUrl();
        if (url == null) return super.shouldOverrideUrlLoading(view, request);

        String scheme = url.getScheme();
        if (scheme == null) return super.shouldOverrideUrlLoading(view, request);

        for (String finance : FINANCE_SCHEMES) {
            if (finance.equalsIgnoreCase(scheme)) {
                return launchPaymentApp(view.getContext(), url, scheme);
            }
        }
        return super.shouldOverrideUrlLoading(view, request);
    }

    private boolean launchPaymentApp(android.content.Context context, Uri url, String scheme) {
        try {
            if ("intent".equalsIgnoreCase(scheme)) {
                Intent intent = Intent.parseUri(url.toString(), Intent.URI_INTENT_SCHEME);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
            } else {
                Intent intent = new Intent(Intent.ACTION_VIEW, url);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
            }
            return true;
        } catch (ActivityNotFoundException e) {
            return true;
        } catch (Exception e) {
            return true;
        }
    }
}
