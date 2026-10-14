/**
 * 离线生成 UI 资源（不进包）：
 *   1) Twemoji 贴纸雪碧图 assets/ui/emoji.png + js/emoji_atlas.js（白边+深棕描边已烘焙）
 *   2) 站酷快乐体子集 assets/fonts/kuaile.ttf（需 pyftsubset 与完整字体）
 * 用法：NODE_PATH=<含 canvas/sharp 的 node_modules> node tools/build_ui_assets.js <完整字体路径> <twemoji svg 缓存目录>
 */
var fs = require('fs'), path = require('path'), cp = require('child_process');
var { createCanvas, loadImage } = require('canvas');
var sharp = require('sharp');
var ROOT = path.join(__dirname, '..');
var FONT_SRC = process.argv[2], SVG_DIR = process.argv[3];
var UI_EMOJI = ['🏠', '⚙️', '💡', '⏭️', '📤', '⭐', '🏝️', '🥥', '🔊', '🔇', '🔄', '🌴', '❓', '😎', '☀️', '🔩', '💦', '👆', '🎬'];
var CELL = 88, PAD = 8, INK = '#3B2414';

function tokenize(s) {
  var out = [], cur = '', i = 0;
  while (i < s.length) {
    var cp0 = s.codePointAt(i), ch = String.fromCodePoint(cp0);
    i += ch.length;
    var isMod = cp0 === 0xfe0f || cp0 === 0x200d || (cp0 >= 0x1f3fb && cp0 <= 0x1f3ff) || cp0 === 0x20e3;
    var isEmo = cp0 >= 0x2190 && !(cp0 >= 0x3000 && cp0 <= 0x9fff) && !(cp0 >= 0xff00 && cp0 <= 0xffef);
    if (isMod && cur) { cur += ch; if (cp0 === 0x200d && i < s.length) { var n = String.fromCodePoint(s.codePointAt(i)); cur += n; i += n.length; } continue; }
    if (cur) { out.push(cur); cur = ''; }
    if (isEmo) cur = ch;
  }
  if (cur) out.push(cur);
  return out;
}
function key(e) { return e.replace(/\ufe0f/g, ''); }
function fileName(e) {
  return Array.from(key(e)).map(function (c) { return c.codePointAt(0).toString(16); }).join('-');
}
async function fetchSvg(e) {
  var names = [fileName(e), Array.from(e).map(function (c) { return c.codePointAt(0).toString(16); }).join('-')];
  for (var n of names) {
    var p = path.join(SVG_DIR, n + '.svg');
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
    try {
      var buf = cp.execSync('curl -sfL https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/' + n + '.svg');
      fs.writeFileSync(p, buf);
      return buf.toString();
    } catch (err) {}
  }
  return null;
}
function collectText() {
  var files = [];
  (function walk(d) {
    fs.readdirSync(d).forEach(function (f) {
      var p = path.join(d, f);
      if (/node_modules|_legacy|\.git|tools|images|assets/.test(p.replace(ROOT, ''))) return;
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (/\.(js|json)$/.test(f) && !/emoji_atlas/.test(f)) files.push(p);
    });
  })(ROOT);
  return files.map(function (f) { return fs.readFileSync(f, 'utf8'); }).join('\n');
}
(async function () {
  var text = collectText() + UI_EMOJI.join('');
  // unescape \uXXXX in json
  text = text.replace(/\\u([0-9a-fA-F]{4})/g, function (m, h) { return String.fromCharCode(parseInt(h, 16)); });
  var emo = {};
  tokenize(text).forEach(function (e) { emo[key(e)] = e; });
  var list = [];
  for (var k in emo) {
    var svg = await fetchSvg(emo[k]);
    if (svg) list.push({ k: k, svg: svg }); else console.log('no twemoji for', k, fileName(k));
  }
  var cols = 12, rows = Math.ceil(list.length / cols), cw = CELL + PAD * 2;
  var atlas = createCanvas(cols * cw, rows * cw), ac = atlas.getContext('2d');
  var map = {};
  for (var i = 0; i < list.length; i++) {
    var img = await loadImage(Buffer.from(list[i].svg.replace('<svg ', '<svg width="256" height="256" ')));
    var cx = (i % cols) * cw, cy = Math.floor(i / cols) * cw;
    var tmp = createCanvas(cw, cw), tc = tmp.getContext('2d');
    function sil(col, rad) {
      var t = createCanvas(cw, cw), q = t.getContext('2d');
      for (var a = 0; a < 24; a++) { var an = a / 24 * Math.PI * 2; q.drawImage(img, PAD + Math.cos(an) * rad, PAD + Math.sin(an) * rad, CELL, CELL); }
      q.globalCompositeOperation = 'source-in'; q.fillStyle = col; q.fillRect(0, 0, cw, cw); return t;
    }
    tc.drawImage(sil(INK, 7), 0, 0); tc.drawImage(sil('#FFFFFF', 4.8), 0, 0); tc.drawImage(img, PAD, PAD, CELL, CELL);
    ac.drawImage(tmp, cx, cy);
    map[list[i].k] = [cx, cy];
  }
  fs.mkdirSync(path.join(ROOT, 'assets/ui'), { recursive: true });
  await sharp(atlas.toBuffer('image/png')).png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 }).toFile(path.join(ROOT, 'assets/ui/emoji.png'));
  fs.writeFileSync(path.join(ROOT, 'js/emoji_atlas.js'),
    '/** 自动生成：tools/build_ui_assets.js。Twemoji (CC-BY 4.0) 贴纸雪碧图坐标 */\n' +
    '(function(){Game.EmojiAtlas={src:"assets/ui/emoji.png",cell:' + cw + ',pad:' + PAD + ',map:' + JSON.stringify(map) + '};})();\n');
  console.log('emoji', list.length, 'atlas', atlas.width + 'x' + atlas.height, fs.statSync(path.join(ROOT, 'assets/ui/emoji.png')).size);
  // font subset
  if (FONT_SRC) {
    var chars = {};
    Array.from(text).forEach(function (c) { var cp0 = c.codePointAt(0); if (cp0 >= 0x20 && cp0 < 0x2190 || cp0 >= 0x3000 && cp0 <= 0x9fff || cp0 >= 0xff00 && cp0 <= 0xffef) chars[c] = 1; });
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789%+-×÷=!?！？，。、：；「」（）…~·'.split('').forEach(function (c) { chars[c] = 1; });
    fs.writeFileSync('/tmp/kl_chars.txt', Object.keys(chars).join(''));
    fs.mkdirSync(path.join(ROOT, 'assets/fonts'), { recursive: true });
    cp.execSync('pyftsubset "' + FONT_SRC + '" --text-file=/tmp/kl_chars.txt --output-file="' + path.join(ROOT, 'assets/fonts/kuaile.ttf') + '" --no-hinting --desubroutinize');
    console.log('font chars', Object.keys(chars).length, fs.statSync(path.join(ROOT, 'assets/fonts/kuaile.ttf')).size);
  }
})();
