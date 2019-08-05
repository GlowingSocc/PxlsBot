const { client } = require('../index');

const logger = require('../logger');
const { getCommands } = require('../utils');

const config = require('../config');

/**
 * An array of commands, set during initialization.
 * @property {Command[]} commands The commands.
 */
let commands;

async function init () {
  logger.info('Initializing commands...');
  commands = await getCommands(config.commandsPath);
  commands.forEach(command => command.init());
}

/**
 * Executed whenever a message is received over the WebSocket.
 * @param {Discord.Message} message The message.
 */
async function execute (message) {
  if (message.author.bot) {
    return;
  }
  const args = message.content.split(' ');
  if (args[0].toLowerCase().startsWith(config.prefix)) {
    const cmd = args[0].toLowerCase().replace(config.prefix, '');
    let match;
    for (let command of commands) {
      if (command.aliases.includes(cmd)) {
        match = command;
      }
    }
    if (!match) {
      return;
    }
    if (match.serverOnly && !message.guild) {
      return message.channel.send('This command may only be run in a guild.');
    }
    logger.debug(message.author.tag + ' is executing command "' + match.name + '" in guild "' + message.guild.name + '".');
    match.execute(client, message);
  }
}

module.exports = { init, execute };