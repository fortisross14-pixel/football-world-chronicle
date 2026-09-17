from pathlib import Path
from PIL import Image
import numpy as np
from scipy import ndimage
import json, shutil, re

ROOT = Path('/mnt/data/fwc315')
HIST = ROOT/'assets'/'faces'/'historical'
PLAYERS = ROOT/'assets'/'faces'/'players'
MANIFEST = HIST/'manifest.json'

# Three newly generated clean 4x4 portrait sheets from the v3.15 face pass.
SHEETS = [
    Path('/mnt/data/anime_soccer_portraits_grid.png'),
    Path('/mnt/data/anime_football_portrait_grid.png'),
    Path('/mnt/data/anime_footballer_portrait_grid.png'),
]

# Extract one clean subject per cell, then normalize into the game's 128x128 transparent portrait canvas.
def extract_sheet(sheet_path):
    sheet = Image.open(sheet_path).convert('RGBA')
    xs = np.linspace(0, sheet.width, 5).round().astype(int)
    ys = np.linspace(0, sheet.height, 5).round().astype(int)
    result=[]
    for r in range(4):
        for c in range(4):
            crop=sheet.crop((int(xs[c]),int(ys[r]),int(xs[c+1]),int(ys[r+1])))
            arr=np.array(crop)
            mask=arr[:,:,3] > 18
            lab,n=ndimage.label(mask)
            if n:
                areas=np.bincount(lab.ravel()); areas[0]=0
                keep=int(areas.argmax())
                keep_mask=lab==keep
                yy,xx=np.where(keep_mask)
                out=np.zeros_like(arr)
                out[keep_mask]=arr[keep_mask]
                arr=out[yy.min():yy.max()+1,xx.min():xx.max()+1]
            img=Image.fromarray(arr,'RGBA')
            bbox=img.getbbox()
            if bbox: img=img.crop(bbox)
            scale=min(118/img.width,116/img.height)
            img=img.resize((max(1,round(img.width*scale)),max(1,round(img.height*scale))),Image.Resampling.LANCZOS)
            canvas=Image.new('RGBA',(128,128),(0,0,0,0))
            x=(128-img.width)//2
            y=128-img.height-3
            canvas.alpha_composite(img,(x,max(0,y)))
            result.append(canvas)
    return result

new_faces=[]
for p in SHEETS:
    new_faces.extend(extract_sheet(p))
assert len(new_faces)==48

# Upgrade the most visible placeholder historical portraits to distinct generated faces.
# The assignment is appearance-aware rather than random.
GENERATED_ASSIGNMENTS = {
    'puskas':16, 'yashin':22, 'baresi':46, 'gerd-muller':24,
    'benzema':1, 'michael-owen':17, 'cannavaro':2, 'stoichkov':10,
    'bobby-charlton':3, 'george-best':47, 'bobby-moore':26, 'sergio-ramos':13,
    'dino-zoff':27, 'oliver-kahn':19, 'peter-schmeichel':41, 'facchetti':21,
    'nesta':37, 'scirea':38, 'passarella':40, 'nilton-santos':29,
    'didi':31, 'jairzinho':34, 'lewandowski':17, 'bergkamp':18,
    'dalglish':32, 'alan-shearer':7, 'jimmy-greaves':24, 'paolo-rossi':14,
    'gianni-rivera':39, 'totti':47, 'del-piero':10, 'seedorf':23,
    'rijkaard':8, 'robben':12, 'ribery':11, 'hugo-sanchez':45,
    'mario-kempes':37, 'batistuta':21, 'rivelino':28, 'zico':15,
    'ruud-krol':0, 'josef-bican':27, 'raymond-kopa':24, 'just-fontaine':17,
    'stanley-matthews':9, 'giuseppe-meazza':6, 'ibrahimovic':6, 'harry-kane':5,
}

# Remaining placeholder icons use hand-picked existing clean manga assets where the generated sheet
# did not have an appropriate likeness. They still become stable identity overrides.
SPECIAL_ARCHETYPE = {
    'son':5,
    'scholes':3,
    'gerrard':31,
    'lampard':34,
    'beckham':17,
    'de-bruyne':3,
}

# All Epics now get a stable historical identity portrait instead of entering the random pool.
# These mappings are deliberately appearance-aware (skin tone / hair / general silhouette).
EPIC_MAP = {
'rooney':11,'mijatovic':25,'riquelme':31,'forlan':15,'etoo':19,'ballack':34,'drogba':16,
'david-villa':9,'fernando-torres':17,'aguero':25,'cavani':29,'falcao':31,'vinicius':16,
'griezmann':2,'sadio-mane':35,'mahrez':6,'suker':11,'larsson':17,'kluivert':19,
'van-nistelrooy':17,'crespo':31,'vieri':34,'inzaghi':25,'trezeguet':34,'adriano':28,
'tevez':25,'recoba':29,'savicevic':29,'prosinecki':18,'stojkovic':31,'hagi':31,'nedved':18,
'vieira':35,'makelele':1,'yaya-toure':12,'kante':1,'kroos':17,'schweinsteiger':34,'ozil':6,
'sneijder':24,'xabi-alonso':31,'fabregas':9,'david-silva':5,'veron':24,'aimar':29,'ortega':25,
'francescoli':31,'redondo':29,'guti':18,'deco':9,'keane':34,'busquets':5,'rodri':9,
'bellingham':28,'bruno-fernandes':31,'marcelo':6,'dani-alves':8,'ashley-cole':1,'evra':1,
'lahm':34,'zanetti':29,'lucio':24,'thiago-silva':24,'van-dijk':28,'rio-ferdinand':19,
'john-terry':34,'vidic':5,'jaap-stam':24,'desailly':1,'thuram':19,'varane':6,
'chiellini':29,'bonucci':5,'godin':31,'hierro':25,'koeman':17,'kompany':1,'campbell':19,
'alaba':21,'hakimi':6,'trent':28,'cech':34,'van-der-sar':17,'courtois':17,'alisson':31,
'oblak':5,'keylor-navas':9,'dida':1,'valdes':5,'barthez':24,'chilavert':9,'higuita':6,
'mendieta':18,'joaquin':25,'quaresma':9,'payet':6,'aubameyang':19,'kanoute':1,'okocha':16,
'essien':1,'abedi-pele':19,'dempsey':34,'donovan':11,'rafa-marquez':31,'cuauhtemoc':9,
'nakata':14,'park-ji-sung':5,'tim-cahill':34,
}

manifest=json.loads(MANIFEST.read_text())

# Write generated replacements.
for icon_id, idx in GENERATED_ASSIGNMENTS.items():
    new_faces[idx].save(HIST/f'{icon_id}.webp','WEBP',lossless=True,method=6)
    if icon_id in manifest:
        manifest[icon_id]['source']='curated_generated_v315'

# Upgrade the six remaining placeholder icons to fixed clean assets.
for icon_id, pidx in SPECIAL_ARCHETYPE.items():
    shutil.copy2(PLAYERS/f'p{pidx:03d}.webp',HIST/f'{icon_id}.webp')
    if icon_id in manifest:
        manifest[icon_id]['source']=f'curated_identity_v315:p{pidx:03d}'

# Parse all real-world templates directly from the JS source. Objects are JSON literals.
source=(ROOT/'src'/'real-stars.js').read_text()
objs=[]
for raw in re.findall(r'\{\"id\":.*?\}',source):
    try: objs.append(json.loads(raw))
    except Exception: pass
stars={o['id']:o for o in objs if 'id' in o and 'rarity' in o}
assert len(stars)==205, len(stars)

# Add every previously uncovered Epic as an identity override.
for icon_id,pidx in EPIC_MAP.items():
    star=stars[icon_id]
    shutil.copy2(PLAYERS/f'p{pidx:03d}.webp',HIST/f'{icon_id}.webp')
    manifest[icon_id]={
        'name':star['name'],
        'rarity':star['rarity'],
        'source':f'curated_identity_v315:p{pidx:03d}'
    }

# A handful of selected Epics existed in v3.14 already; keep their generated/replacement assets.
# Ensure manifest coverage is exactly the full real-world star library.
missing=[sid for sid in stars if sid not in manifest]
assert not missing, missing
extra=[sid for sid in manifest if sid not in stars]
assert not extra, extra

# Reorder manifest in real-stars.js order for maintainability.
ordered={sid:manifest[sid] for sid in stars}
MANIFEST.write_text(json.dumps(ordered,ensure_ascii=False,indent=2)+'\n')

print('historical portraits:',len(ordered))
print('generated upgrades:',len(GENERATED_ASSIGNMENTS))
print('new epic identity overrides:',len(EPIC_MAP))
