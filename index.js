// index.js
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
});

const BOT_TOKEN = process.env.BOT_TOKEN;
const TARGET_VC_ID = process.env.TARGET_VC_ID;       // 監視VC ID
const NOTIFY_CHANNEL_ID = process.env.NOTIFY_CHANNEL_ID; // 通知先チャンネルID

// VC滞在管理
let vcStartTime = null;
let vcEmbedMessage = null;
const vcUsersTime = new Map();    // key: userId, value: 累計秒数
const userJoinTimes = new Map();  // key: userId, value: 入室タイムスタンプ

// VC状態更新イベント
client.on('voiceStateUpdate', async (oldState, newState) => {
  const notifyChannel = await client.channels.fetch(NOTIFY_CHANNEL_ID);
  const channelId = TARGET_VC_ID;

  // ===================
  // 入室処理
  // ===================
  if (newState.channelId === channelId && oldState.channelId !== channelId) {
    const now = Date.now();

    if (!vcStartTime) vcStartTime = now;
    userJoinTimes.set(newState.id, now);
    if (!vcUsersTime.has(newState.id)) vcUsersTime.set(newState.id, 0);

    if (!vcEmbedMessage) {
      const embed = new EmbedBuilder()
        .setTitle('🔔 VC開始')
        .setDescription(`開始時間: <t:${Math.floor(now/1000)}:F>\n参加者: 1`)
        .setColor(0x00FF00);

      vcEmbedMessage = await notifyChannel.send({ embeds: [embed] });
    }
  }

  // ===================
  // 退室処理
  // ===================
  if (oldState.channelId === channelId && newState.channelId !== channelId) {
    const now = Date.now();
    const joinTime = userJoinTimes.get(oldState.id);
    if (joinTime) {
      const durationSec = Math.floor((now - joinTime) / 1000);
      vcUsersTime.set(oldState.id, vcUsersTime.get(oldState.id) + durationSec);
      userJoinTimes.delete(oldState.id);
    }

    const vcChannel = oldState.guild.channels.cache.get(channelId);
    if (vcChannel.members.size === 0 && vcEmbedMessage) {
      const totalTime = Math.floor((now - vcStartTime) / 1000);

      // 終了通知 Embed作成
      let description = `総通話時間: ${Math.floor(totalTime / 60)}分\n\n`;
      description += '参加者ごとの通話時間:\n';
      for (const [userId, sec] of vcUsersTime) {
        description += `<@${userId}>: ${Math.floor(sec / 60)}分\n`;
      }

      // 最後にメッセージを追加
      description += `\n💡 お疲れさまでした！`;

      const embed = new EmbedBuilder()
        .setTitle('🏁 VC終了')
        .setDescription(description)
        .setColor(0xFF0000);

      await notifyChannel.send({ embeds: [embed] });

      // リセット
      vcStartTime = null;
      vcEmbedMessage = null;
      vcUsersTime.clear();
      userJoinTimes.clear();
    }
  }
});

// Bot起動
client.once('ready', () => {
  console.log(`${client.user.tag} が起動しました`);
});

client.login(BOT_TOKEN);
