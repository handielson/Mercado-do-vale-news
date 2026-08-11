const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('ssh2');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.vps.local'), quiet: true });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });
const { getVpsSshConfig } = require('../tmp-tests/vps-ssh-config.cjs');
function run(conn, command) { return new Promise((resolve, reject) => conn.exec(command, (error, stream) => { if (error) return reject(error); let out=''; let err=''; stream.on('data',(c)=>out+=c); stream.stderr.on('data',(c)=>err+=c); stream.on('close',(code)=>code===0?resolve(out):reject(new Error(err||out||String(code)))); })); }
function put(conn, local, remote) { return new Promise((resolve, reject) => conn.sftp((error, sftp) => { if (error) return reject(error); sftp.fastPut(local, remote, (uploadError) => { sftp.end(); uploadError ? reject(uploadError) : resolve(); }); })); }
(async()=>{
  const root=path.join(__dirname,'..'); const conn=new Client();
  await new Promise((resolve,reject)=>conn.on('ready',resolve).on('error',reject).connect(getVpsSshConfig()));
  try {
    await put(conn,path.join(root,'ops','evolution-watchdog.sh'),'/tmp/mdv-evolution-watchdog');
    await put(conn,path.join(root,'ops','systemd','mdv-evolution-watchdog.service'),'/tmp/mdv-evolution-watchdog.service');
    await put(conn,path.join(root,'ops','systemd','mdv-evolution-watchdog.timer'),'/tmp/mdv-evolution-watchdog.timer');
    const command="install -m 0755 /tmp/mdv-evolution-watchdog /usr/local/sbin/mdv-evolution-watchdog && install -m 0644 /tmp/mdv-evolution-watchdog.service /etc/systemd/system/mdv-evolution-watchdog.service && install -m 0644 /tmp/mdv-evolution-watchdog.timer /etc/systemd/system/mdv-evolution-watchdog.timer && systemctl daemon-reload && systemctl enable --now mdv-evolution-watchdog.timer && systemctl start mdv-evolution-watchdog.service && systemctl is-active mdv-evolution-watchdog.timer && systemctl list-timers mdv-evolution-watchdog.timer --no-pager";
    process.stdout.write(await run(conn,command));
  } finally { await run(conn,'rm -f /tmp/mdv-evolution-watchdog /tmp/mdv-evolution-watchdog.service /tmp/mdv-evolution-watchdog.timer').catch(()=>{}); conn.end(); }
})().catch((error)=>{console.error(error.message);process.exit(1)});
