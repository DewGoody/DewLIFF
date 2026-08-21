'use client'

import { useEffect, useState } from 'react'
import liff from '@line/liff'

type Profile = { userId: string; displayName: string; pictureUrl?: string }

type Status =
  | { kind: 'loading' }
  | { kind: 'missing_id' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; profile: Profile }

export default function LiffPage() {
  const [status, setStatus] = useState<Status>({ kind: 'loading' })

  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID
    if (!liffId) {
      setStatus({ kind: 'missing_id' })
      return
    }

    liff
      .init({ liffId })
      .then(async () => {
        if (!liff.isLoggedIn()) {
          liff.login()
          return
        }
        const profile = await liff.getProfile()
        setStatus({ kind: 'ready', profile })
      })
      .catch((err: unknown) => {
        setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
      })
  }, [])

  return (
    <main style={{ padding: 24 }}>
      <h1>ทดสอบ LIFF</h1>

      {status.kind === 'loading' && <p>กำลังเชื่อมต่อ LIFF…</p>}

      {status.kind === 'missing_id' && (
        <p>
          ยังไม่ได้ตั้งค่า <code>NEXT_PUBLIC_LIFF_ID</code> — ใส่ liff-id จากแท็บ LIFF ของ LINE
          Login channel ลงใน <code>.env.local</code> (ดูตัวอย่างใน <code>.env.example</code>)
        </p>
      )}

      {status.kind === 'error' && <p style={{ color: 'crimson' }}>เชื่อมต่อ LIFF ไม่สำเร็จ: {status.message}</p>}

      {status.kind === 'ready' && (
        <div>
          {status.profile.pictureUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={status.profile.pictureUrl}
              alt=""
              width={72}
              height={72}
              style={{ borderRadius: '50%' }}
            />
          )}
          <p>สวัสดี {status.profile.displayName}</p>
          <p style={{ fontSize: 12, color: '#666' }}>userId: {status.profile.userId}</p>
        </div>
      )}
    </main>
  )
}
