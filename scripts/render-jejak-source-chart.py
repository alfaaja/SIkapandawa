"""Render the owner's 21 historical totals; never infer per-aspect answers."""
import json
import os
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'release/chart-python'))
os.environ.setdefault('MPLCONFIGDIR', str(root / 'release/matplotlib-cache'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

items = [('FN', 7), ('LH', 8), ('SA¹', 10), ('RM', 8), ('AR', 9), ('AI', 7),
         ('FP', 8), ('ARF', 10), ('TZ', 9), ('SM', 8), ('DF', 10), ('NP', 9),
         ('MDS', 10), ('PAM', 9), ('NA', 10), ('DAS', 10), ('BI', 10),
         ('NM', 10), ('AV', 10), ('CV', 10), ('SA²', 10)]
assert len(items) == 21 and sum(v for _, v in items) == 192
out = root / 'release/jejak-restoration-20261016'
out.mkdir(parents=True, exist_ok=True)
fig, ax = plt.subplots(figsize=(16, 5.8), dpi=180)
fig.patch.set_facecolor('#fffefb')
ax.set_facecolor('#fffefb')
ax.set_axisbelow(True)
ax.grid(axis='y', color='#e6e2d9', linestyle='--', linewidth=.8)
for i, (label, score) in enumerate(items):
    ax.add_patch(FancyBboxPatch((i - .34, 0), .68, score,
                 boxstyle='round,pad=0,rounding_size=0.14', facecolor='#ffd12b', edgecolor='none'))
    ax.text(i, score + .3, f'{score}/10', ha='center', fontsize=10, weight='bold',
            color='#24213d', bbox=dict(boxstyle='round,pad=0.28', fc='#fff2c9', ec='none'))
ax.set_xlim(-.7, len(items) - .3)
ax.set_ylim(0, 12)
ax.set_yticks(range(0, 13, 2))
ax.set_xticks(range(len(items)), [label for label, _ in items], fontsize=10, weight='bold')
ax.set_ylabel('Skor', fontsize=12, weight='bold', color='#24213d')
for side in ['top', 'right']:
    ax.spines[side].set_visible(False)
for side in ['left', 'bottom']:
    ax.spines[side].set_color('#24213d')
    ax.spines[side].set_linewidth(1.5)
ax.tick_params(colors='#24213d')
fig.suptitle('Hasil Jejak Pandawa — Rekap 21 Siswa', fontsize=18, weight='bold', color='#24213d', y=.97)
fig.text(.5, .89, 'SDN Kalibanteng Kulon 01  •  Rata-rata: 9,14/10 (91,43%)', ha='center', fontsize=12, color='#514c61')
fig.text(.08, .07, 'Sumber: rekap pemilik, 16 Oktober 2026. Total 192/210. Skor a/10 = poin diperoleh / poin maksimal.', fontsize=10, color='#514c61')
fig.text(.08, .025, 'SA¹ = Shakila; SA² = Sean Arsenio. Rekap total historis; rincian jawaban dan skor per aspek tidak direkonstruksi.', fontsize=9, color='#514c61')
fig.subplots_adjust(left=.055, right=.99, top=.82, bottom=.16)
for ext in ['png', 'svg']:
    fig.savefig(out / f'rekap-jejak-21-siswa.{ext}', facecolor=fig.get_facecolor())
plt.close(fig)
(out / 'source-totals.json').write_text(json.dumps({
    'source': 'Owner source chart 2026-10-16; AR confirmed correction 10 to 9',
    'scope': '21 students shown in source, not all registered school accounts',
    'sum': 192, 'count': 21, 'average': 192 / 21,
    'perAspectKnown': False, 'items': [{'initial': label, 'score': score} for label, score in items]
}, ensure_ascii=False, indent=2), encoding='utf-8')
print('Rendered PNG and SVG: 21 totals, sum 192, average 9.142857/10')
