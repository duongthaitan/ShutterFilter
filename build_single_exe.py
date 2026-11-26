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
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.IO.Compression;
using System.Diagnostics;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

namespace ShutterFilter
{
    class StudioSplashForm : Form
    {
        private int progressPercent = 0;
        private string statusText = "Dang chuan bi moi truong chay...";
        private float dialAngle = 0f;
        private System.Windows.Forms.Timer animTimer;

        public StudioSplashForm()
        {
            this.FormBorderStyle = FormBorderStyle.None;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.Width = 380;
            this.Height = 220;
            this.BackColor = Color.FromArgb(13, 13, 16);
            this.TopMost = true;
            this.ShowInTaskbar = false;
            this.DoubleBuffered = true;

            animTimer = new System.Windows.Forms.Timer();
            animTimer.Interval = 16;
            animTimer.Tick += (s, e) =>
            {
                dialAngle = (dialAngle + 4.5f) % 360f;
                this.Invalidate();
            };
            animTimer.Start();
        }

        public void UpdateProgress(int percent, string text)
        {
            if (this.IsDisposed) return;
            if (this.InvokeRequired)
            {
                try
                {
                    this.BeginInvoke((Action)(() => UpdateProgress(percent, text)));
                }
                catch {}
                return;
            }
            progressPercent = Math.Max(0, Math.Min(100, percent));
            statusText = text;
            this.Invalidate();
        }

        protected override void OnFormClosed(FormClosedEventArgs e)
        {
            if (animTimer != null)
            {
                animTimer.Stop();
                animTimer.Dispose();
            }
            base.OnFormClosed(e);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

            Color amber = Color.FromArgb(245, 158, 11);
            Color border = Color.FromArgb(38, 38, 45);
            Color textMain = Color.FromArgb(244, 244, 246);
            Color textMuted = Color.FromArgb(161, 161, 170);

            // Outer border
            using (Pen borderPen = new Pen(border, 1))
            {
                g.DrawRectangle(borderPen, 0, 0, this.Width - 1, this.Height - 1);
            }

            // 4 Viewfinder corner brackets
            using (Pen cornerPen = new Pen(amber, 2))
            {
                int m = 18;
                int c = 14;
                g.DrawLine(cornerPen, m, m, m + c, m);
                g.DrawLine(cornerPen, m, m, m, m + c);

                g.DrawLine(cornerPen, this.Width - m, m, this.Width - m - c, m);
                g.DrawLine(cornerPen, this.Width - m, m, this.Width - m, m + c);

                g.DrawLine(cornerPen, m, this.Height - m, m + c, this.Height - m);
                g.DrawLine(cornerPen, m, this.Height - m, m, this.Height - m - c);

                g.DrawLine(cornerPen, this.Width - m, this.Height - m, this.Width - m - c, this.Height - m);
                g.DrawLine(cornerPen, this.Width - m, this.Height - m, this.Width - m, this.Height - m - c);
            }

            // Rotating aperture arc
            int cx = this.Width / 2;
            int cy = 66;
            using (Pen trackPen = new Pen(Color.FromArgb(46, 46, 56), 2))
            {
                g.DrawEllipse(trackPen, cx - 22, cy - 22, 44, 44);
            }
            using (Pen arcPen = new Pen(amber, 2.5f))
            {
                arcPen.StartCap = LineCap.Round;
                arcPen.EndCap = LineCap.Round;
                g.DrawArc(arcPen, cx - 22, cy - 22, 44, 44, dialAngle, 110f);
            }
            using (SolidBrush coreBrush = new SolidBrush(amber))
            {
                g.FillEllipse(coreBrush, cx - 7, cy - 7, 14, 14);
            }

            // Brand text
            using (Font titleFont = new Font("Segoe UI", 14f, FontStyle.Bold))
            using (Font subFont = new Font("Consolas", 8.5f, FontStyle.Regular))
            using (Font statusFont = new Font("Consolas", 8.5f, FontStyle.Regular))
            using (SolidBrush mainBrush = new SolidBrush(textMain))
            using (SolidBrush amberBrush = new SolidBrush(amber))
            using (SolidBrush mutedBrush = new SolidBrush(textMuted))
            {
                StringFormat center = new StringFormat { Alignment = StringAlignment.Center };
                g.DrawString("ShutterFilter", titleFont, mainBrush, cx, 98, center);
                g.DrawString("by Tandev.foto", subFont, amberBrush, cx, 124, center);

                // Progress bar track
                int barX = 40;
                int barY = 156;
                int barW = this.Width - 80;
                int barH = 5;
                using (SolidBrush trackBrush = new SolidBrush(Color.FromArgb(26, 26, 32)))
                {
                    g.FillRectangle(trackBrush, barX, barY, barW, barH);
                }
                int fillW = (int)(barW * (progressPercent / 100.0));
                if (fillW > 0)
                {
                    g.FillRectangle(amberBrush, barX, barY, fillW, barH);
                }

                g.DrawString(statusText, statusFont, mutedBrush, barX, barY + 11);
                StringFormat right = new StringFormat { Alignment = StringAlignment.Far };
                g.DrawString(progressPercent + "%", statusFont, amberBrush, barX + barW, barY + 11, right);
            }
        }
    }

    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string tempDir = Path.Combine(Path.GetTempPath(), "ShutterFilter_AppRun_" + Guid.NewGuid().ToString("N"));
            string targetExe = Path.Combine(tempDir, "ShutterFilter by Tandev.foto.exe");
            Exception launchError = null;
            Process launchedProc = null;

            StudioSplashForm splash = new StudioSplashForm();

            Thread worker = new Thread(() =>
            {
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
                            throw new Exception("Khong tim thay tai nguyen nhung cua ung dung.");
                        }

                        using (ZipArchive archive = new ZipArchive(resourceStream))
                        {
                            int total = Math.Max(1, archive.Entries.Count);
                            int done = 0;
                            foreach (ZipArchiveEntry entry in archive.Entries)
                            {
                                string destPath = Path.Combine(tempDir, entry.FullName);
                                if (string.IsNullOrEmpty(entry.Name))
                                {
                                    Directory.CreateDirectory(destPath);
                                }
                                else
                                {
                                    string parent = Path.GetDirectoryName(destPath);
                                    if (!string.IsNullOrEmpty(parent)) Directory.CreateDirectory(parent);
                                    entry.ExtractToFile(destPath, true);
                                }
                                done++;
                                if (done == total || done % 3 == 0)
                                {
                                    int pct = (int)((done * 95.0) / total);
                                    splash.UpdateProgress(pct, "Dang khoi dong ShutterFilter...");
                                }
                            }
                        }
                    }

                    splash.UpdateProgress(100, "Dang mo cua so ung dung...");

                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = targetExe;
                    psi.WorkingDirectory = tempDir;
                    psi.UseShellExecute = true;

                    launchedProc = Process.Start(psi);
                    Thread.Sleep(450);
                }
                catch (Exception ex)
                {
                    launchError = ex;
                }
                finally
                {
                    try
                    {
                        if (!splash.IsDisposed)
                        {
                            splash.BeginInvoke((Action)(() => splash.Close()));
                        }
                    }
                    catch {}
                }
            });

            worker.IsBackground = true;
            splash.Shown += (s, e) => worker.Start();
            Application.Run(splash);
            worker.Join();

            try
            {
                if (launchError != null)
                {
                    MessageBox.Show("Loi khoi chay ung dung ShutterFilter: " + launchError.Message, "ShutterFilter Error");
                }
                else if (launchedProc != null)
                {
                    launchedProc.WaitForExit();
                }
            }
            finally
            {
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
        "/r:System.Drawing.dll",
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
