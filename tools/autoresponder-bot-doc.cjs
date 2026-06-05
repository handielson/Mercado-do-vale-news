const fs = require('fs');
const path = require('path');

function resolveBotWhatsappDocPath(root = path.resolve(__dirname, '..')) {
  const archivedPath = path.join(root, 'docs', 'autoresponder', 'archive', 'Bot_Whatsapp.md');
  if (fs.existsSync(archivedPath)) return archivedPath;
  return path.join(root, 'Bot_Whatsapp.md');
}

function readBotWhatsappDoc(root = path.resolve(__dirname, '..')) {
  return fs.readFileSync(resolveBotWhatsappDocPath(root), 'utf8');
}

exports.resolveBotWhatsappDocPath = resolveBotWhatsappDocPath;
exports.readBotWhatsappDoc = readBotWhatsappDoc;
