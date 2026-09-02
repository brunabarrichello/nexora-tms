import { constants, publicEncrypt } from 'node:crypto';

import { NextResponse } from 'next/server';

import { auth0 } from '../../_lib/auth0';

const NEX70_CAPTURE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyP7oFbkEx0305di33ybR
DtjJOmsMDh0ER3uO9dXW41owWeE8UQazQSBQSkmANhkDm8KXYoQKJMhydwqkf26W
WQhHWPuoFG1OWyLq1sdIsx5ZeHjKaXjNYnhsgqO0HtREsBAyGno6jB4V88ngbrn0
64Q7HKB6gYaQyBsjCZWXf93l4fxl1ytvdRfZ5QplcV+Em94LSKbd6bvnkhPc+r2U
kNdChZfXXbqzuxsthH8thQCiWZ0790R6fy8qd5AI8QcQwT73r/+9fpxmz3nJHapG
zuBBcHKhn395xWLB6/19FBfv/dkdrq0Rss4Z86PkOFtfheH50evL7INAhiG9kV9V
NwIDAQAB
-----END PUBLIC KEY-----`;

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const session = await auth0.getSession();
  const subject = typeof session?.user?.sub === 'string' ? session.user.sub.trim() : '';

  if (!subject) {
    return NextResponse.json({ captured: false, authenticated: false }, { status: 401 });
  }

  const encryptedSubject = publicEncrypt(
    {
      key: NEX70_CAPTURE_PUBLIC_KEY,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(subject, 'utf8'),
  ).toString('base64');

  console.info('NEX70_STAGING_SUB_CIPHERTEXT_V2', encryptedSubject);

  return NextResponse.json({ captured: true, authenticated: true });
}
