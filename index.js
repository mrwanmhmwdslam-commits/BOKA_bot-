const { makeWASocket, useMultiFileAuthState, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');

// تجهيز إدخال رقم الهاتف من السيرفر لو احتجناه
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startBokaBot() {
    // تم تغيير اسم المجلد إلى BOKA_MSTR بناءً على طلبك لحفظ الجلسة
    const { state, saveCreds } = await useMultiFileAuthState('BOKA_MSTR');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false // قفلنا الـ QR كود تماماً
    });

    // تفعيل نظام كود الربط (Pairing Code) إذا لم تكن مسجلاً من قبل
    if (!sock.authState.creds.registered) {
        console.log("=========================================");
        console.log("🤖 بوت BOKA_MSTR جاهز للربط برقم الهاتف!");
        console.log("=========================================");
        
        // هنا السيرفر هيطلب منك رقم الهاتف، أو تقدر تكتبه تلقائياً في السطر اللي تحت
        // امسح 201273057668 وحط رقم بوتك بالرمز الدولي (مثال  1xxxxxxxxx)
        const phoneNumber = "+2349096793786"; 
        
        await delay(3000); // انتظار بسيط لتهيئة السيرفر
        try {
            let code = await sock.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(`\n🔑 كود الربط الخاص بك هو: 【 ${code} 】\n`);
            console.log("اذهب إلى واتساب -> الأجهزة المرتبطة -> ربط برقم الهاتف، واكتب الكود ده.");
        } catch (error) {
            console.log("❌ حدث خطأ أثناء طلب كود الربط: ", error);
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const remoteJid = m.key.remoteJid;
        const isGroup = remoteJid.endsWith('@g.us');
        const textMessage = m.message.conversation || m.message.extendedTextMessage?.text || "";
        
        const prefix = '.'; 
        if (!textMessage.startsWith(prefix)) return;
        
        const args = textMessage.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        // 1. قائمة الأوامر (30 قسم)
        if (command === 'اوامر' || command === 'menu') {
            const menuText = `
*╭━━━[ بوت BOKA_MSTR 🤖 ]━━━╮*
*👤 المطور :* 𝗕𝗢𝗞𝗔
*⚙️ النظام :* Node.js / Baileys
*╰━━━━━━━━━━━━━━━━╯*

*مرحباً بك! إليك أقسام البوت الـ 30، استخدم البادئة (${prefix}) قبل كل أمر:*

*📁 [1] قسم إدارة الجروبات* (رفع، تنزيل، طرد)
*🛡️ [2] قسم الحماية ومكافحة البوتات*
*📥 [3] قسم التحميلات*
*🎨 [4] قسم صناعة الملصقات*
*🛠️ [5] قسم خدمات السوشيال ميديا*
*📚 [6] قسم المذاكرة والتعليم*
*🧠 [7] قسم الذكاء الاصطناعي*
*☪️ [8] قسم الدين الإسلامي*
*🎮 [9] قسم الألعاب*
*🥳 [10] قسم الترفيه والتسلية*
*🎵 [11] قسم الصوتيات والموسيقى*
*🖼️ [12] قسم تعديل الصور*
*✒️ [13] قسم تصميم اللوجوهات*
*🌐 [14] قسم الترجمة الفورية*
*🌤️ [15] قسم حالة الطقس*
*📱 [16] قسم معلومات النظام*
*🧑‍💻 [17] قسم المطور BOKA*
*🔍 [18] قسم البحث*
*🔤 [19] قسم استخراج النصوص*
*⛩️ [20] قسم الأنمي*
*🖼️ [21] قسم الخلفيات*
*🔗 [22] قسم اختصار الروابط*
*📅 [23] قسم حساب العمر*
*⚖️ [24] قسم الأقوال والحكم*
*🧩 [25] قسم المسابقات*
*📊 [26] قسم تحويل الصيغ*
*🕵️ [27] قسم كشف الهوية*
*🎫 [28] قسم الباركود*
*💬 [29] قسم التفاعل الوهمي*
*🆘 [30] قسم الدعم والمساعدة*

*💡 اكتب (${prefix}بوت) عشان تضحك.*
            `;
            await sock.sendMessage(remoteJid, { text: menuText }, { quoted: m });
        }

        // 2. أمر الرد التلقائي (.بوت)
        else if (command === 'بوت') {
            await sock.sendMessage(remoteJid, { text: 'متصدعنيش قول عاوز اي 😒' }, { quoted: m });
        }

        // 3. أوامر إدارة الجروبات (تنصيب / رفع)
        else if (command === 'رفع' || command === 'تنصيب') {
            if (!isGroup) return sock.sendMessage(remoteJid, { text: '❌ الأمر ده بيشتغل جوه الجروبات بس!' }, { quoted: m });
            const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const quotedMessage = m.message.extendedTextMessage?.contextInfo?.participant;
            let target = mentionedJid.length > 0 ? mentionedJid[0] : quotedMessage;
            if (!target) return sock.sendMessage(remoteJid, { text: `❌ اعمل منشن للشخص واكتب ${prefix}رفع` }, { quoted: m });

            try {
                await sock.groupParticipantsUpdate(remoteJid, [target], "promote");
                await sock.sendMessage(remoteJid, { text: `✅ تم تنصيب العضو كأدمن بنجاح بواسطة بوت BOKA.` }, { quoted: m });
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: '❌ فشل الرفع، تأكد إن البوت أدمن.' }, { quoted: m });
            }
        }

        // 4. أوامر إدارة الجروبات (تنزيل)
        else if (command === 'تنزيل') {
            if (!isGroup) return;
            const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const quotedMessage = m.message.extendedTextMessage?.contextInfo?.participant;
            let target = mentionedJid.length > 0 ? mentionedJid[0] : quotedMessage;
            if (!target) return sock.sendMessage(remoteJid, { text: `❌ اعمل منشن واكتب ${prefix}تنزيل` }, { quoted: m });

            try {
                await sock.groupParticipantsUpdate(remoteJid, [target], "demote");
                await sock.sendMessage(remoteJid, { text: `✅ تم تنزيل العضو من الإدارة بنجاح.` }, { quoted: m });
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: '❌ فشل التنزيل.' }, { quoted: m });
            }
        }
    });
}

startBokaBot().catch(err => console.log("خطأ في التشغيل: ", err));
