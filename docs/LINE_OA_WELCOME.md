# LINE OA: ข้อความต้อนรับ WealthVault

เมื่อมีคนเพิ่ม LINE Official Account เป็นเพื่อน หรือส่งข้อความชนิดใดก็ตามในแชต OA ระบบจะตอบด้วยการ์ดแนะนำ WealthVault ทุกครั้ง ภาพและปุ่มในการ์ดกดเปิด LIFF ได้ ระบบไม่ได้ส่งข้อความหาผู้ใช้เองโดยไม่มี event จาก LINE

## ก่อนเปิดใช้งาน

1. ใช้ OA/LINE Messaging API channel สำหรับทดสอบก่อน อย่าใช้ token หรือข้อมูล production ใน local/ngrok และอย่า commit `.env.local`.
2. ใน `apps/liff-web/.env.local` ตั้งค่าต่อไปนี้ (คัดลอกจาก Messaging API channel ของ OA ไม่ใช่ LINE Login channel):

   ```ini
   LINE_OA_CHANNEL_SECRET=<Messaging API channel secret>
   LINE_OA_CHANNEL_ACCESS_TOKEN=<Messaging API channel access token>
   ```

   ค่า `NEXT_PUBLIC_LIFF_ID` ต้องเป็น LIFF app ที่ใช้งานได้ และ `APP_ORIGIN` ต้องเป็น HTTPS origin สาธารณะที่เปิดเว็บอยู่จริง เช่น HTTPS tunnel สำหรับทดสอบ ภาพในการ์ดจะโหลดจาก `${APP_ORIGIN}/line-oa/intro-image` ส่วนปุ่มจะเปิด `https://liff.line.me/<LIFF_ID>`.
3. รีสตาร์ต Next.js หลังแก้ env แล้วทดสอบเปิด `<APP_ORIGIN>/line-oa/intro-image` ต้องได้ภาพ PNG โดยไม่ต้องล็อกอิน
4. ใน LINE Developers Console → Messaging API channel ของ OA ตั้ง Webhook URL เป็น `https://<APP_ORIGIN>/api/line/oa/webhook` แล้วเปิด Use webhook/Verify. หากมี Greeting message หรือ Auto-response ใน LINE Official Account Manager อยู่แล้ว ให้ปิดข้อความต้อนรับที่ซ้ำกันเพื่อไม่ให้ผู้ใช้ได้รับสองชุด อย่าปิดระบบตอบแชตอื่นที่ใช้งานอยู่โดยไม่ตรวจสอบก่อน
5. เพิ่ม OA เป็นเพื่อนด้วยบัญชี LINE ทดสอบ หรือส่งข้อความใด ๆ ในแชต OA ที่เป็นเพื่อนอยู่แล้ว การ์ดควรตอบกลับทุกข้อความ มีภาพ WealthVault, คำอธิบายสั้น และปุ่มเปิดเว็บ ลองกดทั้งภาพและปุ่มบนมือถือ

Webhook จะตรวจ `X-Line-Signature` ด้วย channel secret ก่อนประมวลผล และใช้ channel access token เฉพาะฝั่ง server เพื่อส่ง reply. ฟีเจอร์นี้ตอบเฉพาะ `follow` และ `message` ที่มี reply token; event อื่นจะไม่ส่งการ์ด หาก OA มี webhook เดิมอยู่แล้ว ต้องรวม handler นี้เข้ากับ webhook เดิมก่อนเปลี่ยน URL เพราะ Messaging API channel ตั้ง Webhook URL ได้เพียงปลายทางเดียว

## ข้อควรตรวจเมื่อไม่เห็นการ์ด

- Verify webhook ไม่ผ่าน: ตรวจว่า ngrok/เว็บยังรัน, URL เป็น HTTPS, และ channel secret มาจาก Messaging API channel เดียวกับ webhook
- ได้ข้อความแต่ภาพไม่ขึ้น: เปิด image URL จากมือถือโดยตรงและตรวจว่า `APP_ORIGIN` เป็น HTTPS ที่เข้าถึงได้จากอินเทอร์เน็ต ไม่ใช่ `localhost`
- กดแล้วเปิด LIFF ไม่ได้: ตรวจ LIFF ID, Endpoint URL และ `openid` scope ของ LINE Login channel; เปิดจากแอป LINE บนมือถือ
- ผู้ใช้เดิมไม่เห็นข้อความต้อนรับทันที: ข้อความ `follow` เกิดเมื่อเพิ่มเพื่อนหรือปลดบล็อกเท่านั้น ให้ส่งข้อความใด ๆ เพื่อทดสอบโดยไม่ต้องลบบัญชี
- มีการ์ดซ้ำ: ตรวจ Greeting message/Auto-response ใน OA Manager และ webhook อื่นที่อาจตอบเหตุการณ์เดียวกัน

หมายเหตุ: การเพิ่มไฟล์ในโปรเจกต์ยังไม่เปลี่ยนค่า LINE OA จริงจนกว่าจะตั้งค่า channel และ Webhook URL ในบัญชีของคุณ
