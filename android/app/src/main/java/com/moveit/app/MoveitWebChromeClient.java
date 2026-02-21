package com.moveit.app;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.net.Uri;
import android.os.Message;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.widget.FrameLayout;
import androidx.appcompat.app.AppCompatActivity;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;

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
        overlayWebView.setBackgroundColor(Color.WHITE);

        // 우리 앱 도메인으로 로드되면 메인 WebView로 옮기고 오버레이 제거
        String appUrl = bridge.getAppUrl();
        Uri appUri = appUrl != null ? Uri.parse(appUrl) : null;
        String appHost = appUri != null ? appUri.getHost() : null;

        overlayWebView.setWebViewClient(new android.webkit.WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView w, android.webkit.WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri != null && appHost != null && appHost.equalsIgnoreCase(uri.getHost())) {
                    // success/fail 등 우리 도메인 → 메인 WebView에서 열어 세션 유지
                    activity.runOnUiThread(() -> {
                        mainWebView.loadUrl(uri.toString());
                        removeOverlay();
                    });
                    return true;
                }
                return false;
            }
        });

        overlayWebView.setWebChromeClient(new WebChromeClient() {
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

    private void removeOverlay() {
        if (overlayContainer != null && overlayContainer.getParent() != null) {
            ((ViewGroup) overlayContainer.getParent()).removeView(overlayContainer);
            overlayContainer = null;
        }
        overlayWebView = null;
    }
}
