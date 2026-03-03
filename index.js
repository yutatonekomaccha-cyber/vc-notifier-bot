const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages
  ]
});

const TARGET_VC_ID = process.env.TARGET_VC_ID;
const NOTIFY_CHANNEL_ID = process.env.NOTIFY_CHANNEL_ID;

let vcStartTime = null;
let interval = null;
let messageId = null;

function formatDuration(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}時間${minutes}分`;
}

async function startVC(vc, notifyChannel) {
  if (interval) return; // 二重起動防止

  vcStartTime = Date.now();

  const embed = new EmbedBuilder()
    .setTitle("🔔 VC開始")
    .setColor(0x00AE86)
    .addFields(
      { name: "開始時間", value: `<t:${Math.floor(vcStartTime/1000)}:F>` },
      { name: "参加人数", value: `${vc.members.size}人` },
      { name: "経過時間", value: "0分" }
    )
    .setFooter({ text: "VC監視Bot" });

  const msg = await notifyChannel.send({ embeds: [embed] });
  messageId = msg.id;

  interval = setInterval(async () => {
    try {
      const diff = Date.now() - vcStartTime;

      const updatedEmbed = new EmbedBuilder()
        .setTitle("🔔 VC進行中")
        .setColor(0x0099ff)
        .addFields(
          { name: "開始時間", value: `<t:${Math.floor(vcStartTime/1000)}:F>` },
          { name: "参加人数", value: `${vc.members.size}人` },
          { name: "経過時間", value: formatDuration(diff) }
        );

      const message = await notifyChannel.messages.fetch(messageId);
      await message.edit({ embeds: [updatedEmbed] });

    } catch (err) {
      console.error("更新エラー:", err);
    }
  }, 30 * 60 * 1000);
}

async function stopVC(notifyChannel) {
  if (!vcStartTime) return;

  clearInterval(interval);
  interval = null;

  const diff = Date.now() - vcStartTime;

  const embed = new EmbedBuilder()
    .setTitle("✅ VC終了")
    .setColor(0xff4444)
    .addFields({
      name: "総通話時間",
      value: formatDuration(diff)
    });

  await notifyChannel.send({ embeds: [embed] });

  vcStartTime = null;
  messageId = null;
}

client.once("ready", async () => {
  console.log(`ログイン完了: ${client.user.tag}`);

  try {
    const guild = client.guilds.cache.first();
    const vc = guild.channels.cache.get(TARGET_VC_ID);
    const notifyChannel = guild.channels.cache.get(NOTIFY_CHANNEL_ID);

    // 🔥 再起動復旧
    if (vc && vc.members.size > 0) {
      console.log("再起動後にVCを検知、復旧します");
      await startVC(vc, notifyChannel);
    }

  } catch (err) {
    console.error("起動時エラー:", err);
  }
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  try {
    const guild = newState.guild;
    const vc = guild.channels.cache.get(TARGET_VC_ID);
    const notifyChannel = guild.channels.cache.get(NOTIFY_CHANNEL_ID);
    if (!vc) return;

    // 誰かが入った
    if (!oldState.channel && newState.channel?.id === TARGET_VC_ID) {
      if (vc.members.size === 1) {
        await startVC(vc, notifyChannel);
      }
    }

    // 全員抜けたら終了
    if (oldState.channel?.id === TARGET_VC_ID) {
      if (vc.members.size === 0) {
        await stopVC(notifyChannel);
      }
    }

  } catch (err) {
    console.error("イベントエラー:", err);
  }
});

// 🔥 突然死防止
process.on("unhandledRejection", error => {
  console.error("未処理Promise:", error);
});

process.on("uncaughtException", error => {
  console.error("未処理例外:", error);
});

client.login(process.env.BOT_TOKEN);
