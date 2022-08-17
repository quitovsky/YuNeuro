const token = "TELEGRAM_TOKEN";

const sqlite = require('sqlite3')
const db = new sqlite.Database("index.db");

function ifTableExists(tableName, callback) {
    db.all(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='${tableName}'`, (err, rows) => {
        if(err) return console.log(err);
        if(rows[0]["COUNT(*)"] > 0) {
            callback()
        }
    })
}

function insertWord(chat, text) {
    db.run(`INSERT OR IGNORE INTO "${chat}" VALUES ("${text}")`)
}

function sendRandomMessage(ctx, limit) {
    db.all(`SELECT word FROM "${ctx.chat.id}" ORDER BY RANDOM() LIMIT ${limit}`, (err, rows) => {
        if(err) return console.log(err);
        let msg = rows.map((item) => item.word).join(" ");
        if(msg.endsWith(",")) msg = msg.slice(0, -1);
        msg = msg.slice(0,1).toUpperCase() + msg.slice(1);
        if(msg.length === 0) return;
        ctx.reply(msg)
    })
}

const { Telegraf } = require('telegraf');
const bot = new Telegraf(token);

bot.use(async(ctx, next) => {
    if(ctx.chat.type === "group") {
        ctx.sendRandom = (limit) => {
            sendRandomMessage(ctx, limit)
        }
    }
    next();
})

bot.on('my_chat_member', async (ctx) => {
    if(ctx.myChatMember.new_chat_member.status === "member") {
        await ctx.reply("Чтобы начать работу бота, нужно выдать права администратора и выполнить /reg");
    }
    if(ctx.myChatMember.new_chat_member.status === "administrator") {
        await ctx.reply("Первый шаг выполнен, осталось использовать /reg")
    }
})

bot.command("reg", async(ctx) => {
    if(ctx.chat.type === "group") {
        db.run(`CREATE TABLE IF NOT EXISTS "${ctx.chat.id}" ("word" TEXT, PRIMARY KEY (word))`, (res, err) => {
            if(err) ctx.reply("Что-то пошло не так. (ошибка при запросе к базе данных)");
            else ctx.reply("Чат занесен в базу данных, теперь сообщения будут обрабатываться ботом.")
        });
    }
});

bot.command("say", async(ctx) => {
    if(ctx.chat.type === "group") {
        const chat = ctx.chat.id;
        ifTableExists(chat, () => {
            let arg = ctx.message.text.split(" ")[1]
            if(isNaN(arg)) {
                ctx.sendRandom(15);
            } else {
                ctx.sendRandom(arg);
            }
        })
    }
})

bot.command('stat', async(ctx) => {
    const chat = ctx.chat.id;
    if(ctx.chat.type === "group") {
        ifTableExists(chat, () => {
            db.all(`SELECT COUNT(word) FROM "${chat}"`, (err, rows) => {
                ctx.reply(`Фраз/слов в базе данных: ${rows[0]["COUNT(word)"]}`)
            })
        })
    }
})

bot.command('reset', async(ctx) => {
    const chat = ctx.chat.id;
    if(ctx.chat.type === "group") {
        const data = await bot.telegram.getChatAdministrators(ctx.chat.id);
        if(!data || !data.length) return;
        if(data.some( item => item.user.id === ctx.from.id )) {
            db.run(`DELETE FROM "${chat}"`)
            return await ctx.reply("Записи удалены.")
        }
    }
})

bot.on('message', async(ctx) => {
    const chat = ctx.chat.id;
    if(ctx.message.text && ctx.chat.type === "group" && !ctx.from.is_bot) {
        ifTableExists(chat, () => {
            let text = ctx.message.text.toLowerCase().replaceAll(/(\n)|(-)|(—)|(,)|(\.)|(\()|(\))/ig, " ");
            text = text.replaceAll(/\s+/ig, " ");
            const words = text.split(" ");
            if(Math.random() > 0.5) {
                if(words.length <=5 && words.length > 1) {
                    insertWord(chat, text)
                }
            }
            for(let word in words) {
                if(words.hasOwnProperty(word)) {
                    if(Math.random() > 0.4) {
                        insertWord(chat, words[word])
                    }
                }
            }
        })
    }
    if(ctx.message.message_id % 20 === 0) {
        ctx.sendRandom(5)
    }
})

bot.launch().catch(console.log)

process.once('SIGINT', () => {
    bot.stop('SIGINT');
    db.close();
})
process.once('SIGTERM', () => {
    bot.stop('SIGTERM');
    db.close()
})
