"""Customise the Capacitor-generated Android project (run after `npx cap add android`).

- deep link  in.iima.shaurya://auth  so Google sign-in can return to the app
- dark status/navigation bars, opt out of forced edge-to-edge (Android 15)
- Shaurya launcher icons and splash screen
- version code from the CI run number
- release signing when ANDROID_KEYSTORE_PASSWORD and android/app/release.keystore exist
"""
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, 'android', 'app')
RES = os.path.join(APP, 'src', 'main', 'res')
SCHEME = 'in.iima.shaurya'
BG = '#0C0A0B'


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def write(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(s)


def warn(msg):
    print('WARNING:', msg)


# 1. Deep link intent filter on MainActivity -------------------------------
manifest = os.path.join(APP, 'src', 'main', 'AndroidManifest.xml')
m = read(manifest)
if SCHEME not in m:
    intent = (
        '\n            <intent-filter android:autoVerify="false">\n'
        '                <action android:name="android.intent.action.VIEW" />\n'
        '                <category android:name="android.intent.category.DEFAULT" />\n'
        '                <category android:name="android.intent.category.BROWSABLE" />\n'
        f'                <data android:scheme="{SCHEME}" android:host="auth" />\n'
        '            </intent-filter>\n'
    )
    idx = m.find('</activity>')
    if idx == -1:
        warn('MainActivity not found in manifest; deep link not added')
    else:
        m = m[:idx] + intent + '        ' + m[idx:]
        write(manifest, m)
        print('deep link added')

# 2. Theme: dark bars, no forced edge-to-edge --------------------------------
styles = os.path.join(RES, 'values', 'styles.xml')
if os.path.exists(styles):
    s = read(styles)
    extra = (
        f'        <item name="android:statusBarColor">{BG}</item>\n'
        f'        <item name="android:navigationBarColor">{BG}</item>\n'
        f'        <item name="android:windowBackground">@color/shaurya_bg</item>\n'
        '        <item name="android:windowOptOutEdgeToEdgeEnforcement" tools:targetApi="35">true</item>\n'
    )
    if 'shaurya_bg' not in s:
        s = re.sub(r'(<style name="AppTheme\.NoActionBar"[^>]*>\s*)', lambda mm: mm.group(1) + extra, s, count=1)
        if 'xmlns:tools' not in s:
            s = s.replace('<resources>', '<resources xmlns:tools="http://schemas.android.com/tools">', 1)
        write(styles, s)
        print('theme patched')
else:
    warn('styles.xml not found')

write(os.path.join(RES, 'values', 'shaurya_colors.xml'),
      f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="shaurya_bg">{BG}</color>\n</resources>\n')
write(os.path.join(RES, 'values', 'ic_launcher_background.xml'),
      f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">{BG}</color>\n</resources>\n')

# 3. Launcher icons ----------------------------------------------------------
src_res = os.path.join(ROOT, 'resources', 'android', 'res')
for d in os.listdir(src_res):
    for f in os.listdir(os.path.join(src_res, d)):
        dst = os.path.join(RES, d, f)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(os.path.join(src_res, d, f), dst)
print('icons copied')

# 4. Splash screens ----------------------------------------------------------
try:
    from PIL import Image
    mark = Image.open(os.path.join(ROOT, 'resources', 'splash-wordmark.png')).convert('RGBA')
    count = 0
    for dirpath, _, files in os.walk(RES):
        for f in files:
            if f != 'splash.png':
                continue
            p = os.path.join(dirpath, f)
            w, h = Image.open(p).size
            canvas = Image.new('RGBA', (w, h), (12, 10, 11, 255))
            mw = int(min(w, h) * 0.55)
            mk = mark.resize((mw, int(mw * mark.height / mark.width)), Image.LANCZOS)
            canvas.paste(mk, ((w - mk.width) // 2, (h - mk.height) // 2), mk)
            canvas.convert('RGB').save(p, optimize=True)
            count += 1
    print(f'{count} splash images replaced')
except ImportError:
    warn('Pillow not installed; default splash kept')

# 5. Version + signing -------------------------------------------------------
gradle = os.path.join(APP, 'build.gradle')
g = read(gradle)
run = int(os.environ.get('GITHUB_RUN_NUMBER', '1'))
g = re.sub(r'versionCode\s+\d+', f'versionCode {run}', g, count=1)
g = re.sub(r'versionName\s+"[^"]*"', f'versionName "1.0.{run}"', g, count=1)
if os.environ.get('ANDROID_KEYSTORE_PASSWORD') and os.path.exists(os.path.join(APP, 'release.keystore')):
    if 'signingConfigs' not in g:
        signing = (
            '    signingConfigs {\n'
            '        release {\n'
            "            storeFile file('release.keystore')\n"
            "            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')\n"
            "            keyAlias System.getenv('ANDROID_KEY_ALIAS') ?: 'shaurya'\n"
            "            keyPassword System.getenv('ANDROID_KEYSTORE_PASSWORD')\n"
            '        }\n'
            '    }\n'
        )
        g = g.replace('    buildTypes {', signing + '    buildTypes {', 1)
        g = re.sub(r'(buildTypes\s*\{\s*release\s*\{)', r'\1\n            signingConfig signingConfigs.release', g, count=1)
        print('release signing configured')
write(gradle, g)
print('done')
sys.exit(0)
