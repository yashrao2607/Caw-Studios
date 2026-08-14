# Docker Manual Runbook

**What this is:** everything you would have typed by hand, in order, if you had done this yourself — including the VMware/Ubuntu half (§1–9) that was never run on this machine, and the container half (§10–16) that was run for you on 2026-08-10.

Written against the *verified* state of this laptop, not a generic template. Facts marked ✅ were checked by running a command.

---

## Contents

- [Part 0 — Read this before touching anything](#part-0--read-this-before-touching-anything)
- [Part 1 — Verified state of this machine](#part-1--verified-state-of-this-machine)
- [Part 2 — §1 Prerequisites (BIOS + Hyper-V)](#part-2--1-prerequisites-bios--hyper-v)
- [Part 3 — §2–3 Downloads](#part-3--23-downloads)
- [Part 4 — §4–5 Install VMware, create the VM](#part-4--45-install-vmware-create-the-vm)
- [Part 5 — §6 Install Ubuntu](#part-5--6-install-ubuntu)
- [Part 6 — §7 First login](#part-6--7-first-login)
- [Part 7 — §8 SSH from PowerShell](#part-7--8-ssh-from-powershell)
- [Part 8 — §9 Install Docker on Ubuntu](#part-8--9-install-docker-on-ubuntu)
- [Part 9 — §10–16 The container work (what was actually run)](#part-9--1016-the-container-work-what-was-actually-run)
- [Part 10 — Every command, with the real output](#part-10--every-command-with-the-real-output)
- [Part 11 — Things the guide does not tell you](#part-11--things-the-guide-does-not-tell-you)
- [Part 12 — Master troubleshooting table](#part-12--master-troubleshooting-table)
- [Part 13 — What is still undone](#part-13--what-is-still-undone)

---

## Part 0 — Read this before touching anything

### The conflict that will bite you

This laptop already runs **Docker Desktop on the WSL2 backend**. WSL2 requires the Windows hypervisor. VMware Workstation requires the hypervisor to be **off**. They cannot both work at the same time.

The guide's §1 tells you to run:

```
bcdedit /set hypervisorlaunchtype off
```

On this machine that command will:

| Effect | Detail |
|---|---|
| Break Docker Desktop | WSL2 backend cannot start without the hypervisor |
| Stop `upsk-sdf-postgres` | Your upsk bootcamp Postgres — 3 hours uptime as of the run |
| Stop `upsk-sdf-redis` | Your upsk bootcamp Redis |
| Risk your volumes | 5 local volumes, ~113 MB, one of them almost certainly Postgres data |
| Fail anyway | It needs an elevated PowerShell; you were not running as Administrator ✅ |

**Undo command, memorise it:**

```
bcdedit /set hypervisorlaunchtype auto
```
Then reboot. Docker Desktop comes back.

### So do you need the VM at all?

| You need §1–9 if… | You can skip §1–9 if… |
|---|---|
| A class/assessment requires proof you installed a hypervisor and a Linux server | You only want to learn Docker itself |
| You must practise `apt`, `systemctl`, `ufw`, `nano`, `ip a` on a real Linux server | You already have Docker Desktop working (you do ✅) |
| You need to break/recover a machine safely with snapshots | You need containers running today |

**Recommendation:** do §1–9 on a *different* machine, or accept a full Docker Desktop outage while you do it. Do not casually flip Hyper-V off on a laptop that's mid-bootcamp.

### Safer alternatives to VMware on this laptop

| Option | Keeps Docker Desktop alive? | Gets you a real Ubuntu shell? | Notes |
|---|---|---|---|
| **WSL2 Ubuntu** (`wsl --install -d Ubuntu`) | ✅ Yes | ✅ Yes | Same hypervisor Docker already uses. No conflict. No 3 GB ISO. Missing: BIOS/installer/NAT experience. |
| **Hyper-V Quick Create** | ✅ Yes | ✅ Yes | Uses the hypervisor instead of fighting it. Full VM with installer. |
| VMware Workstation | ❌ No | ✅ Yes | Requires Hyper-V off. What the guide assumes. |
| VirtualBox 7+ | ⚠️ Degraded | ✅ Yes | Runs with Hyper-V on, but slowly (it falls back to the Hyper-V API). |
| Play with Docker (browser) | ✅ Yes | ✅ Yes | Zero install, sessions expire after 4 hours. |

---

## Part 1 — Verified state of this machine

Checked 2026-08-10.

| Item | Value | Command used |
|---|---|---|
| Docker CLI | `C:\Program Files\Docker\Docker\resources\bin\docker.exe` | `Get-Command docker` |
| Docker Engine | **29.5.3**, daemon responding | `docker version` |
| Backend | WSL2, distro `docker-desktop` Running | `wsl -l -v` |
| Hypervisor | **Present / active** | `(Get-CimInstance Win32_ComputerSystem).HypervisorPresent` |
| BIOS virtualization flag | Reads `False` — **see note below** | `(Get-CimInstance Win32_Processor).VirtualizationFirmwareEnabled` |
| Admin rights | **No** | `WindowsPrincipal.IsInRole('Administrators')` |
| VMware | **Not installed** | `Get-Command vmrun` → empty |
| OpenSSH client | `C:\WINDOWS\System32\OpenSSH\ssh.exe` | `Get-Command ssh` |
| curl | `C:\WINDOWS\system32\curl.exe` | `Get-Command curl` |
| Port 8080 | Free | `Get-NetTCPConnection -LocalPort 8080` |
| Internet → Docker CDN | HTTP 200 | `Invoke-WebRequest https://download.docker.com` |
| upsk CLI | **Not on PATH** | `Get-Command upsk` → empty |
| upsk SKILL.md | Present at `%USERPROFILE%\.upsk\api.upsk.to\SKILL.md` | `Test-Path` |

> **Note on `VirtualizationFirmwareEnabled = False`.** This does **not** mean virtualization is disabled in BIOS. Once Hyper-V claims the CPU virtualization extensions, Windows reports this property as `False` because Windows itself is now a guest of the hypervisor. `HypervisorPresent = True` is the proof that virtualization is genuinely working. Do not go into BIOS chasing this.

### Protected baseline — never delete these

| Container | Image | State at baseline |
|---|---|---|
| `upsk-sdf-postgres` | `postgres:16` | Up 3 hours |
| `upsk-sdf-redis` | `redis:7-alpine` | Up 3 hours |
| `pi-searxng` | `searxng/searxng:latest` | Exited (255) 10 hours ago |

| Image | ID |
|---|---|
| `postgres:16` | `95206741a5b2` |
| `redis:7-alpine` | `e7723ff73d96` |
| `searxng/searxng:latest` | `3bc6ae0e872e` |
| `python:3.11-slim` | `cdbd05fb6f45` |

Capture this yourself before any lab work:

```powershell
docker ps -a --format "{{.Names}}`t{{.Image}}`t{{.Status}}" > baseline-containers.txt
docker images --format "{{.Repository}}:{{.Tag}}`t{{.ID}}"  > baseline-images.txt
```

---

## Part 2 — §1 Prerequisites (BIOS + Hyper-V)

**Status: NOT DONE. Cannot be automated — firmware and elevated system config.**

### 2.1 Check virtualization from Windows

Three ways, in order of reliability:

```powershell
# 1. Is a hypervisor already running?
(Get-CimInstance Win32_ComputerSystem).HypervisorPresent

# 2. Firmware flag (only meaningful when no hypervisor is running)
(Get-CimInstance Win32_Processor).VirtualizationFirmwareEnabled

# 3. Full summary
systeminfo | Select-String "Hyper-V"
```

Or: `Ctrl+Shift+Esc` → **Performance** → **CPU** → bottom right → **Virtualization: Enabled**.

Reading the result:

| HypervisorPresent | FirmwareEnabled | Meaning |
|---|---|---|
| True | False | ✅ Working. Hyper-V has claimed it. **This is your machine.** |
| False | True | ✅ Enabled in BIOS, nothing using it. Ready for VMware. |
| False | False | ❌ Genuinely disabled in BIOS. Go to 2.2. |
| True | True | ✅ Working. |

### 2.2 Enable it in BIOS (only if genuinely disabled)

1. **Shut down completely.** Not Restart, not Sleep — Windows Fast Startup can skip the firmware screen. Better: hold `Shift` while clicking Shut down.
2. Power on and tap the BIOS key repeatedly from the moment the logo appears.
3. Navigate to the setting and set **Enabled**.
4. `F10` → Save & Exit → Yes.

| Brand | Key | Setting name | Typical path |
|---|---|---|---|
| ASUS | `F2` | **SVM Mode** (AMD) / **Intel Virtualization Technology** | Advanced → CPU Configuration |
| HP | `F10` or `Esc` | **Virtualization Technology (VTx)** | Advanced → System Options |
| Dell | `F2` | **Virtualization** | Virtualization Support → Virtualization |
| Lenovo | `F1` / `F2` | **Intel VT-x** / **AMD-V** | Security → Virtualization |
| Acer | `F2` | **Intel VT-x** | Advanced / Main (may need `F7` for Advanced) |
| MSI | `Delete` | **SVM Mode** | OC → Advanced CPU Configuration |

**Can't catch the key:** Settings → System → **Recovery** → *Advanced startup* → **Restart now** → Troubleshoot → Advanced options → **UEFI Firmware Settings** → Restart.

**Do not touch in BIOS:** Secure Boot, boot order, TPM, SATA mode (AHCI↔RAID), XMP/overclocking, fTPM. Changing SATA mode or TPM can make Windows unbootable or lock BitLocker.

> ⚠️ **If BitLocker is on**, changing firmware settings can trigger a recovery-key prompt at next boot. Get your key first: https://aka.ms/myrecoverykey. Check with `manage-bde -status`.

### 2.3 Disable Hyper-V

Needs **Administrator** PowerShell (right-click → Run as administrator).

```powershell
bcdedit /set hypervisorlaunchtype off
```

That alone is usually enough. If VMware still complains, also turn off the Windows features that pull the hypervisor back in:

```powershell
Disable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All -NoRestart
Disable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart
Disable-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -NoRestart
Disable-WindowsOptionalFeature -Online -FeatureName WindowsHypervisorPlatform -NoRestart
```

Also check **Core Isolation → Memory integrity** (Windows Security → Device security) and **Windows Sandbox** / **Virtual Machine Platform** in *Turn Windows features on or off* — both silently re-enable the hypervisor.

**Restart Windows** (Restart, not Shut down).

Verify it took:

```powershell
(Get-CimInstance Win32_ComputerSystem).HypervisorPresent   # want: False
bcdedit /enum | Select-String hypervisorlaunchtype          # want: off
```

**Full reversal:**

```powershell
bcdedit /set hypervisorlaunchtype auto
Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart
# reboot, then Docker Desktop works again
```

---

## Part 3 — §2–3 Downloads

**Status: NOT DONE. Account-gated and 3 GB.**

### 3.1 VMware Workstation Pro

Free for personal use, no licence key, but there is **no direct download link** — it is behind a Broadcom login.

| Step | Where |
|---|---|
| 1. Register | https://profile.broadcom.com/web/registration |
| 2. Verify email | Check inbox, click the link |
| 3. Log in | https://support.broadcom.com |
| 4. Switch product group | Top-right dropdown → **VMware Cloud Foundation** |
| 5. Open downloads | Left menu → **My Downloads** |
| 6. Free tier | Click **HERE** in *"Free Software Downloads available HERE"* |
| 7. Export form | Fill it → tick **I Agree** → **Submit** |
| 8. Download | **VMware Workstation Pro** → expand → latest version → tick terms → download |

| Problem | Cause / fix |
|---|---|
| "Not Entitled" | You picked a version below **17.5.2**. Only 17.5.2+ is free. |
| No **My Downloads** menu | Wrong product group — switch to **VMware Cloud Foundation** |
| Download button dead | Terms checkbox not ticked |
| Form rejects your address | Broadcom's export form is strict — use a full postal address, no PO boxes |

**Mac:** download **VMware Fusion Pro** instead. Same portal.

### 3.2 Ubuntu Server ISO

https://ubuntu.com/download/server — **Ubuntu Server LTS**, ~3 GB, filename like `ubuntu-24.04.3-live-server-amd64.iso`.

- **Server, not Desktop.** Desktop is ~5 GB, wants more RAM, and adds a GUI you will not use.
- **LTS, not interim.** LTS = 5 years of updates.
- Do this on home Wi-Fi. 3 GB will not finish during a class.

**Verify the download** (skipping this is how you spend an hour debugging a "broken installer" that is actually a truncated file):

```powershell
Get-FileHash .\ubuntu-24.04.3-live-server-amd64.iso -Algorithm SHA256
```
Compare against `SHA256SUMS` on the download page.

---

## Part 4 — §4–5 Install VMware, create the VM

**Status: NOT DONE. GUI installer + admin + reboot.**

### 4.1 Install

1. Run the `.exe` → Next → accept the licence.
2. **Untick "Enhanced Keyboard Driver"** — it installs a low-level keyboard filter you do not need and which occasionally breaks laptop function keys.
3. Install → **reboot when asked**.
4. Open VMware → at the licence prompt choose **"Use VMware Workstation Pro for Personal Use"** → enter your email → Finish.

### 4.2 Create the VM

1. **File → New Virtual Machine** → **Typical** → Next.
2. ⚠️ Select **"I will install the operating system later"** — **not** the ISO option.

> **Why.** If you point the wizard at the ISO, VMware activates **Easy Install**: it silently creates your user account, sets a password, installs VMware Tools and open-vm-tools its own way, and sometimes uses a different username than you typed. Every later command in the guide assumes the account you created *inside the Ubuntu installer*. Easy Install desynchronises that. You attach the ISO manually afterwards.

3. Guest OS: **Linux** → **Ubuntu 64-bit** → Next.
4. Name: `docker-lab`. Note the folder path it shows — that is where the ~25 GB of disk files live.
5. Disk: **25 GB**, **Store virtual disk as a single file** → Next.

> Single file = faster and simpler. Split files only matter on FAT32 drives, which you do not have.

6. **Customize Hardware**:

| Setting | Value | Why |
|---|---|---|
| Memory | **4096 MB** (2048 absolute minimum) | Ubuntu Server idles ~400 MB; Docker builds want headroom |
| Processors | **2** | 1 works but `apt upgrade` crawls |
| Network Adapter | **NAT** | See below |
| CD/DVD | Leave for now | You attach the ISO in the next step |

> **Why NAT and not Bridged.** NAT puts the VM behind your laptop on a private VMware network. Your laptop can reach it; the campus network cannot see it and cannot refuse it a DHCP lease. Bridged makes the VM a first-class device on the college Wi-Fi — which usually means captive portals, MAC registration, or no address at all. NAT works everywhere.

7. Close → **Finish**.
8. **Now attach the ISO:** VM → **Settings** → **CD/DVD (SATA)** → **Use ISO image file** → Browse → your `.iso` → tick **Connect at power on** → OK.

### 4.3 Take a snapshot before first boot

VM → **Snapshot** → **Take Snapshot** → name `blank-vm`. Ten seconds now, saves recreating the VM later.

---

## Part 5 — §6 Install Ubuntu

**Status: NOT DONE. Keyboard-driven text installer on a VM console.**

Click **Power on this virtual machine**.

**Navigation:** `↑ ↓` move · `Space` tick a checkbox · `Tab` jump to buttons · `Enter` confirm. The mouse does nothing.

> 🖱️ **Mouse trapped inside the VM? Press `Ctrl + Alt`.**

| Screen | Choose | Note |
|---|---|---|
| Language | English | |
| Installer update available | **Continue without updating** | Updating mid-install often hangs |
| Keyboard configuration | Done | Change only if you have a non-US layout |
| Type of install | **Ubuntu Server** | **NOT** "Ubuntu Server (minimized)" — minimized strips tools you need |
| Network connections | Done | Should show `ens33` with a `192.168.x.x` DHCP address. **No address = NAT is broken, fix before continuing** |
| Proxy address | Leave **blank** → Done | |
| Ubuntu archive mirror | Done | Leave the default |
| Guided storage configuration | **Use an entire disk** → Done | Leave LVM ticked |
| Storage configuration | Done → **Continue** on the red warning | |
| Profile setup | see 5.1 | |
| Ubuntu Pro | **Skip for now** | |
| SSH Setup | see 5.2 | **The one screen you must not rush** |
| Featured server snaps | **select nothing** → Done | see 5.3 |

### 5.1 The red "destructive action" warning

It erases **only the 25 GB virtual disk file** you created minutes ago. Windows, your documents, your other drives are not visible to the VM — it has no path to them. Select **Continue**.

### 5.2 Profile setup

| Field | Enter |
|---|---|
| Your name | your name |
| Your server's name | `docker-lab` |
| Pick a username | `student` |
| Password | short — you will type it many times |

> ⚠️ Type the username and hostname **slowly and re-read them**. A dropped keystroke gives you a host called `ocker-lab`. Harmless but confusing. Fix later with `sudo hostnamectl set-hostname docker-lab`.

> ⚠️ **Your password shows nothing while typing.** No dots, no asterisks, no cursor movement. This is normal on Linux — it is not a frozen screen. Type it and press Enter.

### 5.3 SSH Setup — the critical screen

```
[X] Install OpenSSH server      ← press SPACE to tick
Import SSH identity: [ No ]     ← leave as No
```

**Tick the box.** Without it there is no copy-paste into the VM at all, and installing it later means typing the whole `apt install openssh-server` line by hand on a console with no clipboard.

### 5.4 Featured server snaps

**Select nothing.** Docker appears in this list — **do not install it here.** The snap build sandboxes differently, puts files elsewhere, and will conflict with the official `docker-ce` packages in §9.

### 5.5 The wait

> ⚠️ Near the end the screen looks **completely frozen** on a line mentioning `run_unattended_upgrades` or `curtin`. It can sit for **3–25 minutes** downloading updates. **It is not frozen. Do not power off the VM** — that corrupts the install and you start over.

If you want proof it is alive: `Alt + F2` switches to a second console showing live activity. `Alt + F1` returns.

When **Reboot Now** appears, select it. At *"Please remove the installation medium, press ENTER"* — just press **Enter** (VMware disconnects the ISO automatically).

### 5.6 Snapshot

Once it boots to a login prompt: **Snapshot → Take Snapshot → `clean-install`**.

---

## Part 6 — §7 First login

**Status: NOT DONE. Console-only, before SSH exists.**

After a wall of boot text:

```
docker-lab login:
```

Don't see it? **Press Enter once or twice** — background startup messages print over the prompt.

```
docker-lab login: student      ← Enter
Password:                      ← type it (nothing appears), Enter
```

You land at:

```
student@docker-lab:~$
```

### 6.1 Update and install basics

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y open-vm-tools curl git
```

| Package | Why |
|---|---|
| `open-vm-tools` | Clean shutdown, time sync, better VMware integration |
| `curl` | Required by the Docker install in §9 |
| `git` | You will want it |

> `Could not get lock /var/lib/dpkg/` means Ubuntu's own unattended-upgrade is running in the background. Wait 60 seconds and retry. Do not delete the lock file.

### 6.2 Turn SSH on

Even with the box ticked, the service may be installed but not started:

```bash
sudo systemctl enable --now ssh
sudo systemctl status ssh
```

Want green **`active (running)`**. Press **`q`** to exit the pager.

- `enable` = start automatically at every boot
- `--now` = also start it right now

### 6.3 Get the IP address

```bash
ip a
```

Find the `inet` line under **`ens33`**:

```
2: ens33: <BROADCAST,MULTICAST,UP,LOWER_UP> ...
    inet 192.168.154.129/24 brd 192.168.154.255 scope global ens33
```

Shorter:

```bash
hostname -I
```

⚠️ **Write it down and check every digit.** `192.160` instead of `192.168` gives "Connection refused" on a machine that is working perfectly. Ignore `127.0.0.1` (that is the VM talking to itself) and ignore `docker0` once Docker is installed.

> The NAT address can change after a reboot. If SSH stops working later, re-run `hostname -I` on the console first.

---

## Part 7 — §8 SSH from PowerShell

**Status: NOT DONE — and only partly automatable even later. See 7.4.**

### 7.1 Why bother

**Copy-paste does not work in the VMware console window.** Ubuntu Server has no graphical desktop, so there is no clipboard agent for VMware Tools to talk to. No setting fixes this. Instead you connect *from* a normal Windows window, where the clipboard already works.

### 7.2 Connect

Windows → Start → `powershell` → open it (**normal**, not administrator):

```powershell
ssh student@192.168.154.129
```

- First connection asks about a host fingerprint → type **`yes`** → Enter
- Password is invisible, as always

You land at `student@docker-lab:~$`. **Right-click pastes** in this window.

### 7.3 Make sure you are in the right window

Running `ssh` **inside the VMware console** connects the VM to itself. It looks like it worked. You still have no clipboard.

| Window | Copy-paste? | How to tell |
|---|---|---|
| VMware console | ❌ No | Black, inside the VMware app, tabs across the top |
| **PowerShell** | ✅ Yes | Its own Windows title bar and taskbar icon |

| Prompt | You are typing to |
|---|---|
| `PS C:\Users\yourname>` | **Windows** |
| `student@docker-lab:~$` | **Ubuntu (the VM)** |

`exit` returns to Windows. Re-run `ssh` to go back.

> Leave VMware open with the VM **running**. Minimise it — do not close it. SSH only works while the VM is powered on.

### 7.4 Key-based login — the step that unblocks automation

Password prompts read from a real keyboard. Any automated/scripted shell has no keyboard attached, so `ssh` with a password can never be scripted. Set up a key once and the whole VM becomes scriptable.

On **Windows**:

```powershell
ssh-keygen -t ed25519 -C "docker-lab"        # press Enter at every prompt
type $env:USERPROFILE\.ssh\id_ed25519.pub    # copy this single line
```

On the **VM** (type it once on the console, or paste over your first password SSH session):

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "ssh-ed25519 AAAA...your key here... docker-lab" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Test — this must return the hostname with **no password prompt**:

```powershell
ssh student@192.168.154.129 hostname
```

Optional convenience — `%USERPROFILE%\.ssh\config`:

```
Host lab
    HostName 192.168.154.129
    User student
    IdentityFile ~/.ssh/id_ed25519
```
Then just `ssh lab`.

### 7.5 SSH failures

| Error | Cause | Fix |
|---|---|---|
| `Connection refused` | sshd not running | In the VM: `sudo systemctl enable --now ssh` |
| `Connection refused` (sshd *is* running) | Mistyped IP | Re-check every digit against `hostname -I` |
| `Connection timed out` | Wrong IP, or VM powered off | Check the VM is running |
| `Permission denied (publickey,password)` | Wrong username | Lowercase, exactly as set in the installer |
| `ssh: command not found` | No OpenSSH client | Settings → Apps → Optional Features → Add → **OpenSSH Client** |
| `REMOTE HOST IDENTIFICATION HAS CHANGED` | VM rebuilt/reinstalled at the same IP | `ssh-keygen -R 192.168.154.129` then reconnect |

---

## Part 8 — §9 Install Docker on Ubuntu

**Status: NOT DONE on a VM. (Docker already exists on Windows via Docker Desktop ✅.)**

### 8.1 Remove any conflicting packages first

The guide omits this; Docker's own docs include it. Ubuntu ships unofficial `docker.io` packages that clash.

```bash
for p in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do
  sudo apt-get remove -y $p
done
```

### 8.2 The install block

Paste the **whole block** at once (right-click pastes in PowerShell):

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

> **Change nothing in that block.** The `$(...)` parts look like placeholders but they are shell substitutions that fill themselves in — `$(. /etc/os-release && echo ...)` detects your Ubuntu codename (`noble`), `$(dpkg --print-architecture)` detects your CPU (`amd64`). Hand-editing them is the single most common way this breaks.

Line by line:

| Line | What it does |
|---|---|
| `install -m 0755 -d /etc/apt/keyrings` | Creates the keyring folder with correct permissions |
| `curl ... docker.asc` | Downloads Docker's GPG signing key |
| `chmod a+r` | Makes the key world-readable so `apt` (running unprivileged) can read it |
| `tee ... docker.sources` | Writes the new-style deb822 repo definition |
| `Signed-By:` | Ties this repo to that key only — packages signed by anything else are rejected |

Takes 3–5 minutes. It may look stuck near the end — that is the download.

| Package | Purpose |
|---|---|
| `docker-ce` | The daemon (the thing that actually runs containers) |
| `docker-ce-cli` | The `docker` command |
| `containerd.io` | The lower-level container runtime |
| `docker-buildx-plugin` | Modern builder — provides `docker build` |
| `docker-compose-plugin` | `docker compose` (multi-container) |

### 8.3 Verify

```bash
docker --version
sudo docker run hello-world
sudo systemctl status docker      # want: active (running)
```

### 8.4 Stop needing `sudo`

```bash
sudo usermod -aG docker $USER
newgrp docker
docker run hello-world
```

That last one must work **without** `sudo`.

- `usermod -aG docker` adds you to the `docker` group. **The `-a` is critical** — without it you are *removed* from every other group, including `sudo`, and you lock yourself out of admin.
- Group membership is granted at login, so it does not apply to your current shell. `newgrp docker` starts a subshell with the new group; a reboot or full re-login is the permanent fix.

> Still `permission denied ... /var/run/docker.sock`? `sudo reboot`, reconnect, retry.

> **Security note:** the `docker` group is root-equivalent. Anyone in it can mount `/` into a container and become root. Fine on a lab VM; a real decision on a shared server.

### 8.5 The SSL error on college/office Wi-Fi

```
curl: (60) SSL certificate problem: self-signed certificate in certificate chain
```

**Nothing is wrong with your VM.** The network is running a TLS-inspecting proxy — it decrypts your HTTPS and re-signs it with the institution's own certificate, which Linux does not trust.

| Fix | How | Verdict |
|---|---|---|
| **Phone hotspot** ✅ | Connect the **laptop** to the hotspot; the VM follows automatically via NAT. Under 500 MB needed. | Recommended |
| Install the institution's CA | Get the `.crt` from IT → `sudo cp it.crt /usr/local/share/ca-certificates/` → `sudo update-ca-certificates` | Correct but needs IT |
| `curl -k` / disabling verification | — | ❌ **Never.** You are disabling the check that proves you got real Docker packages. |

---

## Part 9 — §10–16 The container work (what was actually run)

**Status: ✅ DONE 2026-08-10 on Docker Desktop.** Files live in `my-first-site\`.

### 9.1 §10 — Create the site

**Manual, on Ubuntu:**

```bash
mkdir ~/my-first-site && cd ~/my-first-site
nano Dockerfile
```

Paste, then save with **`Ctrl+O`** → **Enter** → **`Ctrl+X`**.

`Dockerfile`:

```dockerfile
FROM nginx:alpine
WORKDIR /usr/share/nginx/html
COPY . .
EXPOSE 80
```

```bash
nano index.html
```

`index.html`:

```html
<h1>Hello from inside a container</h1>
<p>Served by nginx, running in Docker.</p>
```

```bash
ls        # must show: Dockerfile  index.html
```

| Line | Meaning |
|---|---|
| `FROM nginx:alpine` | Start from a ready-made web server image. An HTML file cannot serve itself — something must hand it to browsers over HTTP. `alpine` is a minimal Linux, so the image is ~50 MB instead of ~190 MB. |
| `WORKDIR /usr/share/nginx/html` | The directory nginx serves from. Not arbitrary — it is what the nginx image is already configured to use. Also sets the default directory for later instructions. |
| `COPY . .` | Left dot = the build context (your folder on the host). Right dot = inside the image, resolved against WORKDIR. **This is the line that puts your files in.** |
| `EXPOSE 80` | Documentation only. It does **not** open a port — `-p` at run time does that. |

There is no line to start nginx because the base image already carries `ENTRYPOINT ["/docker-entrypoint.sh"]` and `CMD ["nginx","-g","daemon off;"]` — confirmed in `docker history` ✅.

**What was actually done here:** files were written directly to `my-first-site\` — `nano` is only needed when you have no other editor.

### 9.2 §11 — Build

```bash
docker build -t my-first-site:v1 .
```

| Part | Meaning |
|---|---|
| `docker build` | Execute the Dockerfile |
| `-t my-first-site:v1` | Tag: `name:version`. No tag → `<none>` and you will lose track of it. |
| `.` | **The build context** — the folder sent to the daemon and where it looks for `Dockerfile`. Required, not punctuation. |

> Forgetting the dot: `ERROR: "docker buildx build" requires exactly 1 argument`.

Verify:

```bash
docker images
```

Real output ✅:

```
IMAGE              ID             DISK USAGE   CONTENT SIZE
my-first-site:v1   9bae9ae2b4a8       92.7MB         26.1MB
```

> Older Docker shows `REPOSITORY / TAG / SIZE` instead. Either is fine. `DISK USAGE` is uncompressed on-disk; `CONTENT SIZE` is the compressed registry size.

### 9.3 §12 — Run

```bash
docker run -d -p 8080:80 --name my-site my-first-site:v1
```

| Flag | Meaning |
|---|---|
| `-d` | Detached — run in the background and return the prompt |
| `-p 8080:80` | **outside:inside.** Traffic to host port 8080 → port 80 in the container. |
| `--name my-site` | A stable name so you never need the 64-char ID |

It prints a long hex string — the container ID. That means it started.

```bash
docker ps
curl http://localhost:8080
```

Real output ✅:

```
CONTAINER ID   IMAGE              STATUS         PORTS                      NAMES
a22927453853   my-first-site:v1   Up 1 second    0.0.0.0:8080->80/tcp       my-site

<h1>Hello from inside a container</h1>
<p>Served by nginx, running in Docker.</p>
```

> Seeing nginx's default welcome page instead means `index.html` was not copied. `ls` to confirm the file is in the folder, then rebuild.

### 9.4 §13 — Reach it from the browser

**On a VMware VM — required.** The VM sits on VMware's private NAT network; Windows cannot reach its ports without a forward.

1. VMware → **Edit** → **Virtual Network Editor**
2. **Change Settings** (accept the admin prompt)
3. Select **VMnet8 (NAT)** → **NAT Settings** → **Add**

| Host Port | Type | Virtual Machine IP | VM Port |
|---|---|---|---|
| 8080 | TCP | *your VM's IP* | 8080 |

4. OK → OK → browse to **http://localhost:8080**

Still blocked? Open the VM's own firewall:

```bash
sudo ufw allow 8080/tcp
sudo ufw status
```

**On Docker Desktop — not required ✅.** Docker Desktop publishes container ports straight onto Windows `localhost`. Verified: `0.0.0.0:8080->80/tcp, [::]:8080->80/tcp`, and `http://localhost:8080` loaded in the browser with no network configuration at all.

### 9.5 §14 — The core lesson: images are frozen

```bash
nano index.html      # change the heading
# refresh browser → NOTHING CHANGES
```

**This was verified explicitly** ✅ — after editing the file on disk, the running container still served the old text:

```
=== file on disk is edited, but container still serves OLD image ===
<h1>Hello from inside a container</h1>
```

The container runs the **image**, and the image was frozen at build time. Editing a file on disk cannot reach inside an already-built image.

```bash
docker build -t my-first-site:v2 .
docker rm -f my-site
docker run -d -p 8080:80 --name my-site my-first-site:v2
```

Then ✅:

```
<h1>This is version 2</h1>
```

> **This is the central idea of Docker.** Change files → rebuild the image → run a new container. The image is a snapshot; that is exactly why the same image behaves identically on your laptop and on a server.

**Optional — bind mount for development:**

```bash
docker rm -f my-site
docker run -d -p 8080:80 --name my-site \
  -v ~/my-first-site:/usr/share/nginx/html my-first-site:v1
```

On Windows PowerShell the equivalent is:

```powershell
docker run -d -p 8080:80 --name my-site -v "${PWD}:/usr/share/nginx/html" my-first-site:v1
```

Verified ✅ — editing `index.html` changed the served page instantly, no rebuild.

Not for production: the whole value of an image is that it is fixed and self-contained. A bind-mounted container depends on files that exist only on that one machine.

### 9.6 §15 — Command reference (all verified ✅)

**Containers**

| Command | Does |
|---|---|
| `docker ps` | Running containers |
| `docker ps -a` | All containers, including exited |
| `docker stop my-site` | Graceful stop (SIGTERM, then SIGKILL after 10s) |
| `docker start my-site` | Start it again |
| `docker restart my-site` | Stop + start |
| `docker logs my-site` | Its stdout/stderr — **check this first when anything breaks** |
| `docker logs -f my-site` | Follow live (`Ctrl+C` to exit) |
| `docker logs --tail 50 my-site` | Last 50 lines only |
| `docker exec -it my-site sh` | Shell **inside** the running container |
| `docker stats` | Live CPU/memory |
| `docker stats --no-stream` | One snapshot, then exit (needed in scripts) |
| `docker inspect my-site` | Full JSON config |
| `docker port my-site` | Which ports are published |

> Try `docker exec -it my-site sh`, then `ls` and `cat index.html`. You are looking at your own file inside the container. `exit` to leave.
> `-it` needs a real terminal. In a script, drop it: `docker exec my-site sh -c "ls; cat index.html"`.

**Images**

| Command | Does |
|---|---|
| `docker images` | Images on this machine |
| `docker build -t name:tag .` | Build from the Dockerfile |
| `docker pull nginx:alpine` | Download without running |
| `docker history my-first-site:v1` | Layers inside an image |
| `docker tag old:v1 new:v1` | Add another name to the same image |

### 9.7 §16 — Cleanup

Containers and images stay on disk until removed. A 25 GB VM fills faster than you expect.

```bash
docker system df
```

Real output ✅:

```
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          6         4         1.358GB   188.5MB (13%)
Containers      4         3         536.6kB   430.1kB (80%)
Local Volumes   5         4         113.3MB   48.13MB (42%)
Build Cache     14        0         92.76MB   24.58kB
```

**Order matters — container first, then image:**

```bash
docker stop my-site          # stopped, still on disk (ps -a shows it)
docker rm my-site            # gone
docker rmi my-first-site:v1  # now the image can go
```

`docker rm -f my-site` does stop+remove in one step.

Trying it in the wrong order gives this, verified ✅:

```
Error response from daemon: conflict: unable to delete my-first-site:v2
(must be forced) - container 576e5b2c6ec4 is using its referenced image
```

**Bulk removal**

| Command | Removes | Safe here? |
|---|---|---|
| `docker container prune` | All **stopped** containers | ⚠️ Would remove `pi-searxng` |
| `docker image prune` | Untagged/dangling images | ✅ Usually safe |
| `docker image prune -a` | Every image not used by a container | ❌ Would delete `python:3.11-slim`, `searxng` |
| `docker volume prune` | Unused volumes | ❌ 1 of your 5 volumes is unused — likely real data |
| `docker builder prune` | Build cache | ✅ Safe, just slows the next build |
| `docker system prune` | Stopped containers + unused networks + dangling images | ⚠️ Takes `pi-searxng` |
| `docker system prune -a` | **Everything not in use** | ❌ Never on this machine |

Each asks for confirmation — type `y`.

**Full reset — lab machines only:**

```bash
docker rm -f $(docker ps -aq)      # ALL containers, running or not
docker rmi -f $(docker images -q)  # ALL images
```

> ⚠️ No confirmation, no undo. On **this** laptop these would destroy `upsk-sdf-postgres` and `upsk-sdf-redis`. Fine on a throwaway VM, never here.

**The safe teardown for this lab:**

```powershell
docker rm -f my-site
docker rmi my-first-site:v1
```

Verify:

```bash
docker ps -a      # only your 3 originals
docker images     # only your 4 originals
```

---

## Part 10 — Every command, with the real output

Chronological record of the 2026-08-10 run.

| # | Command | Result |
|---|---|---|
| 1 | *(write `Dockerfile`, `index.html`)* | Created in `my-first-site\` |
| 2 | `docker build -t my-first-site:v1 .` | Pulled `nginx:alpine` (20.31 MB layer), built in **6.6 s** |
| 3 | `docker images my-first-site` | `9bae9ae2b4a8` — 92.7 MB disk / 26.1 MB content |
| 4 | `docker run -d -p 8080:80 --name my-site my-first-site:v1` | ID `a22927453853…` |
| 5 | `docker ps` | `Up`, `0.0.0.0:8080->80/tcp, [::]:8080->80/tcp` |
| 6 | `Invoke-WebRequest http://localhost:8080` | Returned the page HTML |
| 7 | `Start-Process http://localhost:8080` | Browser opened |
| 8 | *(edit `index.html`)*, then re-request | **Still old content** — image is frozen |
| 9 | `docker build -q -t my-first-site:v2 .` | `sha256:7c79d1507ed8…` |
| 10 | `docker rm -f my-site` → `docker run … :v2` | Served `<h1>This is version 2</h1>` |
| 11 | `docker run … -v "${PWD}:/usr/share/nginx/html" my-first-site:v1` | Mount live |
| 12 | *(edit file, no rebuild)* | Page changed **instantly** |
| 13 | `docker logs my-site` | `start worker process 42…45` |
| 14 | `docker exec my-site sh -c "ls; cat index.html"` | `50x.html  Dockerfile  index.html` |
| 15 | `docker stats --no-stream my-site` | **15.32 MiB** / 7.57 GiB, 0.00 % CPU, 17 PIDs |
| 16 | `docker history my-first-site:v1` | 23 layers |
| 17 | `docker restart my-site` | `Up` |
| 18 | `docker system df` | 6 images / 1.358 GB |
| 19 | `docker rmi my-first-site:v2` *(while running)* | **Expected conflict error** |
| 20 | `docker stop my-site` | `Exited (0)` |
| 21 | `docker rm my-site` + `docker rmi …:v1 …:v2` | `Untagged` + `Deleted` both |
| 22 | `docker ps -a` / `docker images` | **Baseline exactly restored** |
| 23 | rebuild v1 + run | Live again at http://localhost:8080 |

### Layer breakdown from `docker history` ✅

| Layer | Size | Source |
|---|---|---|
| `EXPOSE 80` | 0 B | your Dockerfile |
| `COPY . .` | **28.7 kB** | **your files** |
| `WORKDIR` | 4.1 kB | your Dockerfile |
| nginx build (`RUN … apkArch`) | 51.8 MB | `nginx:alpine` |
| nginx user setup | 5.64 MB | `nginx:alpine` |
| entrypoint scripts ×5 | ~61 kB | `nginx:alpine` |
| Alpine rootfs | 9.07 MB | `alpine:3.24.1` |

Base image versions pulled: **nginx 1.31.3** on **Alpine 3.24.1**.

---

## Part 11 — Things the guide does not tell you

Observations from the actual run.

| Observation | Why it matters |
|---|---|
| A bind mount **shadows** the image's files | The container ran the **v1** image but served **v2** content, because the mount covered `/usr/share/nginx/html`. The image's own files are still inside, just hidden. This is why "it works with `-v` but breaks without it" is such a common bug. |
| `COPY . .` copies the **Dockerfile** into the image | `docker exec … ls` showed `Dockerfile` sitting in the web root — it was publicly servable. In a real project add a `.dockerignore` (`Dockerfile`, `.git`, `node_modules`, `.env`). |
| `50x.html` appeared alongside your files | The base image ships its own error pages in that directory. `COPY` merges into the folder, it does not replace it. |
| Your contribution is 28.7 kB of a 92.7 MB image | 99.97 % is the base image. That is why the second build was near-instant — every layer below yours was cached. |
| Rebuilding did **not** re-download nginx | Layer caching. Only layers at or after the first change are rebuilt. Order your Dockerfile so rarely-changing things come first. |
| The whole web server used **15.32 MiB** RAM | Less than one browser tab. This is the actual argument for containers over VMs — your Ubuntu VM would reserve 4 GB before serving a byte. |
| Ports bound on both `0.0.0.0` and `[::]` | Docker publishes on IPv4 and IPv6. `-p 127.0.0.1:8080:80` binds to loopback only if you do not want it on the network. |
| `docker rm` and `docker rmi` are different commands | `rm` = container, `rmi` = image. Mixing them up is the most common beginner error after forgetting the build dot. |
| The image ID changed between v1 and v2 | `9bae9ae2b4a8` → `7c79d1507ed8`. Tags move; IDs are content hashes. Two tags can point at one ID, and `docker rmi` on one only untags it. |

---

## Part 12 — Master troubleshooting table

### Virtual machine

| Problem | Fix |
|---|---|
| VM won't start — VT-x/AMD-V error | Enable virtualization in BIOS **and** disable Hyper-V (Part 2) |
| Only 32-bit guest options offered | Same as above |
| "VMware Workstation and Hyper-V are not compatible" | `bcdedit /set hypervisorlaunchtype off` + reboot |
| Password "doesn't work" at login | It does — characters are hidden. Type and press Enter. |
| `Login incorrect` | Wrong username. Exactly as set, all lowercase. |
| Mouse trapped in the VM | `Ctrl + Alt` |
| Installer looks frozen at the end | Downloading updates. Wait up to 25 min. **Never power off.** |
| `Could not get lock /var/lib/dpkg/` | Background update running. Wait 60 s, retry. |
| No IP on `ens33` | Network adapter not connected, or set to Bridged on a hostile network. Use NAT. |
| VM very slow | Give it 2 CPUs / 4 GB, and make sure Hyper-V is actually off |

### Connecting

| Problem | Fix |
|---|---|
| No copy-paste in the VMware window | Impossible without a GUI. Use PowerShell + SSH (Part 7). |
| SSH `Connection refused` | `sudo systemctl enable --now ssh` |
| Refused but sshd is running | Mistyped IP. Check every digit. |
| SSH "worked" but still no clipboard | You ran `ssh` **inside** the VMware window |
| `ssh: command not found` on Windows | Settings → Apps → Optional Features → Add → OpenSSH Client |
| `HOST IDENTIFICATION HAS CHANGED` | `ssh-keygen -R <ip>` |
| Password prompt blocks a script | Set up key auth (7.4) — passwords can never be scripted |

### Docker

| Problem | Fix |
|---|---|
| `permission denied … docker.sock` | `sudo usermod -aG docker $USER`, then `newgrp docker` or reboot |
| `Cannot connect to the Docker daemon` | `sudo systemctl start docker && sudo systemctl enable docker` |
| `requires exactly 1 argument` | Missing `.` at the end of `docker build` |
| `failed to read dockerfile` | Wrong folder — `cd ~/my-first-site` |
| `port is already allocated` | `docker rm -f my-site`, or use `-p 8081:80` |
| `name "/my-site" is already in use` | `docker rm -f my-site` |
| `image is being used by running container` | Remove the container first: `docker rm -f my-site` |
| Container shows `Exited` | `docker logs my-site` — the reason is in there |
| `curl: (60) SSL certificate problem` | TLS-inspecting network. Use a phone hotspot (8.5). |
| Build ignores your changes | Layer cache. Force with `docker build --no-cache -t name:tag .` |

### Website

| Problem | Fix |
|---|---|
| Browser can't reach the site (VM) | Add the VMware NAT port forward (9.4) |
| Browser can't reach the site (Docker Desktop) | Check `docker ps` shows `0.0.0.0:8080->80/tcp` |
| nginx welcome page instead of your page | `index.html` not copied. `ls`, then rebuild. |
| Old content after editing | You did not rebuild (9.5) |
| Still blocked | `sudo ufw allow 8080/tcp` |
| Browser caches the old page | `Ctrl+Shift+R`, or test with `curl` which never caches |

> **Universal first move when anything breaks:** `docker ps -a` (is it running?) then `docker logs <name>` (what did it say?). That resolves most problems.

---

## Part 13 — What is still undone

| Section | Status | Why |
|---|---|---|
| §1 BIOS virtualization | ❌ Not needed — already working ✅ | |
| §1 Disable Hyper-V | ❌ Not done, **deliberately** | Needs admin; would break Docker Desktop and your upsk containers |
| §2 Broadcom account + VMware download | ❌ Not done | Registration, email verification, export form, manual clicks |
| §3 Ubuntu ISO | ❌ Not done | 3 GB, pointless without §4–6 |
| §4 Install VMware | ❌ Not done | GUI installer, admin rights, reboot |
| §5 Create the VM | ❌ Not done | GUI wizard |
| §6 Install Ubuntu | ❌ Not done | Keyboard-driven installer on a VM console |
| §7 First login / apt / IP | ❌ Not done | Console-only, before SSH exists |
| §8 SSH | ❌ Not done | No VM to connect to; password prompts also need a keyboard |
| §9 Docker on Ubuntu | ❌ Not done | Needs a VM |
| §10–16 | ✅ **Done and verified** | On Docker Desktop |

### Skills you have vs. have not practised

| Practised ✅ | Not practised ❌ |
|---|---|
| Writing a Dockerfile | BIOS / firmware configuration |
| Build → tag → run → verify loop | Hypervisor conflicts and `bcdedit` |
| Port publishing (`-p outside:inside`) | Creating and sizing a VM |
| The frozen-image / rebuild concept | Installing Linux from an ISO |
| Bind mounts and how they shadow | `apt`, `systemctl`, `ufw`, `nano` on a real server |
| `logs` / `exec` / `stats` / `history` | Reading `ip a` to find an interface address |
| Container vs. image lifecycle | SSH into a remote host, host keys, key auth |
| Safe, targeted cleanup | Adding a repo GPG key and apt source by hand |
| Layer caching behaviour | VMware NAT port forwarding |

**Everything in the right column is Linux and virtualization admin, not Docker.** If a class requires it, do it on a spare machine or accept the Docker Desktop outage. If you only want Docker, you already have what matters.

### The fastest way to close the Linux gap without breaking anything

WSL2 uses the *same* hypervisor Docker Desktop already needs, so there is no conflict:

```powershell
wsl --install -d Ubuntu
```

Then inside it you can genuinely practise §7 (`apt`, `systemctl`, `ip a`), §9 (the full Docker repo + key install), and §10–16 — on a real Ubuntu userland. You would still miss BIOS, the ISO installer, and VMware NAT.

---

## Quick reference card

```bash
# Connect to a VM (from PowerShell on Windows)
ssh student@<vm-ip>

# Build and run
cd ~/my-first-site                            # Windows: cd "d:\Caw Studios\my-first-site"
docker build -t my-first-site:v1 .
docker run -d -p 8080:80 --name my-site my-first-site:v1
docker ps
curl http://localhost:8080

# After editing index.html
docker build -t my-first-site:v2 .
docker rm -f my-site
docker run -d -p 8080:80 --name my-site my-first-site:v2

# Diagnose
docker ps -a
docker logs my-site
docker exec -it my-site sh

# Safe cleanup on THIS machine (never prune -a)
docker rm -f my-site
docker rmi my-first-site:v1 my-first-site:v2
docker system df
```

---

*Runbook generated 2026-08-10. Machine facts marked ✅ were verified by execution, not assumed. Sections §1–9 were not executed — they are documented for manual completion.*
