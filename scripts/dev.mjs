import { spawn } from 'node:child_process';
const children = ['server', 'client'].map(name => spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', `dev:${name}`], { stdio: 'inherit', shell: process.platform === 'win32' }));
const stop = () => children.forEach(child => child.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
children.forEach(child => child.on('exit', code => { stop(); process.exitCode = code || 0; }));
