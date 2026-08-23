import os
import sys
import zipfile
import subprocess
import time

def build_single_exe():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    release_dir = os.path.join(root_dir, "release")
    unpacked_dir = os.path.join(release_dir, "win-unpacked")
    ico_path = os.path.join(root_dir, "assets", "icon.ico")
    zip_payload_path = os.path.join(release_dir, f"app_payload_{int(time.time())}.zip")
    output_exe = os.path.join(release_dir, "ShutterFilter_SingleFile.exe")
    cs_path = os.path.join(release_dir, "SingleFileLauncher.cs")

    if not os.path.exists(unpacked_dir):
        print(f"Error: {unpacked_dir} does not exist. Run npm run build:dir first.")
        sys.exit(1)

    print("Step 1: Creating compressed payload zip...")
    with zipfile.ZipFile(zip_payload_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as zipf:
        for root, dirs, files in os.walk(unpacked_dir):
            for file in files:
                abs_file = os.path.join(root, file)
                rel_file = os.path.relpath(abs_file, unpacked_dir)
                zipf.write(abs_file, rel_file)

    print(f"Compressed payload created at {zip_payload_path} ({os.path.getsize(zip_payload_path) / (1024*1024):.1f} MB)")

    print("Step 2: Writing C# Single-File Launcher source code...")
    cs_code = """
using System;
using System.IO;
using System.IO.Compression;
using System.Diagnostics;
using System.Reflection;
using System.Windows.Forms;

namespace ShutterFilter
{
    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            string tempDir = Path.Combine(Path.GetTempPath(), "ShutterFilter_AppRun_" + Guid.NewGuid().ToString("N"));
            string targetExe = Path.Combine(tempDir, "ShutterFilter by Tandev.foto.exe");

            try
            {
                if (Directory.Exists(tempDir))
                {
                    try { Directory.Delete(tempDir, true); } catch {}
                }
                Directory.CreateDirectory(tempDir);

                Assembly assembly = Assembly.GetExecutingAssembly();
                using (Stream resourceStream = assembly.GetManifestResourceStream("AppPayload"))
                {
                    if (resourceStream == null)
                    {
                        MessageBox.Show("Loi tai nguyen nhung tap tin ung dung.", "Loi ShutterFilter");
                        return;
                    }
                    using (ZipArchive archive = new ZipArchive(resourceStream))
                    {
                        archive.ExtractToDirectory(tempDir);
                    }
                }

                // Launch main application
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = targetExe;
                psi.WorkingDirectory = tempDir;
                psi.UseShellExecute = true;

                Process proc = Process.Start(psi);
                if (proc != null)
                {
                    proc.WaitForExit();
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Loi khoi chay ung dung ShutterFilter: " + ex.Message, "ShutterFilter Error");
            }
            finally
            {
                // Clean up temp run directory after exit
                try
                {
                    if (Directory.Exists(tempDir))
                    {
                        Directory.Delete(tempDir, true);
                    }
                }
                catch {}
            }
        }
    }
}
"""
    with open(cs_path, "w", encoding="utf-8") as f:
        f.write(cs_code)

    print("Step 3: Compiling C# Single-File Executable with csc.exe...")
    csc_compiler = r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"

    cmd = [
        csc_compiler,
        "/target:winexe",
        f"/out:{output_exe}",
        f"/win32icon:{ico_path}",
        f"/resource:{zip_payload_path},AppPayload",
        "/r:System.dll",
        "/r:System.Core.dll",
        "/r:System.IO.Compression.dll",
        "/r:System.IO.Compression.FileSystem.dll",
        "/r:System.Windows.Forms.dll",
        "/optimize+",
        cs_path
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print("Compilation failed:")
        print(result.stderr)
        sys.exit(1)

    print("Step 4: Cleaning up temporary build artifacts...")
    if os.path.exists(cs_path):
        try: os.remove(cs_path)
        except: pass
    if os.path.exists(zip_payload_path):
        try: os.remove(zip_payload_path)
        except: pass

    final_size_mb = os.path.getsize(output_exe) / (1024 * 1024)
    print(f"SUCCESS! Single-File Standalone Executable created successfully:")
    print(f"Path: {output_exe}")
    print(f"Size: {final_size_mb:.1f} MB")

if __name__ == "__main__":
    build_single_exe()
