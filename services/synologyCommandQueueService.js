const DEFAULT_TTL_MS = 5 * 60 * 1000;

function cloneCommand(command) {
  return command ? { ...command } : null;
}

function toIso(now) {
  return new Date(now).toISOString();
}

function makeCommandId(now = new Date()) {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}${new Date(now).getTime().toString(36)}`;
}

function isPending(command) {
  return command && command.status === 'pending';
}

export function createSynologyCommandQueue({ ttlMs = DEFAULT_TTL_MS } = {}) {
  let currentCommand = null;

  function expireIfNeeded(now = new Date()) {
    if (!isPending(currentCommand)) {
      return currentCommand;
    }

    const startedAt = new Date(currentCommand.enqueuedAt).getTime();
    if (Number.isNaN(startedAt)) {
      currentCommand = {
        ...currentCommand,
        status: 'expired',
        expiredAt: toIso(now),
      };
      return currentCommand;
    }

    if ((new Date(now).getTime() - startedAt) > ttlMs) {
      currentCommand = {
        ...currentCommand,
        status: 'expired',
        expiredAt: toIso(now),
      };
    }

    return currentCommand;
  }

  function buildPendingCommand(command, now = new Date()) {
    return {
      id: makeCommandId(now),
      command,
      status: 'pending',
      enqueuedAt: toIso(now),
      completedAt: null,
      expiredAt: null,
      result: null,
    };
  }

  return {
    enqueue(command, now = new Date()) {
      expireIfNeeded(now);

      if (isPending(currentCommand)) {
        return {
          ok: false,
          reason: 'pending',
          command: cloneCommand(currentCommand),
        };
      }

      currentCommand = buildPendingCommand(command, now);
      return {
        ok: true,
        command: cloneCommand(currentCommand),
      };
    },

    poll(now = new Date()) {
      expireIfNeeded(now);

      if (!isPending(currentCommand)) {
        return { command: null };
      }

      return {
        id: currentCommand.id,
        command: currentCommand.command,
      };
    },

    ack({ id, status, result } = {}, now = new Date()) {
      expireIfNeeded(now);

      if (!isPending(currentCommand) || currentCommand.id !== id) {
        return {
          ok: false,
          reason: 'not_found',
          command: cloneCommand(currentCommand),
        };
      }

      currentCommand = {
        ...currentCommand,
        status: status === 'success' ? 'success' : 'failed',
        completedAt: toIso(now),
        result: result == null ? null : String(result).slice(0, 500),
      };

      return {
        ok: true,
        command: cloneCommand(currentCommand),
      };
    },

    getStatus(now = new Date()) {
      expireIfNeeded(now);
      return cloneCommand(currentCommand);
    },
  };
}
