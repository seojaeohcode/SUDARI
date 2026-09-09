// A code-native SVG layout around the project's original pixel sprite.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const otter = fs.readFileSync(path.join(root, 'docs/hero.png')).toString('base64');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="480" viewBox="0 0 1280 480" role="img" aria-labelledby="title desc">
<title id="title">SUDARI — A little otter. A little better day.</title>
<desc id="desc">A pixel otter holding a lavender shell beside a mint pond. Your tiny desktop friend for Windows and macOS.</desc>
<rect width="1280" height="480" rx="28" fill="#e8f5ef"/>
<path d="M0 394 Q160 370 300 414 T600 411 T920 403 T1280 391 V480 H0Z" fill="#bddfd4"/>
<path d="M0 441 Q180 412 320 444 T650 443 T980 433 T1280 441 V480 H0Z" fill="#93c8bc"/>
<g fill="#23493f" font-family="Trebuchet MS,Segoe UI,sans-serif">
<text x="68" y="149" font-size="100" font-weight="900" letter-spacing="-5">SUDARI</text>
<text x="72" y="211" font-size="31" font-weight="700">A little otter. A little better day.</text>
<text x="72" y="254" font-size="22" font-family="Malgun Gothic,Apple SD Gothic Neo,sans-serif">내 컴퓨터에 사는, 조개만 한 응원.</text>
<text x="73" y="333" font-size="18">Desktop pet</text><circle cx="195" cy="327" r="3"/>
<text x="214" y="333" font-size="18">Focus timer</text><circle cx="330" cy="327" r="3"/>
<text x="349" y="333" font-size="18">Tiny companion</text>
<text x="73" y="370" font-size="16" fill="#446f61">Windows + macOS · Free &amp; open source</text>
</g>
<ellipse cx="968" cy="408" rx="174" ry="20" fill="#70b0a4"/>
<image x="811" y="109" width="318" height="299" href="data:image/png;base64,${otter}" style="image-rendering:pixelated"/>
<path d="M819 40 H1145 V105 H979 L964 121 L949 105 H819Z" fill="#fffdf4" stroke="#23493f" stroke-width="3"/>
<text x="982" y="82" text-anchor="middle" font-family="Malgun Gothic,Apple SD Gothic Neo,sans-serif" font-size="22" fill="#23493f">오늘도 옆에 있을게.</text>
<g fill="#d791a9"><path d="M767 172 h8 v-8 h16 v8 h8 v16 h-8 v8 h-8 v8 h-8 v-8 h-8 v-8 h-8 v-16 h8Z"/>
<path d="M1150 259 h6 v-6 h12 v6 h6 v12 h-6 v6 h-6 v6 h-6 v-6 h-6 v-6 h-6 v-12 h6Z"/></g>
<g fill="#fffdf4"><path d="M1188 142 h5 v10 h10 v5 h-10 v10 h-5 v-10 h-10 v-5 h10Z"/>
<path d="M739 308 h5 v9 h9 v5 h-9 v9 h-5 v-9 h-9 v-5 h9Z"/></g>
<g stroke="#e8f5ef" stroke-width="4" stroke-linecap="round"><path d="M711 446 h45 M774 446 h14 M1069 452 h62 M1150 452 h20"/></g>
</svg>`;
fs.writeFileSync(path.join(root, 'docs/banner.svg'), svg);
console.log('docs/banner.svg');
