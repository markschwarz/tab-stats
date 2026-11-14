#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HISTORY_DIR = path.join(os.homedir(), '.tab-stats');
const HISTORY_FILE = path.join(HISTORY_DIR, 'history.json');

function saveHistory(stats) {
  try {
    if (!fs.existsSync(HISTORY_DIR)) {
      fs.mkdirSync(HISTORY_DIR, { recursive: true });
    }
    
    let history = [];
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      history = JSON.parse(data);
      if (!Array.isArray(history)) {
        history = [];
      }
    }

    history.push({
      timestamp: new Date().toISOString(),
      ...stats
    });

    // Keep last 1000 entries or keep all? Let's write them all or keep a reasonable window, or all since it's light.
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
  } catch (e) {
    // Ignore history write errors to not disrupt main execution
  }
}

function showHistory() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) {
      console.log('No history found yet. Run `tab-stats` to record some stats.');
      return;
    }

    const data = fs.readFileSync(HISTORY_FILE, 'utf8');
    const history = JSON.parse(data);

    if (!Array.isArray(history) || history.length === 0) {
      console.log('History is empty.');
      return;
    }

    console.log('📈 Tab Stats History & Trends');
    console.log('-----------------------------------');
    console.log(`Total Records: ${history.length}`);
    console.log('');

    let totalTabsSum = 0;
    let totalMemorySumMB = 0;
    let validEntries = 0;

    // Show recent entries (last 10)
    console.log('Recent Entries:');
    const recent = history.slice(-10);
    for (const entry of recent) {
      const date = new Date(entry.timestamp).toLocaleString();
      const memGB = (entry.totalMemoryMB / 1024).toFixed(2);
      console.log(`[${date}] Tabs: ${entry.totalTabs} | Memory: ${memGB} GB`);
    }

    for (const entry of history) {
      if (typeof entry.totalTabs === 'number' && typeof entry.totalMemoryMB === 'number') {
        totalTabsSum += entry.totalTabs;
        totalMemorySumMB += entry.totalMemoryMB;
        validEntries++;
      }
    }

    if (validEntries > 0) {
      const avgTabs = (totalTabsSum / validEntries).toFixed(1);
      const avgMemoryMB = totalMemorySumMB / validEntries;
      const avgMemoryGB = (avgMemoryMB / 1024).toFixed(2);

      // Average memory per tab stat / overall average memory per tab across history records
      // Or average memory per tab per entry: total memory / total tabs across all valid entries
      const overallAvgMemPerTabMB = totalTabsSum > 0 ? (totalMemorySumMB / totalTabsSum) : 0;

      console.log('-----------------------------------');
      console.log('📊 Averages across history:');
      console.log(`• Average Open Tabs: ${avgTabs}`);
      console.log(`• Average Estimated Memory: ${avgMemoryGB} GB`);
      if (totalTabsSum > 0) {
        console.log(`• Average Memory Per Tab: ${Math.round(overallAvgMemPerTabMB)} MB`);
      }
    }
  } catch (e) {
    console.log('Error reading history file:', e.message);
  }
}

function runAppleScript(script) {
  try {
    return execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { encoding: 'utf8' }).trim();
  } catch (e) {
    return '0';
  }
}

function getBrowserStats() {
  const browsers = [
    {
      name: 'Safari',
      processName: 'Safari',
      tabScript: `
        set tabCount to 0
        tell application "System Events"
          set isRunning to (name of processes) contains "Safari"
        end tell
        if isRunning then
          try
            tell application "Safari"
              repeat with w in windows
                set tabCount to tabCount + (count of tabs of w)
              end repeat
            end tell
          end try
        end if
        return tabCount
      `
    },
    {
      name: 'Google Chrome',
      processName: 'Google Chrome',
      tabScript: `
        set tabCount to 0
        tell application "System Events"
          set isRunning to (name of processes) contains "Google Chrome"
        end tell
        if isRunning then
          try
            tell application "Google Chrome"
              repeat with w in windows
                set tabCount to tabCount + (count of tabs of w)
              end repeat
            end tell
          end try
        end if
        return tabCount
      `
    },
    {
      name: 'Brave Browser',
      processName: 'Brave Browser',
      tabScript: `
        set tabCount to 0
        tell application "System Events"
          set isRunning to (name of processes) contains "Brave Browser"
        end tell
        if isRunning then
          try
            tell application "Brave Browser"
              repeat with w in windows
                set tabCount to tabCount + (count of tabs of w)
              end repeat
            end tell
          end try
        end if
        return tabCount
      `
    },
    {
      name: 'Arc',
      processName: 'Arc',
      tabScript: `
        set tabCount to 0
        tell application "System Events"
          set isRunning to (name of processes) contains "Arc"
        end tell
        if isRunning then
          try
            tell application "Arc"
              repeat with w in windows
                set tabCount to tabCount + (count of tabs of w)
              end repeat
            end tell
          end try
        end if
        return tabCount
      `
    },
    {
      name: 'Microsoft Edge',
      processName: 'Microsoft Edge',
      tabScript: `
        set tabCount to 0
        tell application "System Events"
          set isRunning to (name of processes) contains "Microsoft Edge"
        end tell
        if isRunning then
          try
            tell application "Microsoft Edge"
              repeat with w in windows
                set tabCount to tabCount + (count of tabs of w)
              end repeat
            end tell
          end try
        end if
        return tabCount
      `
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

let totalMemoryMB = 0;
for (const r of results) {
  totalMemoryMB += r.memoryMB;
}

const statsData = {
  totalTabs,
  totalMemoryMB,
  results
};

const args = process.argv.slice(2);
if (args.includes('--history')) {
  showHistory();
  process.exit(0);
}

// Automatically log on normal run
saveHistory(statsData);

console.log('🌐 Browser Tab & Memory Monitor');
console.log('-----------------------------------');
if (results.length === 0) {
  console.log('No supported browsers currently running.');
} else {
  let displayedMemoryMB = 0;
  for (const r of results) {
    displayedMemoryMB += r.memoryMB;
    const memoryGB = (r.memoryMB / 1024).toFixed(2);
    console.log(`• ${r.name}: ${r.tabs} tabs | ~${memoryGB} GB`);
  }
  console.log('-----------------------------------');
  console.log(`Total Open Tabs: ${totalTabs}`);
  console.log(`Estimated Memory: ${(displayedMemoryMB / 1024).toFixed(2)} GB`);
}
