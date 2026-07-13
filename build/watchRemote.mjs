// Drop-in replacement for the `bitburner-filesync` CLI's own file watcher.
//
// bitburner-filesync uses `cheap-watch`, a thin wrapper around raw fs.watch with
// no "wait for write to finish" handling. This project lives inside a live-synced
// Google Drive folder, where fs.watch notifications can fire before a write is
// fully flushed (or get dropped/coalesced by the Drive filter driver), causing
// pushes that silently send stale/partial content or never fire at all. Chokidar's
// `awaitWriteFinish` + polling mode are built specifically for this class of
// network/cloud-drive filesystem, so we reuse bitburner-filesync's socket and
// message-generation code but swap in chokidar for the watching itself.
import path from 'path';
import chokidar from 'chokidar';
import signal from 'signal-js';
import { config, loadConfig } from 'bitburner-filesync/src/config.js';
import { EventType } from 'bitburner-filesync/src/eventTypes.js';
import { setupSocket } from 'bitburner-filesync/src/networking/webSocket.js';
import { messageHandler } from 'bitburner-filesync/src/networking/messageHandler.js';
import {
  fileChangeEventToMsg,
  fileRemovalEventToMsg,
  requestFilenames,
  requestDefinitionFile,
} from 'bitburner-filesync/src/networking/messageGenerators.js';

loadConfig();

const scriptsFolder = config.get('scriptsFolder');
const allowedFiletypes = config.get('allowedFiletypes');
const quiet = config.get('quiet');

const rootPrefix = scriptsFolder.replace(/\\/g, '/').replace(/\/$/, '') + '/';
const paths = new Map();
const fileStats = { isDirectory: () => false };

function toRelative(p) {
  const normalized = p.split(path.sep).join('/');
  return normalized.startsWith(rootPrefix) ? normalized.slice(rootPrefix.length) : normalized;
}

function isAllowed(relativePath) {
  return allowedFiletypes.some((ext) => relativePath.endsWith(ext));
}

let ready = false;

const watcher = chokidar.watch(scriptsFolder, {
  ignoreInitial: false,
  usePolling: true,
  interval: 300,
  awaitWriteFinish: {
    stabilityThreshold: 300,
    pollInterval: 50,
  },
});

watcher.on('add', (p) => onAddOrChange(p));
watcher.on('change', (p) => onAddOrChange(p));
watcher.on('unlink', (p) => onRemove(p));

function onAddOrChange(p) {
  const relative = toRelative(p);
  if (!isAllowed(relative)) return;
  paths.set(relative, fileStats);
  if (ready) signal.emit(EventType.FileChanged, { path: relative });
}

function onRemove(p) {
  const relative = toRelative(p);
  if (!isAllowed(relative)) return;
  paths.delete(relative);
  if (ready) signal.emit(EventType.FileDeleted, { path: relative });
}

await new Promise((resolve) => watcher.once('ready', resolve));
ready = true;

const socket = setupSocket(signal);

signal.on(EventType.MessageReceived, (msg) => messageHandler(signal, msg, paths));

signal.on(EventType.ConnectionMade, () => {
  console.log('Connection made!');

  if (config.get('definitionFile').update) {
    signal.emit(EventType.MessageSend, requestDefinitionFile());
  }

  if (config.get('pushAllOnConnection')) {
    for (const relative of paths.keys()) {
      signal.emit(EventType.MessageSend, fileChangeEventToMsg({ path: relative }));
    }
  } else {
    signal.emit(EventType.MessageSend, requestFilenames());
  }
});

signal.on(EventType.FileChanged, (fileEvent) => {
  if (!quiet) console.log(fileEvent.path + ' changed');
  signal.emit(EventType.MessageSend, fileChangeEventToMsg(fileEvent));
});

if (config.get('allowDeletingFiles')) {
  signal.on(EventType.FileDeleted, (fileEvent) =>
    signal.emit(EventType.MessageSend, fileRemovalEventToMsg(fileEvent))
  );
}

console.log(`Server is ready, running on ${config.get('port')}!`);

process.on('SIGINT', () => {
  console.log('Shutting down!');
  watcher.close();
  socket.close();
  process.exit();
});
