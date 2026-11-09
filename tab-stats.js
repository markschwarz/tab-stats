#!/usr/bin/env node

const { execSync } = require('child_process');

function runAppleScript(script) {
  try {
    return execSync(`osascript -e '${script}'`, { encoding: 'utf8' }).trim();
  } catch (e) {
    return '0';
  }
}

function getBrowserStats() {
  const browsers = [
    {
      name: 'Safari',
      processName: 'Safari',
      tabScript: 'tell application "Safari" to count every tab of every window'
    },
    {
      name: 'Google Chrome',
      processName: 'Google Chrome',
      tabScript: 'tell application "Google Chrome" to count every tab of every window'
    },
    {
      name: 'Brave Browser',
      processName: 'Brave Browser',
      tabScript: 'tell application "Brave Browser" to count every tab of every window'
    },
    {
      name: 'Arc',
      processName: 'Arc',
      tabScript: 'tell application "Arc" to count every tab of every window'
    },
    {
      name: 'Microsoft Edge',
      processName: 'Microsoft Edge',
      tabScript: 'tell application "Microsoft Edge" to count every tab of every window'
    }
  ];

  let totalTabs = 0;
  let results = [];

  for (const b of browsers) {
    const tabCountStr = runAppleScript(b.tabScript);
    const tabs = parseInt(tabCountStr, 10) || 0;

    let memoryMB = 0;
    try {
      const psOutput = execSync(`ps aux | grep -i "${b.processName}" | grep -v grep`, { encoding: 'utf8' });
      const lines = psOutput.trim().split('\n').filter(Boolean);
      let totalKB = 0;
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length > 5) {
          const rssKB = parseInt(parts[5], 10) || 0;
          totalKB += rssKB;
        }
      }
      memoryMB = Math.round(totalKB / 1024);
    } catch (e) {
      // Process not running
    }

    if (tabs > 0 || memoryMB > 0) {
      totalTabs += tabs;
      results.push({ name: b.name, tabs, memoryMB });
    }
  }

  return { totalTabs, results };
}

const { totalTabs, results } = getBrowserStats();

console.log('🌐 Browser Tab & Memory Monitor');
console.log('-----------------------------------');
if (results.length === 0) {
  console.log('No supported browsers currently running.');
} else {
  let totalMemoryMB = 0;
  for (const r of results) {
    totalMemoryMB += r.memoryMB;
    console.log(`• ${r.name}: ${r.tabs} tabs | ~${r.memoryMB} MB`);
  }
  console.log('-----------------------------------');
  console.log(`Total Open Tabs: ${totalTabs}`);
  console.log(`Estimated Memory: ${(totalMemoryMB / 1024).toFixed(2)} GB (${totalMemoryMB} MB)`);
}
