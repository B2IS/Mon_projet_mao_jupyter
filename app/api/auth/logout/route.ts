import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/authTypes';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: SESSION_COOKIE, value: '', httpOnly: true, maxAge: 0, path: '/' });
  return res;
}
