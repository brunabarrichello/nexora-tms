import { constants, publicEncrypt } from 'node:crypto';

import { NextResponse } from 'next/server';

import { auth0 } from '../../_lib/auth0';

const NEX70_CAPTURE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApnEz0Iksv4VddPc19vz1
ihe9FparHXNnzuW/EQWhAnLDSVBJfDGB83zXPuiEgvrm2oW95PwHx2q/gnhCitmA
eMNVMGrwCzGyW4r5IK0z0B7cnPHUtkil1qnhxkW0bqHnBwudAXyPtmIlualo2Q5N
Z0P3n7NWt943vqkcr8iCj7JxfhKy3QwegS/zlppmsu1iGTWuKPoho6K6ErQsmLPF
0XQ3MnUMEIaApWM6ripuI5nvKB4p41umIyDCVYgX/OkrF6kE2E+yvzYkN6bJi5Jb
hywAfe9foMvSaoO8ltcQ26GT6Ti3JcWdBmmWt0gP+RIVVN3BmhyG1JzFOjk87zIk
uQIDAQAB
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

  console.info('NEX70_STAGING_SUB_CIPHERTEXT', encryptedSubject);

  return NextResponse.json({ captured: true, authenticated: true });
}
