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
    db.all(`SELECT COUNT(word) FROM "${chat}" WHERE "word"="${text}"`, (err, rows) => {
        if(err) return console.log(err);
        const count = rows[0]["COUNT(word)"]
        if(count === 0) {
            db.run(`INSERT INTO "${chat}" VALUES ("${text}", 1)`)
        } else {
            db.run(`UPDATE "${chat}" SET "count"=${count+1} WHERE "word"="${text}"`)
        }
    })
}

const { Telegraf } = require('telegraf');
const bot = new Telegraf(token);

bot.start(async (ctx) => {
    await ctx.reply("ку")
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
        db.run(`CREATE TABLE IF NOT EXISTS "${ctx.chat.id}" ("word" TEXT, "count" INTEGER)`, (res, err) => {
            if(err) ctx.reply("Что-то пошло не так. (ошибка при запросе к базе данных)");
            else ctx.reply("Чат занесен в базу данных, теперь сообщения будут обрабатываться ботом.")
        });
    }
});

bot.command("say", async(ctx) => {
    if(ctx.chat.type === "group") {
        const chat = ctx.chat.id;
        ifTableExists(chat, () => {
            db.all(`SELECT word FROM "${chat}" ORDER BY count DESC, RANDOM() LIMIT 15`, (err, rows) => {
                if(err) return console.log(err);
                ctx.reply(rows.map((item) => item.word).join(" "))
            })
        })
    }
})

bot.on('message', async(ctx) => {
    if(ctx.message.text && ctx.chat.type === "group" && !ctx.from.is_bot) {
        const chat = ctx.chat.id;
        ifTableExists(chat, () => {
            const text = ctx.message.text.toLowerCase();
            const words = text.split(" ");
            if(Math.random() > 0.5) {
                if(words.length <=5) {
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