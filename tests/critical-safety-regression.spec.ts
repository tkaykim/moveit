import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const read = (filePath: string) => fs.readFileSync(path.join(repoRoot, filePath), 'utf8');
const walk = (dirPath: string): string[] =>
  fs.readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return fullPath;
  });

test.describe('critical money and attendance safety regressions', () => {
  test('QR check-in requires an academy admin before mutating attendance', async () => {
    // Regression: QR check-in must not rely only on the scanned member's token.
    const source = read('app/api/attendance/qr-checkin/route.ts');

    expect(source).toContain("import { assertAcademyAdmin }");
    expect(source).toContain('createServiceClient()');

    const permissionCheckIndex = source.indexOf('await assertAcademyAdmin(academyId, authUser.id)');
    const attendanceMutationIndex = source.indexOf(".update({ status: 'COMPLETED' })");
    expect(permissionCheckIndex).toBeGreaterThan(0);
    expect(attendanceMutationIndex).toBeGreaterThan(permissionCheckIndex);
  });

  test('QR generation is explicitly limited to the booking owner', async () => {
    const source = read('app/api/attendance/qr-generate/route.ts');

    expect(source).toContain('booking.user_id !== user.id');
    expect(source).toContain('const tokenUserId = booking.user_id;');
    expect(source).not.toContain('booking.user_id || user.id');
  });

  test('/api/bookings does not trust client-declared payment completion', async () => {
    const source = read('app/api/bookings/route.ts');

    expect(source).toContain('legacyDirectPaymentMethod');
    expect(source).toContain("const finalPaymentStatus = 'PAID';");
    expect(source).toContain('user_ticket_id: selectedUserTicketId');
    expect(source).not.toContain('const isImmediatePayment');
    expect(source).not.toContain('const isCardDemoPayment');
    expect(source).not.toContain('paymentStatus');
    expect(source).not.toContain('user_ticket_id: isImmediatePayment');
  });

  test('academy enrollment UI cannot hard-delete bookings from the client', async () => {
    const viewSource = read('app/academy-admin/components/views/enrollments-view.tsx');
    const menuSource = read('app/academy-admin/components/views/enrollments/enrollment-action-menu.tsx');

    expect(viewSource).not.toContain('.delete()');
    expect(viewSource).not.toContain('const handleDelete = async');
    expect(menuSource).not.toContain('Trash2');
    expect(menuSource).not.toContain('onDelete');
  });

  test('ticket count is restored when post-payment booking creation fails', async () => {
    const tossSource = read('app/api/tickets/payment-confirm/route.ts');
    const bankSource = read('app/api/academy-admin/[academyId]/bank-transfer-confirm/route.ts');

    expect(tossSource).toContain("reason: 'booking_insert_failed'");
    expect(tossSource).toContain("action: 'COUNT_RESTORE'");
    expect(tossSource).toContain("rpc('restore_ticket_count'");

    expect(bankSource).toContain("reason: 'booking_update_failed'");
    expect(bankSource).toContain("reason: 'booking_insert_failed'");
    expect(bankSource).toContain("action: 'COUNT_RESTORE'");
    expect(bankSource).toContain("rpc('restore_ticket_count'");
  });

  test('request-dependent API routes are explicitly dynamic', async () => {
    const apiRoutes = walk(path.join(repoRoot, 'app/api')).filter((filePath) => filePath.endsWith('route.ts'));
    const missingDynamic = apiRoutes
      .filter((filePath) => {
        const source = fs.readFileSync(filePath, 'utf8');
        const usesRequestRuntime =
          /request\.(url|nextUrl)/.test(source) ||
          /new URL\(request\.url\)/.test(source) ||
          /headers\(\)|cookies\(\)/.test(source) ||
          /(getAuthenticatedUser|requireSuperAdmin|getAuthenticatedSupabase)\(request\)/.test(source);
        return usesRequestRuntime && !source.includes("export const dynamic = 'force-dynamic'");
      })
      .map((filePath) => path.relative(repoRoot, filePath));

    expect(missingDynamic).toEqual([]);
  });
});
