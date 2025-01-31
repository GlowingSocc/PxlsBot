const Discord = require('discord.js');

const { Command } = require('../command');
const { getDatabase } = require('../index');
const logger = require('../logger');
const { Color, getPrefix } = require('../utils');

const { insertAuditLog } = require('./auditlog');

const database = getDatabase();

const columnWhitelist = [
  'prefix'
];

async function init () {
  try {
    const connection = await database.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS config (
        id INT PRIMARY KEY AUTO_INCREMENT,
        guild_id VARCHAR(18) NOT NULL,
        prefix TEXT,
        UNIQUE KEY (guild_id)
      )
    `);
    await connection.end();
  } catch (err) {
    logger.error('Could not insert "config" table.');
    logger.fatal(err);
  }
}

async function execute (client, message) {
  const args = message.content.split(' ');
  const embed = new Discord.RichEmbed();
  embed.setColor(Color.rainbow.skyblue.toArray());
  if (args.length < 2) {
    // (prefix)config
    try {
      const connection = await database.getConnection();
      const results = await connection.query(`
        SELECT
          *
        FROM
          config
        WHERE
          guild_id = ?
      `, [
        message.guild.id
      ]);
      if (results.length < 1) {
        const prefix = await getPrefix(connection, message.guild.id);
        await connection.end();
        return message.channel.send(`No configurations were found for the guild. Try creating one with \`${prefix}config create\`.`);
      }
      await connection.end();
      const guildConfig = results[0];
      const formattedKeyValues = Object.keys(guildConfig).filter(key => {
        return columnWhitelist.includes(key);
      }).map(key => {
        return `${key} : \`${guildConfig[key]}\``;
      }).join('\n');
      embed.setDescription(formattedKeyValues);
      return message.channel.send(embed);
    } catch (err) {
      logger.error(err);
      return message.channel.send('Could not get config. Details have been logged.');
    }
  }
  const action = args[1].toLowerCase();
  if (action === 'get') {
    if (args.length < 3) {
      return message.channel.send('You must specify a config key.');
    }
    if (!columnWhitelist.includes(args[2].toLowerCase())) {
      return message.channel.send('The specified config key is not on the column whitelist.');
    }
    try {
      const connection = await database.getConnection();
      const results = await connection.query(`
        SELECT
          *
        FROM
          config
        WHERE
          guild_id = ?
      `, [
        message.guild.id
      ]);
      if (results.length < 1) {
        const prefix = await getPrefix(connection, message.guild.id);
        await connection.end();
        return message.channel.send(`No configurations were found for the guild. Try creating one with \`${prefix}config create\`.`);
      }
      await connection.end();
      const guildConfig = results[0];
      const formattedKeyValue = Object.keys(guildConfig).filter(key => {
        return key.toLowerCase() === args[2].toLowerCase() &&
          columnWhitelist.includes(key);
      }).map(key => {
        return `${key} : \`${guildConfig[key]}\``;
      }).join();
      embed.setDescription(formattedKeyValue);
      return message.channel.send(embed);
    } catch (err) {
      logger.error(err);
      return message.channel.send('Could not get config key. Details have been logged.');
    }
  } else if (action === 'set') {
    if (args.length < 3) {
      return message.channel.send('You must specify a config key.');
    }
    if (!columnWhitelist.includes(args[2].toLowerCase())) {
      return message.channel.send('The specified config key is not on the column whitelist.');
    }
    if (args.length < 4) {
      return message.channel.send('You must specify a value.');
    }
    if (!isNaN(args[3])) {
      args[3] = parseFloat(args[3]);
    }
    try {
      const connection = await database.getConnection();
      await insertAuditLog(connection, message, command.id);
      await connection.query(`
        UPDATE
          config
        SET
          ${args[2]} = ?
        WHERE
          guild_id = ?
      `, [
        args[3],
        message.guild.id
      ]);
      await connection.end();
      embed.setColor(Color.rainbow.green.toArray());
      embed.setDescription(`Config key \`${args[2]}\` has been set to \`${args[3]}\`.`);
      return message.channel.send(embed);
    } catch (err) {
      logger.error(err);
      return message.channel.send('Could not set config key. Details have been logged.');
    }
  } else if (action === 'create') {
    try {
      const connection = await database.getConnection();
      await insertAuditLog(connection, message, command.id);
      await connection.query(`
        INSERT INTO
          config
          (guild_id)
        VALUES
          (?)
      `, [
        message.guild.id
      ]);
      await connection.end();
      embed.setColor(Color.rainbow.green.toArray());
      embed.setDescription('Default configuration has been generated.');
      return message.channel.send(embed);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return message.channel.send('Config entry already exists.');
      } else {
        logger.error(err.code);
        return message.channel.send('Could not create config entry. Details have been logged.');
      }
    }
  } else {
    return message.channel.send(`Unknown subcommand \`${action}\`.`);
  }
}

const command = new Command(
  'config',
  'Configure',
  'Utility',
  'Configures bot settings for the guild.',
  'config [ get (key) | set (key) (value) ]',
  [ 'config', 'configure' ],
  true,
  Discord.Permissions.FLAGS.MANAGE_GUILD
);
command.init = init;
command.execute = execute;

module.exports = { command };
