const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { readLegacyVpsConst: readConst } = require('./vps-ssh-config.cjs');

function exec(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => {
        if (code === 0) return resolve({ code, stdout, stderr, command });
        reject(new Error(`Command failed (${code}): ${command}\n${stderr || stdout}`));
      });
      stream.on('data', (data) => {
        stdout += data.toString();
      });
      stream.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    });
  });
}

function putFile(conn, local, remote) {
  return new Promise((resolve, reject) => {
    conn.sftp((sftpErr, sftp) => {
      if (sftpErr) return reject(sftpErr);
      sftp.fastPut(local, remote, (uploadErr) => {
        sftp.end();
        if (uploadErr) return reject(uploadErr);
        resolve();
      });
    });
  });
}

async function getPm2Target(conn) {
  const pm2 = await exec(conn, 'pm2 jlist');
  const list = JSON.parse(pm2.stdout || '[]');
  const apiProc = list.find((p) =>
    String(p?.pm2_env?.pm_exec_path || '').includes('server') ||
    String(p?.name || '').includes('api') ||
    String(p?.name || '').includes('vps')
  );
  if (!apiProc) throw new Error('Unable to locate target PM2 app');
  return {
    appDir: apiProc.pm2_env.pm_cwd,
    appName: apiProc.name,
  };
}

async function main() {
  const localServer = path.join(root, 'vps_server.js');
  const requiredFiles = [
    { local: localServer, remoteName: 'server.js' },
    { local: localServer, remoteName: 'vps_server.js' },
    { local: path.join(root, 'services', 'synologyNasStatusService.js'), remoteName: 'services/synologyNasStatusService.js' },
    { local: path.join(root, 'services', 'synologyCommandQueueService.js'), remoteName: 'services/synologyCommandQueueService.js' },
    { local: path.join(root, 'services', 'vpsUploadPathPolicy.cjs'), remoteName: 'services/vpsUploadPathPolicy.cjs' },
  ];

  for (const file of requiredFiles) {
    if (!fs.existsSync(file.local)) throw new Error(`Missing local file: ${file.local}`);
  }

  const conn = new Client();
  const timeout = setTimeout(() => {
    conn.end();
    console.error(JSON.stringify({ ok: false, timed_out: true }, null, 2));
    process.exit(2);
  }, 120000);

  await new Promise((resolve, reject) => {
    conn
      .on('ready', resolve)
      .on('error', reject)
      .connect({
        host: readConst('VpsHost'),
        port: 22,
        username: readConst('VpsUser'),
        password: readConst('VpsPass'),
        readyTimeout: 15000,
      });
  });

  const { appDir, appName } = await getPm2Target(conn);
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const backups = [];

  try {
    await exec(conn, `mkdir -p ${appDir}/services ${appDir}/.codex-backups`);
    for (const file of requiredFiles) {
      const remote = `${appDir}/${file.remoteName}`;
      const backup = `${appDir}/.codex-backups/${file.remoteName.replace(/[\\/]/g, '__')}.${stamp}.bak`;
      await exec(conn, `test -f ${remote} && cp ${remote} ${backup} || true`);
      backups.push({ remote, backup });
    }

    for (const file of requiredFiles) {
      await putFile(conn, file.local, `${appDir}/${file.remoteName}`);
    }

    await exec(conn, `cd ${appDir} && node --check server.js`);
    const grep = await exec(conn, `grep -n "autoresponder-webhook" ${appDir}/server.js ${appDir}/vps_server.js`);
    await exec(conn, `pm2 restart ${appName} --update-env`);
    await exec(conn, `pm2 describe ${appName} | grep -q "online"`);

    conn.end();
    clearTimeout(timeout);
    console.log(JSON.stringify({
      ok: true,
      appDir,
      appName,
      uploaded: requiredFiles.map((file) => file.remoteName),
      backups,
      route_check: grep.stdout.trim().split(/\r?\n/).slice(0, 6),
    }, null, 2));
  } catch (err) {
    const restoreErrors = [];
    for (const item of backups) {
      try {
        await exec(conn, `test -f ${item.backup} && cp ${item.backup} ${item.remote} || true`);
      } catch (restoreErr) {
        restoreErrors.push(restoreErr.message);
      }
    }
    try {
      await exec(conn, `pm2 restart ${appName} --update-env`);
    } catch (restartErr) {
      restoreErrors.push(restartErr.message);
    }
    conn.end();
    clearTimeout(timeout);
    console.error(JSON.stringify({
      ok: false,
      error: err.message,
      restored_backups: backups,
      restoreErrors,
    }, null, 2));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
