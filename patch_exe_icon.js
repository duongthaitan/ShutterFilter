const fs = require('fs');
const path = require('path');
const resedit = require('resedit');

async function patchSingleExe(exePath, icoPath) {
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const exeData = fs.readFileSync(exePath);
      const exe = resedit.NtExecutable.from(exeData);
      const res = resedit.NtExecutableResource.from(exe);

      // Remove existing RT_ICON (3) and RT_GROUP_ICON (14)
      res.entries = res.entries.filter((e) => e.type !== 3 && e.type !== 14);

      const icoData = fs.readFileSync(icoPath);
      const iconFile = resedit.Data.IconFile.from(icoData);
      const iconItems = iconFile.icons.map((item) => item.data);

      // Inject Amber Camera Icon
      resedit.Resource.IconGroupEntry.replaceIconsForResource(
        res.entries,
        1,
        1033,
        iconItems
      );

      // Update Version Info
      const viList = resedit.Resource.VersionInfo.fromEntries(res.entries);
      if (viList.length > 0) {
        const vi = viList[0];
        vi.setStringValue({ lang: 1033, codepage: 1200 }, 'FileDescription', 'ShutterFilter by Tandev.foto');
        vi.setStringValue({ lang: 1033, codepage: 1200 }, 'CompanyName', 'Tandev.foto');
        vi.setStringValue({ lang: 1033, codepage: 1200 }, 'ProductName', 'ShutterFilter by Tandev.foto');
        vi.outputToResourceEntries(res.entries);
      }

      res.outputResource(exe);
      const newExeBuffer = Buffer.from(exe.generate());

      fs.writeFileSync(exePath, newExeBuffer);
      console.log(`[resedit] Successfully patched icon & version info for: ${path.basename(exePath)}`);
      return;
    } catch (err) {
      if ((err.code === 'EBUSY' || err.code === 'EPERM') && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1200 * attempt));
        continue;
      }
      console.error(`[resedit] Error patching ${path.basename(exePath)}:`, err.message);
      process.exitCode = 1;
      return;
    }
  }
}

async function patchAllExes() {
  const icoPath = path.join(__dirname, 'assets/icon.ico');
  const releaseDir = path.join(__dirname, 'release');

  if (!fs.existsSync(releaseDir) || !fs.existsSync(icoPath)) {
    console.error('Release directory or Icon path not found!');
    return;
  }

  const exePaths = [];
  function findExes(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const f of files) {
      const full = path.join(dir, f.name);
      if (f.isDirectory()) {
        findExes(full);
      } else if (f.isFile() && f.name.endsWith('.exe')) {
        exePaths.push(full);
      }
    }
  }

  findExes(releaseDir);
  for (const exePath of exePaths) {
    await patchSingleExe(exePath, icoPath);
  }
}

patchAllExes();
