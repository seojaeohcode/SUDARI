/* Validate the distributed app, not just Electron running the source tree.
 * Launch checks are restricted to disposable GitHub-hosted macOS runners.
 * Ad-hoc integrity and Gatekeeper trust are intentionally reported separately.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const {spawnSync, spawn} = require('node:child_process');
const {once} = require('node:events');
assert.equal(process.platform, 'darwin');
const output = path.resolve('test-results/mac-distribution-'+process.arch+(process.argv[2]==='--audit'?'-legacy':''));
fs.mkdirSync(output, {recursive:true});
const work = fs.mkdtempSync(path.join(os.tmpdir(),'sudari-distribution-'));
const report = [];
function command(bin,args,required=true) {
  const r=spawnSync(bin,args,{encoding:'utf8',timeout:120000});
  const row={bin,args,status:r.status,stdout:r.stdout,stderr:r.stderr,error:r.error?.message};
  report.push(row);
  fs.writeFileSync(path.join(output,'checks.json'),JSON.stringify(report,null,2));
  console.log(bin,args.join(' '),'exit:',r.status,(r.stderr||'').trim());
  if(required)assert.equal(r.status,0,JSON.stringify(row));
  return row;
}
function verify(app,required=true) {
  command('/usr/bin/codesign',['--display','--verbose=4',app],false);
  return command('/usr/bin/codesign',['--verify','--deep','--strict','--verbose=2',app],required);
}
async function launch(app,label) {
  assert.equal(process.env.GITHUB_ACTIONS,'true','Launch only on a disposable CI runner');
  const exe=path.join(app,'Contents/MacOS/Sudari');
  const before=await fetch('http://127.0.0.1:37421').catch(()=>null);
  assert.equal(before,null,'Another Sudari instance is running');
  const child=spawn(exe,[],{stdio:['ignore','pipe','pipe']});
  let log='';child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);
  let launchError=null;child.on('error',e=>launchError=e);
  const closed=once(child,'close');
  try {
    let ready=false;
    for(let n=0;n<80;n++){
      if(launchError)throw launchError;
      assert.equal(child.exitCode,null,'Packaged app exited: '+log);
      assert.equal(child.signalCode,null,'Packaged app killed: '+log);
      const response=await fetch('http://127.0.0.1:37421').catch(()=>null);
      if(response?.status===400){ready=true;break;}
      await new Promise(r=>setTimeout(r,250));
    }
    assert.ok(ready,'Packaged main process did not start: '+log);
    await new Promise(r=>setTimeout(r,5000));
    assert.equal(child.exitCode,null,'App exited after launch: '+log);
    assert.equal(child.signalCode,null,'App killed after launch: '+log);
    command('/usr/sbin/screencapture',['-x',path.join(output,label+'.png')]);
    console.log('PASS: installed '+label+' app launches');
  } finally {
    if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');
    await closed;
    fs.writeFileSync(path.join(output,label+'-launch.log'),log);
  }
}
async function main(){
  const audit=process.argv[2]==='--audit';
  const version=require('../package.json').version;
  const zip=audit?path.resolve(process.argv[3]):path.resolve('dist',`Sudari-${version}-mac-${process.arch}.zip`);
  const extracted=path.join(work,'zip');
  command('/usr/bin/ditto',['-xk',zip,extracted]);
  const zipApp=path.join(extracted,'Sudari.app');
  const signature=verify(zipApp,!audit);
  if(audit){console.log('Published legacy signature status:',signature.status);return;}
  const nativeArch=command('/usr/bin/lipo',['-archs',path.join(zipApp,'Contents/MacOS/Sudari')]).stdout.trim();
  assert.equal(nativeArch,process.arch==='x64'?'x86_64':'arm64');
  // A valid local signature is not Apple notarization. Retain Gatekeeper's result.
  command('/usr/sbin/spctl',['--assess','--type','execute','--verbose=4',zipApp],false);
  const dmg=path.resolve('dist',`Sudari-${version}-mac-${process.arch}.dmg`);
  command('/usr/bin/hdiutil',['verify',dmg]);
  const mount=path.join(work,'mounted');fs.mkdirSync(mount);
  command('/usr/bin/hdiutil',['attach','-readonly','-nobrowse','-mountpoint',mount,dmg]);
  const installed=path.join(work,'Applications','Sudari.app');
  try {command('/usr/bin/ditto',[path.join(mount,'Sudari.app'),installed]);}
  finally {command('/usr/bin/hdiutil',['detach',mount]);}
  verify(installed);
  assert.equal(process.env.GITHUB_ACTIONS,'true');
  const profile=path.join(os.homedir(),'Library/Application Support/sudari');
  fs.mkdirSync(profile,{recursive:true});
  const config=path.join(profile,'config.json');
  assert.ok(!fs.existsSync(config),'Refusing to overwrite an existing app profile');
  fs.writeFileSync(config,JSON.stringify({language:'en',languageChosen:true,scale:2,muted:true,
    launchAtLogin:false,pin:'Installed app check',pomodoro:{on:true,focusMin:25,breakMin:5,rounds:4}}));
  await launch(installed,'dmg');
  await launch(zipApp,'zip');
  console.log('PASS: DMG integrity, copied app signature, ZIP signature, CPU and packaged launch');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
