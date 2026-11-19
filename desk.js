// Desk setup: a wooden desk, an open laptop and an office chair, built from
// rounded boxes so they shade softly like an illustration. Everything is in metres in a
// "set" frame: origin on the ground at the middle of the group, +y up, +z toward the
// person sitting at the desk (and toward the camera). index.html places, scales and
// turns the whole set, and lights it with the same sun, haze and tone curve as the grass.

// Materials (read by the shader as an integer)
export const MAT = { wood: 0, plastic: 1, screen: 2, fabric: 3, dark: 4, keys: 5, slot: 6, metal: 7, shell: 8 };

const ARC = 3;   // segments in each rounded edge
// Positions along one axis: the rounded corner region is sampled on an arc, the flat middle is one span
function axisVals(h, r) {
  const v = [];
  for (let i = 0; i <= ARC; i++) v.push(-h + r - r * Math.cos(i / ARC * Math.PI / 2));
  for (let i = 0; i <= ARC; i++) v.push(h - r + r * Math.sin(i / ARC * Math.PI / 2));
  return v;
}
// rotation matrix (row-major 3x3) for pitch about x, yaw about y, roll about z: R = Ry * Rx * Rz
function rotm([px, yw, rz]) {
  const cx = Math.cos(px), sx = Math.sin(px), cy = Math.cos(yw), sy = Math.sin(yw), cz = Math.cos(rz), sz = Math.sin(rz);
  const Rx = [1, 0, 0, 0, cx, -sx, 0, sx, cx], Ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy], Rz = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  const mul = (A, B) => { const C = new Array(9).fill(0); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) C[i * 3 + j] += A[i * 3 + k] * B[k * 3 + j]; return C; };
  return mul(Ry, mul(Rx, Rz));
}
const apply = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];

export function buildDeskSet() {
  const pos = [], nrm = [], loc = [], mat = [], idx = [];
  const boxes = [];   // simple boxes for shadows (centre, yaw, half size)

  // frame = { o: [x, y, z], yaw } places a sub-group (the chair) inside the set
  function part(c, h, r, m, rot = [0, 0, 0], frame = null) {
    r = Math.min(r, h[0], h[1], h[2]);
    const R = rotm(rot), F = frame ? rotm([0, frame.yaw, 0]) : null;
    const inner = h.map(v => v - r);
    for (let k = 0; k < 3; k++) for (const s of [-1, 1]) {
      const u = (k + 1) % 3, w = (k + 2) % 3;
      const U = axisVals(h[u], r), V = axisVals(h[w], r), n0 = pos.length / 3;
      for (let j = 0; j < V.length; j++) for (let i = 0; i < U.length; i++) {
        const P = [0, 0, 0]; P[k] = s * h[k]; P[u] = U[i]; P[w] = V[j];
        const q = P.map((v, a) => Math.max(-inner[a], Math.min(inner[a], v)));
        let d = P.map((v, a) => v - q[a]); const L = Math.hypot(...d) || 1; d = d.map(v => v / L);
        let p = q.map((v, a) => v + d[a] * r), n = d;
        p = apply(R, p); n = apply(R, n);
        p = [p[0] + c[0], p[1] + c[1], p[2] + c[2]];
        if (F) { p = apply(F, p); n = apply(F, n); p = [p[0] + frame.o[0], p[1] + frame.o[1], p[2] + frame.o[2]]; }
        pos.push(...p); nrm.push(...n); loc.push(P[0] / h[0], P[1] / h[1], P[2] / h[2]); mat.push(m + (frame ? 16 : 0));   // +16 = chair group
      }
      const nu = U.length;
      for (let j = 0; j < V.length - 1; j++) for (let i = 0; i < nu - 1; i++) {
        const a = n0 + j * nu + i, b = a + 1, cc = a + nu, dd = cc + 1;
        idx.push(a, b, dd, a, dd, cc);
      }
    }
  }
  function shadowBox(c, h, yaw = 0, frame = null) {
    let cc = c, yy = yaw;
    if (frame) { const F = rotm([0, frame.yaw, 0]); cc = apply(F, c).map((v, a) => v + frame.o[a]); yy += frame.yaw; }
    boxes.push({ c: cc, yaw: yy, h });
  }

  // Caster and mesh geometry use the same centres, pitch and yaw.
  function piece(c, h, radius, material, pitch = 0, yaw = 0, frame = null) {
    part(c, h, radius, material, [pitch, yaw, 0], frame);
    shadowBox(c, h, yaw, frame);
    boxes[boxes.length - 1].pitch = pitch;
  }
  const wood = MAT.wood, ivory = MAT.plastic;
  piece([-.1,.735,0],[.70,.019,.34],.009,wood);
  for (const x of [-.745,.545])
    piece([x,.31,0],[.023,.41,.305],.007,wood);
  piece([-.1,.42,-.275],[.625,.29,.017],.005,wood);
  piece([-.1,.681,.29],[.625,.035,.016],.004,wood);

  const monitorStart = mat.length;
  // Three shadow volumes cover the foot, rear tube and square face.
  piece([-.12,.767,-.09],[.159,.013,.107],.008,ivory);
  part([-.12,.790,-.09],[.109,.014,.074],.012,ivory);
  const rearStart = pos.length;
  piece([-.12,1.012,-.161],[.209,.203,.154],.009,ivory);
  for (let i=rearStart; i<pos.length; i+=3) {
    const depth = Math.max(0, Math.min(1, (-.007-pos[i+2])/.308));
    pos[i] = -.12+(pos[i]+.12)*(1-.19*depth);
    pos[i+1] = 1.012+(pos[i+1]-1.012)*(1-.23*depth);
  }
  piece([-.12,1.029,.006],[.218,.225,.052],.01,ivory);
  // Face UVs span the entire fascia including the gasket and lower panel.
  part([-.12,1.029,.059],[.216,.223,.0015],.0015,MAT.screen);
  for (let i = monitorStart; i < mat.length; i++) mat[i] += 32;
  piece([-.13,.772,.20],[.22,.012,.075],.008,ivory,.06);
  part([-.13,.787,.20],[.198,.005,.061],.004,MAT.keys,[.06,0,0]);
  piece([.168,.771,.205],[.028,.016,.043],.016,ivory);
  // Revolved profiles retain the open cup rim and the moka pot's eight flat faces.
  function vessel(x, z, rings, sides, material) {
    for (let j=1; j<rings.length; j++) {
      const [r0,y0]=rings[j-1], [r1,y1]=rings[j];
      for (let k=0;k<sides;k++) {
        const start=pos.length/3;
        for (const [r,y,corner] of [[r0,y0,k],[r1,y1,k],[r1,y1,k+1],[r0,y0,k+1]]) {
          const angle=2*Math.PI*corner/sides;
          const normalAngle=sides===8 ? 2*Math.PI*(k+.5)/sides : angle;
          const dy=y1-y0, dr=r1-r0, length=Math.hypot(dy,dr);
          pos.push(x+r*Math.cos(angle),y,z+r*Math.sin(angle));
          nrm.push(dy*Math.cos(normalAngle)/length,-dr/length,dy*Math.sin(normalAngle)/length);
          loc.push(corner/sides,(y-.754),r); mat.push(material);
        }
        idx.push(start,start+1,start+2,start,start+2,start+3);
      }
    }
  }
  function proxy(c,h) { shadowBox(c,h); boxes[boxes.length-1].pitch=0; }
  const mugStart = mat.length;
  const cupX=.282, cupZ=.18;
  vessel(cupX,cupZ,[[0,.755],[.075,.755],[.082,.762],[.081,.77],[.061,.77],[0,.765]],40,10);
  vessel(cupX,cupZ,[[.045,.767],[.052,.778],[.052,.89],[.048,.893],[.045,.889],[.045,.791],[0,.791]],40,10);
  for(let k=0;k<14;k++){
    const angle=Math.PI*(k+.5)/14;
    part([cupX-.048-.041*Math.sin(angle),.831+.033*Math.cos(angle),cupZ],
      [.009,.011,.009],.008,13,[0,0,-Math.atan2(.041*Math.cos(angle),-.033*Math.sin(angle))]);
  }
  for (let i=mugStart; i<mat.length; i++) mat[i] += 64;
  const mugBox = boxes.length;
  proxy([cupX,.826,cupZ],[.052,.064,.052]);
  part([.40,.756,.26],[.081,.002,.046],.002,ivory,[0,.12,0]);

  const potX=.473, potZ=-.045;
  vessel(potX,potZ,[[.073,.754],[.059,.845],[.049,.853],[.05,.875],[.063,.879],[.084,.973],[.084,.979],[.019,1.002],[.014,1.007],[.021,1.032],[0,1.038]],8,11);
  part([potX-.073,.962,potZ],[.024,.012,.019],.005,11,[0,0,-.3]);
  part([potX+.094,.969,potZ],[.032,.012,.014],.01,11);
  part([potX+.119,.93,potZ],[.011,.047,.013],.01,11,[0,0,-.15]);
  part([potX+.107,.885,potZ],[.016,.009,.012],.008,11);
  proxy([potX,.884,potZ],[.071,.13,.071]);

  // vertex layout: position, normal, local (-1..1 within its part), material
  const n = pos.length / 3, data = new Float32Array(n * 10);
  for (let i = 0; i < n; i++) {
    data.set(pos.slice(i * 3, i * 3 + 3), i * 10);
    data.set(nrm.slice(i * 3, i * 3 + 3), i * 10 + 3);
    data.set(loc.slice(i * 3, i * 3 + 3), i * 10 + 6);
    data[i * 10 + 9] = mat[i];
  }
  return { data, index: new Uint32Array(idx), count: idx.length, mugBox, boxes };
}

// GLSL shared by the grass and the desk: is a point in the set's shadow (the sun is the
// grass's SUN), under the desk top or chair seat (less sky), or inside a solid part?
export const SET_GLSL = `
  uniform float uPitch[12];

  uniform vec3 uMug; // X and Z offsets, uniform scale
  uniform float uMonitor;
  uniform vec4 uSet;            // world origin xyz, yaw
  uniform float uSetScale, uSetOn;
  uniform vec4 uBoxC[12];        // set-frame centre xyz, yaw
  uniform vec3 uBoxH[12];        // half size
  vec3 rotY(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(c * v.x - s * v.z, v.y, s * v.x + c * v.z); }
  vec3 toSet(vec3 p){ return rotY((p - uSet.xyz) / uSetScale, uSet.w); }
  vec3 boxDir(vec3 v, int i){
    v = rotY(v, uBoxC[i].w);
    float c = cos(uPitch[i]), s = sin(uPitch[i]);
    return vec3(v.x, c*v.y+s*v.z, -s*v.y+c*v.z);
  }
  vec3 inBox(vec3 p, int i){

    return boxDir(p-uBoxC[i].xyz,i);
  }
  float hitBox(vec3 ro, vec3 rd, int i){
    vec3 o = inBox(ro, i), d = boxDir(rd, i), h = uBoxH[i];
    d = sign(d) * max(abs(d), vec3(1e-5)) + vec3(1e-6);
    vec3 a = (-h - o) / d, b = (h - o) / d, lo = min(a, b), hi = max(a, b);
    float tn = max(max(lo.x, lo.y), lo.z), tf = min(min(hi.x, hi.y), hi.z);
    return (tf > tn && tn > .004) ? 1. : 0.;
  }
  // one cheap test against a box around the whole set before testing individual parts
  bool hitsSet(vec3 ro, vec3 rd){
    vec3 c = vec3(-.1, .57, .29), h = vec3(1.1, 1.2, .75), o = ro - c;
    vec3 d = sign(rd) * max(abs(rd), vec3(1e-5)) + vec3(1e-6);
    vec3 a = (-h - o) / d, b = (h - o) / d, lo = min(a, b), hi = max(a, b);
    return min(min(hi.x, hi.y), hi.z) > max(max(max(lo.x, lo.y), lo.z), 0.);
  }
  float setShadow(vec3 pw){
    if (uSetOn < .5) return 0.;
    vec3 p = toSet(pw);
    if (dot(p.xz, p.xz) > 20.) return 0.;
    vec3 L = rotY(SUN, uSet.w);
    if (!hitsSet(p, L)) return 0.;
    float s = 0.;
    for (int i = 0; i < 12; i++) s = max(s, hitBox(p, L, i));
    return s;
  }
  // sky blocked under the desk top and the chair seat
  float setUnder(vec3 pw){
    if (uSetOn < .5) return 0.;
    vec3 p = toSet(pw);
    if (dot(p.xz, p.xz) > 4.) return 0.;
    vec3 q = inBox(p, 0), h = uBoxH[0];
    return (1. - smoothstep(h.x - .03, h.x + .22, abs(q.x))) *
           (1. - smoothstep(h.z - .03, h.z + .22, abs(q.z))) * step(q.y, 0.);
  }
  // grass rooted inside the end panel or pedestal would poke out through the wood
  bool setSolid(vec3 pw){
    if (uSetOn < .5) return false;
    vec3 p = toSet(pw);
    if (dot(p.xz, p.xz) > 1.) return false;
    for (int i = 1; i < 3; i++){ vec3 q = abs(inBox(p, i)); if (q.x < uBoxH[i].x && q.z < uBoxH[i].z) return true; }
    return false;
  }
`;

export const deskVS = (TERRAIN, LIGHT) => `#version 300 es
  precision highp float;
  layout(location = 0) in vec3 aPos;
  layout(location = 1) in vec3 aN;
  layout(location = 2) in vec3 aL;
  layout(location = 3) in float aM;
  uniform mat4 uPV;

  ${LIGHT}
  ${SET_GLSL}
  out vec3 vW, vN, vL; flat out int vM; out float vD;
  void main(){
    int m = int(aM + .5);
    vec3 model = aPos;
    if (m >= 64) {
      m -= 64;
      vec3 pivot = vec3(.282,.754,.18);
      model = pivot + (model-pivot)*uMug.z + vec3(uMug.x,0.,uMug.y);
    } else if (m >= 32) { m -= 32; vec3 pivot=vec3(-.12,.754,-.09); model=pivot+(model-pivot)*uMonitor; }
    vec3 p = rotY(model, -uSet.w) * uSetScale + uSet.xyz;

    vW = p; vN = rotY(aN, -uSet.w); vL = aL; vM = m % 16; vD = -p.z;
    gl_Position = uPV * vec4(p, 1.);
  }`;

export const deskFS = (NOISE, LIGHT, TONE, TERRAIN) => `#version 300 es
  precision highp float;
  in vec3 vW, vN, vL; flat in int vM; in float vD;
  uniform sampler2D uCrtFace;
  uniform vec3 uCam, uWood, uPlastic, uFabric;
  uniform float uSiteLight;
  uniform int uRaw;
  out vec4 o;
  ${NOISE}
  ${TERRAIN}
  ${LIGHT}
  ${TONE}
  ${SET_GLSL}
  float depthCode(float d){ return clamp(log(d / 4.) / log(60.), 0., .99); }
  void main(){
    vec3 n = normalize(vN);
    vec3 V = normalize(uCam - vW);
    if (dot(n, V) < -.2) n = -n;
    vec3 alb; float spec = 0., gloss = 24.;
    if (vM == 0) {                                   // wood: soft grain running along each board
      float g = fbm(vec2(vL.x * 2. + vL.y * .5, vL.z * 14. + vL.y * 5.));
      alb = uWood * (.94 + .12 * g); spec = .05;
    } else if (vM == 1) { alb = uPlastic; spec = .12; gloss = 30.; }
    else if (vM == 3) { alb = uFabric * (.96 + .08 * vnoise(vL.xy * 40.)); }
    else if (vM == 10) { vec2 tile=vec2(vL.x*8.+.5*floor(vL.y/.045),vL.y/.045+vL.z*.8); float dotInk=1.-smoothstep(.21,.29,length(fract(tile)-.5)); alb=mix(vec3(.98,.84,.60),vec3(.43,.12,.075),dotInk); spec=.13; }
    else if (vM == 11) { alb = vec3(.68,.026,.035); }
    else if (vM == 13) {alb=vec3(.98,.84,.60); spec=.13;}
    else if (vM == 12) { alb = vec3(.18,.28,.095); }
    else if (vM == 9) { alb = mix(uFabric, vec3(.90,.59,.46), .36) * (.97 + .06*vnoise(vL.xy*28.)); }
    else if (vM == 4) { alb = vec3(.075, .075, .07); spec = .15; }
    else if (vM == 5) {                              // keys: a grid of caps on the top face
      alb = uPlastic * .32;
      if (n.y > .6) {
        vec2 k = vec2((vL.x * .5 + .5) * 15., (vL.z * .5 + .5) * 5.);
        vec2 e = abs(fract(k) - .5);
        alb *= mix(.72, 1., 1. - smoothstep(.3, .36, max(e.x, e.y)));
      }
      spec = .1;
    }
    else if (vM == 6) { alb = vec3(.06, .06, .058); }
    else if (vM == 7) { alb = vec3(.58, .58, .55); spec = .45; gloss = 40.; }
    else if (vM == 8) { alb = uPlastic * vec3(.78, .78, .8); spec = .1; }
    else alb = vec3(.1);

    float sh = setShadow(vW + n * .006 * uSetScale);
    float sun = (1. - sh) * uSiteLight;
    float wrap = clamp((dot(n, SUN) + .3) / 1.3, 0., 1.);
    float up = .5 + .5 * n.y;
    vec3 skyFill = vec3(.93, .95, .98) * (.5 + .5 * up);                 // the white sky all around
    vec3 bounce = vec3(.30, .40, .2) * .35 * (1. - up);                  // light coming back off the grass
    float ao = mix(.42, 1., smoothstep(0., .32, (vW.y - hm(vW.x, vD).r * uDepth) / uSetScale));   // grass around the feet
    vec3 c = alb * ((skyFill + bounce) * ao + vec3(1., .86, .64) * .75 * wrap * sun);
    vec3 H = normalize(SUN + V);
    c += spec * pow(max(dot(n, H), 0.), gloss) * sun * vec3(1., .92, .78);
    // the low sun is behind the set: edges facing away from us catch a warm rim, like the blade tips
    float fres = pow(1. - max(dot(n, V), 0.), 2.5);
    c += vec3(1., .84, .58) * fres * smoothstep(-.1, .6, dot(SUN, -V)) * sun * .45 * (vM == 2 ? .3 : 1.);

    if (vM == 2) {
      vec2 uv = vec2(.5+.5*vL.x,.5-.5*vL.y);
      vec3 fascia = texture(uCrtFace,uv).rgb;
      c = fascia * (.86+.11*up+.14*wrap*sun);

    }
    // same grade as the grass: warm where the sun reaches, cool in shade
    c *= mix(vec3(.97, .99, 1.03), vec3(1.05, 1.01, .92), wrap * sun);
    c = fogged(c * uOverall, vD);
    // the grass's tone curve, but keep the set's own colours (the grass curve pulls everything green)
    vec3 tm = toneMatch(c);
    float ly = dot(c, vec3(.2126, .7152, .0722)), lt = dot(tm, vec3(.2126, .7152, .0722));
    vec3 graded = mix(tm, c * lt / max(ly, 1e-4), .8);
    o = vec4(uRaw == 1 ? c : graded, depthCode(vD));
  }`;
