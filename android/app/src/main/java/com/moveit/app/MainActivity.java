package com.moveit.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannel();
        applyNavigationBarInsets();
        setupPaymentIntentWebViewClient();
    }

    /**
     * 결제/금융 앱 스킴(intent://, ispmobile:// 등)을 가로채서
     * 외부 브라우저가 아닌 해당 앱만 실행하도록 WebViewClient 교체.
     */
    private void setupPaymentIntentWebViewClient() {
        runOnUiThread(() -> {
            Bridge bridge = getBridge();
            if (bridge != null) {
                bridge.setWebViewClient(new PaymentIntentWebViewClient(bridge));
            }
        });
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                "moveit_default",
                "MOVEIT 알림",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("MOVEIT 앱 푸시 알림");
            channel.enableVibration(true);
            channel.setShowBadge(true);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void applyNavigationBarInsets() {
        View contentView = findViewById(android.R.id.content);
        if (contentView == null) return;

        ViewCompat.setOnApplyWindowInsetsListener(contentView, (v, windowInsets) -> {
            Insets navBarInsets = windowInsets.getInsets(WindowInsetsCompat.Type.navigationBars());
            v.setPadding(
                v.getPaddingLeft(),
                v.getPaddingTop(),
                v.getPaddingRight(),
                navBarInsets.bottom
            );
            return windowInsets;
        });
    }
}
