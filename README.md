# DewLIFF

โปรเจกต์ทดลอง LIFF (LINE Front-end Framework) แยกจาก LineKit — คนละ repo คนละ deploy

## เริ่มพัฒนา

```bash
npm install
cp .env.example .env.local   # ใส่ NEXT_PUBLIC_LIFF_ID ของตัวเอง
npm run dev
```

## ตั้งค่า LIFF

1. LINE Developers Console → provider เดิม → สร้าง **LINE Login channel** ใหม่ (LIFF ผูกกับ Messaging API channel ตรงๆ ไม่ได้อีกต่อไป)
2. ในแชนแนลนั้น แท็บ **LIFF** → Add → ตั้ง Endpoint URL เป็น URL ที่ deploy ของโปรเจกต์นี้ + `/liff`
3. คัดลอก liff-id มาใส่ `.env.local`
4. เปิดทดสอบผ่านลิงก์ `https://liff.line.me/<liff-id>` จากในแอป LINE (เปิดจาก browser ปกติพฤติกรรมจะไม่เหมือนเปิดในแอป)

## Deploy

Import repo นี้เข้า Vercel แยกต่างหากจาก LineKit ตั้ง environment variable `NEXT_PUBLIC_LIFF_ID` แล้วอัปเดต Endpoint URL ในหน้า LIFF ให้ตรงกับโดเมนที่ได้
